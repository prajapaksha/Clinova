import { Injectable, NotFoundException } from '@nestjs/common';
import type { Encounter as EncounterRow, Prescription as PrescriptionRow } from '@prisma/client';
import type { DrugDose, SoapNote, VitalMeasurement } from '@clinova/clinical/domain';
import { EncounterStatus, PrescriptionStatus, VITAL_UNITS, VitalType, formatBloodPressure, vitalsToRecord } from '@clinova/clinical/domain';
import type { HealthSummary, PortalDocument, PortalMedication, VisitSummary, VisitSummaryListItem } from '@clinova/portal/domain';
import { RefillStatus } from '@clinova/portal/domain';
import type { Allergy, PatientDocument } from '@clinova/patient/domain';
import { RESULT_DOCUMENT_CATEGORIES } from '@clinova/patient/domain';
import { displayName } from '@clinova/staff/domain';
import { PrismaService } from '../prisma/prisma.service';
import { PatientsService } from '../patients/patients.service';

const SIGNED = [EncounterStatus.Signed, EncounterStatus.Amended];
const VITAL_LABELS: Partial<Record<VitalType, string>> = {
  [VitalType.HeartRate]: 'Heart rate',
  [VitalType.Temperature]: 'Temperature',
  [VitalType.RespiratoryRate]: 'Breathing rate',
  [VitalType.OxygenSaturation]: 'Oxygen level',
  [VitalType.WeightKg]: 'Weight',
  [VitalType.HeightCm]: 'Height',
  [VitalType.BMI]: 'BMI',
};

export function directions(drug: DrugDose, instructions: string | null): string {
  const base = [drug.dosageAmount, drug.route, drug.frequency].filter(Boolean).join(' ');
  const days = drug.durationDays ? ` for ${drug.durationDays} days` : '';
  return [base + days, instructions].filter(Boolean).join('. ');
}

export function medicationName(drug: DrugDose): string {
  return [drug.medicationName, drug.strength, drug.form].filter(Boolean).join(' ');
}

/** Patient-facing view of their chart: visit summaries, medications, allergies, shared documents. */
@Injectable()
export class PortalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
  ) {}

  async visits(patientId: string): Promise<VisitSummaryListItem[]> {
    const rows = await this.prisma.encounter.findMany({
      where: { patientId, status: { in: SIGNED } },
      orderBy: { createdAt: 'desc' },
    });
    const [names, reasons] = await Promise.all([this.staffNames(rows.map(r => r.providerId)), this.reasons(rows)]);
    return rows.map(r => this.listItem(r, names, reasons));
  }

  /** Assessment & plan, prescriptions and vitals — not the clinician's internal reasoning. */
  async visitSummary(patientId: string, encounterId: string): Promise<VisitSummary> {
    const row = await this.prisma.encounter.findUnique({ where: { id: encounterId }, include: { prescriptions: true } });
    if (!row || row.patientId !== patientId || !SIGNED.includes(row.status as EncounterStatus)) {
      throw new NotFoundException('Visit summary not found.');
    }
    const note = JSON.parse(row.noteJson) as SoapNote;
    const record = vitalsToRecord(JSON.parse(row.vitalsJson) as VitalMeasurement[]);
    const vitals: Array<{ label: string; value: string }> = [];
    const bp = formatBloodPressure(record);
    if (bp) vitals.push({ label: 'Blood pressure', value: `${bp} mmHg` });
    for (const [type, label] of Object.entries(VITAL_LABELS) as Array<[VitalType, string]>) {
      const value = record[type];
      if (value !== undefined && value !== null) vitals.push({ label, value: `${value}${type === VitalType.BMI ? '' : ` ${VITAL_UNITS[type]}`}` });
    }
    const [names, reasons] = await Promise.all([
      this.staffNames([row.providerId, row.signedBy ?? '']),
      this.reasons([row]),
    ]);
    return {
      ...this.listItem(row, names, reasons),
      diagnoses: note.assessment.diagnoses.map(d => ({ code: d.code.code, description: d.code.description })),
      vitals,
      treatmentPlan: note.plan.treatmentPlan || null,
      patientInstructions: note.plan.patientInstructions,
      followUpInstructions: note.plan.followUpInstructions,
      prescriptions: row.prescriptions
        .filter(p => p.status !== PrescriptionStatus.Discontinued)
        .map(p => {
          const drug = JSON.parse(p.drugJson) as DrugDose;
          return { name: medicationName(drug), directions: directions(drug, p.instructions), refills: p.refillsAllowed };
        }),
      signedAt: row.signedAt,
      signedByName: row.signedBy ? names.get(row.signedBy) ?? null : null,
    };
  }

  async health(patientId: string): Promise<HealthSummary> {
    const patient = await this.patients.findById(patientId);
    const [prescriptions, pending] = await Promise.all([
      this.prisma.prescription.findMany({ where: { patientId, status: PrescriptionStatus.Active }, orderBy: { issuedAt: 'desc' } }),
      this.prisma.refillRequest.findMany({ where: { patientId, status: RefillStatus.Pending }, select: { prescriptionId: true } }),
    ]);
    const names = await this.staffNames(prescriptions.map(p => p.prescriberId));
    const pendingIds = new Set(pending.map(p => p.prescriptionId));
    const prescribed = prescriptions.map(p => this.medication(p, names, pendingIds));
    const prescribedNames = new Set(prescribed.map(m => m.name.split(' ')[0].toLowerCase()));
    const other: PortalMedication[] = patient.currentMedications
      .filter(m => !prescribedNames.has(m.split(' ')[0].toLowerCase()))
      .map(m => ({ prescriptionId: null, name: m, directions: null, prescriberName: null, issuedAt: null, refillsRemaining: null, pendingRefill: false }));
    return {
      allergies: patient.allergies.map((a: Allergy) => ({ allergen: a.allergen, reaction: a.reaction, severity: a.severity })),
      conditions: patient.chronicConditions,
      medications: [...prescribed, ...other],
      immunizations: patient.immunizationLog,
    };
  }

  async documents(patientId: string): Promise<PortalDocument[]> {
    const patient = await this.patients.findById(patientId);
    return patient.documents
      .filter(d => d.sharedWithPatient)
      .map(d => this.toDocument(d))
      .sort((a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime());
  }

  async documentFile(patientId: string, documentId: string): Promise<{ document: PatientDocument; data: Buffer }> {
    const patient = await this.patients.findById(patientId);
    const doc = patient.documents.find(d => d.id === documentId && d.sharedWithPatient);
    if (!doc) throw new NotFoundException('Document not found.');
    const file = await this.patients.documentFile(patientId, documentId);
    await this.patients.markDocumentViewed(patientId, documentId);
    return file;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  toDocument(d: PatientDocument): PortalDocument {
    return {
      id: d.id,
      name: d.name,
      category: d.category,
      isResult: RESULT_DOCUMENT_CATEGORIES.includes(d.category),
      sharedAt: d.sharedAt ?? d.uploadedAt,
      sharedByName: d.sharedByName ?? null,
      note: d.releaseNote ?? null,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      isNew: !d.patientViewedAt,
    };
  }

  private medication(p: PrescriptionRow, names: Map<string, string>, pending: Set<string>): PortalMedication {
    const drug = JSON.parse(p.drugJson) as DrugDose;
    return {
      prescriptionId: p.id,
      name: medicationName(drug),
      directions: directions(drug, p.instructions),
      prescriberName: names.get(p.prescriberId) ?? null,
      issuedAt: p.issuedAt,
      refillsRemaining: p.refillsRemaining,
      pendingRefill: pending.has(p.id),
    };
  }

  private listItem(row: EncounterRow, names: Map<string, string>, reasons: Map<string, string | null>): VisitSummaryListItem {
    const note = JSON.parse(row.noteJson) as SoapNote;
    const primary = note.assessment.diagnoses.find(d => d.isPrimary) ?? note.assessment.diagnoses[0];
    return {
      id: row.id,
      date: row.signedAt ?? row.createdAt,
      providerName: names.get(row.providerId) ?? 'Your provider',
      reasonForVisit: reasons.get(row.id) ?? (note.subjective.chiefComplaint || null),
      primaryDiagnosis: primary ? primary.code.description : null,
    };
  }

  private async reasons(rows: EncounterRow[]): Promise<Map<string, string | null>> {
    const ids = rows.map(r => r.appointmentId).filter((id): id is string => !!id);
    const appts = ids.length ? await this.prisma.appointment.findMany({ where: { id: { in: ids } }, select: { id: true, reasonForVisit: true } }) : [];
    const byAppt = new Map(appts.map(a => [a.id, a.reasonForVisit]));
    return new Map(rows.map(r => [r.id, r.appointmentId ? byAppt.get(r.appointmentId) ?? null : null]));
  }

  async staffNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const rows = await this.prisma.staff.findMany({ where: { id: { in: unique } } });
    return new Map(rows.map(s => [s.id, displayName(s)]));
  }
}
