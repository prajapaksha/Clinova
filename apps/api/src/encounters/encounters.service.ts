import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  Encounter as EncounterRow,
  EncounterTemplate as TemplateRow,
  Prescription as PrescriptionRow,
} from '@prisma/client';
import type {
  CPTCode,
  DrugCatalogEntry,
  DrugDose,
  Encounter,
  EncounterAddendum,
  EncounterId,
  EncounterSignedEvent,
  EncounterTemplate,
  Prescription,
  PrescriptionId,
  PrescriptionSafetyCheck,
  SoapNote,
  TemplateId,
  VitalMeasurement,
} from '@clinova/clinical/domain';
import {
  EncounterStatus,
  PrescriptionStatus,
  emptySoapNote,
  isEncounterEditable,
  signingBlockers,
} from '@clinova/clinical/domain';
import { isProviderRole } from '@clinova/identity/domain';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventBus } from '../events/domain-event-bus';
import type { AuthUser } from '../auth/auth.service';
import {
  CreateTemplateDto,
  IssuePrescriptionDto,
  NotePatchDto,
  StartEncounterDto,
  UpdateEncounterDto,
  UpdatePrescriptionDto,
} from './dto/encounter.dto';
import { ICD10_CODES, Icd10Entry } from './reference/icd10.data';
import { DRUG_CATALOG } from './reference/drugs.data';
import { PatientAllergyInput, runSafetyChecks } from './medication-safety';

export interface EncounterListFilters {
  patientId?: string;
  providerId?: string;
  status?: string | string[];
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

type EncounterWithRx = EncounterRow & { prescriptions: PrescriptionRow[] };

interface Names {
  patients: Map<string, { name: string; mrn: string }>;
  staff: Map<string, string>;
  reasons: Map<string, string | null>;
}

const ICD10_USAGE_TTL_MS = 5 * 60_000;

/** Applies a partial note on top of an existing one, section by section. */
export function mergeNote(base: SoapNote, patch: NotePatchDto | Partial<SoapNote> | undefined): SoapNote {
  if (!patch) return base;
  return {
    subjective: { ...base.subjective, ...(patch.subjective ?? {}) },
    objective: { ...base.objective, ...(patch.objective ?? {}) },
    assessment: { ...base.assessment, ...(patch.assessment ?? {}) },
    plan: { ...base.plan, ...(patch.plan ?? {}) },
  } as SoapNote;
}

@Injectable()
export class EncountersService {
  private icd10Usage: { counts: Map<string, number>; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: DomainEventBus,
  ) {}

  // ── Queries ────────────────────────────────────────────────────────────────

  async findMany(filters: EncounterListFilters): Promise<{ encounters: Encounter[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filters.patientId) where['patientId'] = filters.patientId;
    if (filters.providerId) where['providerId'] = filters.providerId;
    if (filters.status) {
      where['status'] = { in: Array.isArray(filters.status) ? filters.status : [filters.status] };
    }
    if (filters.from || filters.to) {
      where['createdAt'] = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        include: { prescriptions: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(filters.limit ?? 50, 200),
        skip: filters.offset ?? 0,
      }),
      this.prisma.encounter.count({ where }),
    ]);

    const names = await this.loadNames(rows);
    return { encounters: rows.map(r => this.toEncounter(r, names)), total };
  }

  async findById(id: string): Promise<Encounter> {
    const row = await this.getRow(id);
    return this.toEncounter(row, await this.loadNames([row]));
  }

  async findByAppointment(appointmentId: string): Promise<Encounter | null> {
    const row = await this.prisma.encounter.findUnique({
      where: { appointmentId },
      include: { prescriptions: true },
    });
    return row ? this.toEncounter(row, await this.loadNames([row])) : null;
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  async start(dto: StartEncounterDto, user: AuthUser): Promise<Encounter> {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);

    let providerId = dto.providerId ?? (isProviderRole(user.role) ? user.id : undefined);

    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({ where: { id: dto.appointmentId } });
      if (!appointment) throw new NotFoundException(`Appointment ${dto.appointmentId} not found`);
      if (appointment.patientId !== dto.patientId) {
        throw new BadRequestException('Appointment does not belong to this patient.');
      }

      const existing = await this.findByAppointment(dto.appointmentId);
      if (existing) return existing;

      if (appointment.status !== 'CHECKED_IN' && appointment.status !== 'IN_PROGRESS') {
        throw new BadRequestException('The patient must be checked in before the encounter can begin.');
      }
      providerId = dto.providerId ?? appointment.providerId;
    }

    if (!providerId) throw new BadRequestException('providerId is required.');
    const resolvedProviderId = providerId;

    let note = emptySoapNote();
    let templateId: string | null = null;
    if (dto.templateId) {
      const template = await this.prisma.encounterTemplate.findUnique({ where: { id: dto.templateId } });
      if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`);
      note = mergeNote(note, JSON.parse(template.defaultNoteJson));
      templateId = template.id;
    }

    const created = await this.prisma.$transaction(async tx => {
      const row = await tx.encounter.create({
        data: {
          patientId: dto.patientId,
          providerId: resolvedProviderId,
          appointmentId: dto.appointmentId ?? null,
          templateId,
          status: EncounterStatus.InProgress,
          noteJson: JSON.stringify(note),
        },
      });
      if (dto.appointmentId) {
        await tx.appointment.update({ where: { id: dto.appointmentId }, data: { status: 'IN_PROGRESS' } });
      }
      return row;
    });

    return this.findById(created.id);
  }

  async update(id: string, dto: UpdateEncounterDto, user: AuthUser): Promise<Encounter> {
    const row = await this.getRow(id);
    this.assertEditable(row);

    const data: Record<string, unknown> = {};
    if (dto.note) {
      data['noteJson'] = JSON.stringify(mergeNote(JSON.parse(row.noteJson), dto.note));
    }
    if (dto.vitals) {
      const now = new Date().toISOString();
      data['vitalsJson'] = JSON.stringify(
        dto.vitals.map(v => ({ ...v, recordedAt: v.recordedAt ?? now, recordedBy: user.id })),
      );
    }
    if (dto.status) data['status'] = dto.status;

    await this.prisma.encounter.update({ where: { id }, data });
    return this.findById(id);
  }

  async sign(id: string, user: AuthUser): Promise<Encounter> {
    this.assertPrescriber(user, 'sign clinical notes');
    const row = await this.getRow(id);
    this.assertEditable(row);

    const note: SoapNote = JSON.parse(row.noteJson);
    const blockers = signingBlockers(note);
    if (blockers.length) throw new BadRequestException(blockers.join(' '));

    // Ensure exactly one primary diagnosis.
    const hasPrimary = note.assessment.diagnoses.some(d => d.isPrimary);
    const diagnoses = note.assessment.diagnoses.map((d, i) => ({ ...d, isPrimary: hasPrimary ? d.isPrimary : i === 0 }));
    const signedNote: SoapNote = { ...note, assessment: { ...note.assessment, diagnoses } };

    const now = new Date();
    await this.prisma.$transaction(async tx => {
      await tx.encounter.update({
        where: { id },
        data: {
          status: EncounterStatus.Signed,
          noteJson: JSON.stringify(signedNote),
          signedBy: user.id,
          signedAt: now,
        },
      });
      if (row.appointmentId) {
        await tx.appointment.update({
          where: { id: row.appointmentId },
          data: { status: 'COMPLETED', completedAt: now },
        });
      }
    });

    const signedEvent: EncounterSignedEvent = {
      type: 'clinical.EncounterSigned',
      encounterId: id as EncounterId,
      patientId: row.patientId,
      providerId: row.providerId,
      diagnoses: diagnoses.map(d => d.code),
      serviceCodes: JSON.parse(row.serviceCodesJson) as CPTCode[],
      timestamp: now,
    };
    this.events?.publish(signedEvent);

    return this.findById(id);
  }

  async addAddendum(id: string, content: string, user: AuthUser): Promise<Encounter> {
    this.assertPrescriber(user, 'amend clinical notes');
    const row = await this.getRow(id);
    if (isEncounterEditable(row.status as EncounterStatus)) {
      throw new BadRequestException('Addenda can only be added to signed notes. Edit the note directly instead.');
    }

    const addenda = [
      ...JSON.parse(row.addendaJson),
      { addedBy: user.id, addedAt: new Date().toISOString(), content: content.trim() },
    ];
    await this.prisma.encounter.update({
      where: { id },
      data: { addendaJson: JSON.stringify(addenda), status: EncounterStatus.Amended },
    });
    return this.findById(id);
  }

  async discard(id: string): Promise<void> {
    const row = await this.getRow(id);
    this.assertEditable(row);

    await this.prisma.$transaction(async tx => {
      await tx.encounter.delete({ where: { id } });
      if (row.appointmentId) {
        const appointment = await tx.appointment.findUnique({ where: { id: row.appointmentId } });
        if (appointment?.status === 'IN_PROGRESS') {
          await tx.appointment.update({ where: { id: row.appointmentId }, data: { status: 'CHECKED_IN' } });
        }
      }
    });
  }

  // ── Prescriptions ──────────────────────────────────────────────────────────

  async checkPrescription(patientId: string, medicationName: string): Promise<PrescriptionSafetyCheck> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { allergiesJson: true, currentMedicationsJson: true },
    });
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);

    const allergies: PatientAllergyInput[] = JSON.parse(patient.allergiesJson);
    const activeRx = await this.prisma.prescription.findMany({
      where: { patientId, status: PrescriptionStatus.Active },
      select: { drugJson: true },
    });
    const otherMeds = [
      ...(JSON.parse(patient.currentMedicationsJson) as string[]),
      ...activeRx.map(rx => (JSON.parse(rx.drugJson) as DrugDose).medicationName),
    ];
    return runSafetyChecks(medicationName, allergies, otherMeds);
  }

  async issuePrescription(encounterId: string, dto: IssuePrescriptionDto, user: AuthUser): Promise<Prescription> {
    this.assertPrescriber(user, 'prescribe medication');
    const row = await this.getRow(encounterId);
    this.assertEditable(row);

    const check = await this.checkPrescription(row.patientId, dto.drug.medicationName);
    const hasAlerts = check.allergyAlerts.length > 0 || check.interactionAlerts.length > 0;
    if (hasAlerts && !dto.acknowledgeWarnings) {
      throw new ConflictException({
        message: 'Medication safety alerts must be acknowledged before prescribing.',
        ...check,
      });
    }

    const drug: DrugDose = { ...dto.drug, durationDays: dto.drug.durationDays ?? null };
    const created = await this.prisma.prescription.create({
      data: {
        encounterId,
        patientId: row.patientId,
        prescriberId: user.id,
        drugJson: JSON.stringify(drug),
        refillsAllowed: dto.refillsAllowed,
        refillsRemaining: dto.refillsAllowed,
        instructions: dto.instructions ?? null,
        pharmacyNotes: dto.pharmacyNotes ?? null,
        allergyCheckPassed: check.allergyAlerts.length === 0,
        drugInteractionCheckPassed: check.interactionAlerts.length === 0,
        status: PrescriptionStatus.Active,
      },
    });
    return this.toPrescription(created, new Map([[user.id, `${user.firstName} ${user.lastName}`]]));
  }

  async updatePrescription(id: string, dto: UpdatePrescriptionDto, user: AuthUser): Promise<Prescription> {
    this.assertPrescriber(user, 'change prescriptions');
    const existing = await this.prisma.prescription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Prescription ${id} not found`);

    const updated = await this.prisma.prescription.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.pharmacyNotes !== undefined ? { pharmacyNotes: dto.pharmacyNotes } : {}),
      },
    });
    const staff = await this.staffNames([updated.prescriberId]);
    return this.toPrescription(updated, staff);
  }

  // ── Templates & reference data ─────────────────────────────────────────────

  async findTemplates(filters: { specialty?: string }): Promise<EncounterTemplate[]> {
    const rows = await this.prisma.encounterTemplate.findMany({
      where: { isActive: true, ...(filters.specialty ? { specialty: filters.specialty } : {}) },
      orderBy: { name: 'asc' },
    });
    return rows.map(r => this.toTemplate(r));
  }

  async createTemplate(dto: CreateTemplateDto, user: AuthUser): Promise<EncounterTemplate> {
    const row = await this.prisma.encounterTemplate.create({
      data: {
        name: dto.name,
        specialty: dto.specialty ?? null,
        defaultNoteJson: JSON.stringify(dto.defaultNote),
        createdBy: user.id,
        isShared: dto.isShared ?? true,
      },
    });
    return this.toTemplate(row);
  }

  async searchIcd10(query: string, limit = 20): Promise<Icd10Entry[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const usage = await this.icd10UsageCounts();

    const scored = ICD10_CODES.flatMap(entry => {
      const code = entry.code.toLowerCase();
      const desc = entry.description.toLowerCase();
      let score = 0;
      if (code === q) score = 100;
      else if (code.startsWith(q)) score = 80;
      else if (desc.startsWith(q)) score = 60;
      else if (desc.split(/[\s,()-]+/).some(w => w.startsWith(q))) score = 40;
      else if (desc.includes(q)) score = 20;
      return score ? [{ entry, score: score + Math.min(usage.get(entry.code) ?? 0, 19) }] : [];
    });

    return scored
      .sort((a, b) => b.score - a.score || a.entry.code.localeCompare(b.entry.code))
      .slice(0, limit)
      .map(s => s.entry);
  }

  searchDrugs(query: string, limit = 25): DrugCatalogEntry[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return DRUG_CATALOG
      .filter(d => d.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
      .flatMap(d => d.strengths.map(strength => ({ name: d.name, form: d.form, strength, route: d.route })))
      .slice(0, limit);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getRow(id: string): Promise<EncounterWithRx> {
    const row = await this.prisma.encounter.findUnique({ where: { id }, include: { prescriptions: true } });
    if (!row) throw new NotFoundException(`Encounter ${id} not found`);
    return row;
  }

  private assertEditable(row: EncounterRow): void {
    if (!isEncounterEditable(row.status as EncounterStatus)) {
      throw new ConflictException('This note has been signed and is locked. Add an addendum instead.');
    }
  }

  private assertPrescriber(user: AuthUser, action: string): void {
    if (!isProviderRole(user.role)) {
      throw new ForbiddenException(`Only physicians can ${action}.`);
    }
  }

  private async icd10UsageCounts(): Promise<Map<string, number>> {
    if (this.icd10Usage && Date.now() - this.icd10Usage.at < ICD10_USAGE_TTL_MS) return this.icd10Usage.counts;
    const rows = await this.prisma.encounter.findMany({
      where: { status: { in: [EncounterStatus.Signed, EncounterStatus.Amended] } },
      select: { noteJson: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    const counts = new Map<string, number>();
    for (const r of rows) {
      const note: SoapNote = JSON.parse(r.noteJson);
      for (const d of note.assessment?.diagnoses ?? []) counts.set(d.code.code, (counts.get(d.code.code) ?? 0) + 1);
    }
    this.icd10Usage = { counts, at: Date.now() };
    return counts;
  }

  private async staffNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: unique } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(staff.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
  }

  private async loadNames(rows: EncounterWithRx[]): Promise<Names> {
    const patientIds = [...new Set(rows.map(r => r.patientId))];
    const appointmentIds = rows.map(r => r.appointmentId).filter((id): id is string => !!id);
    const staffIds = rows.flatMap(r => [
      r.providerId,
      r.signedBy ?? '',
      ...r.prescriptions.map(p => p.prescriberId),
      ...(JSON.parse(r.addendaJson) as Array<{ addedBy: string }>).map(a => a.addedBy),
    ]);

    const [patients, staff, appointments] = await Promise.all([
      patientIds.length
        ? this.prisma.patient.findMany({
            where: { id: { in: patientIds } },
            select: { id: true, firstName: true, lastName: true, mrn: true },
          })
        : [],
      this.staffNames(staffIds),
      appointmentIds.length
        ? this.prisma.appointment.findMany({
            where: { id: { in: appointmentIds } },
            select: { id: true, reasonForVisit: true },
          })
        : [],
    ]);

    return {
      patients: new Map(patients.map(p => [p.id, { name: `${p.firstName} ${p.lastName}`, mrn: p.mrn }])),
      staff,
      reasons: new Map(appointments.map(a => [a.id, a.reasonForVisit])),
    };
  }

  private toEncounter(row: EncounterWithRx, names: Names): Encounter {
    const addenda: EncounterAddendum[] = (JSON.parse(row.addendaJson) as Array<Record<string, string>>).map(a => ({
      addedBy: a['addedBy'],
      addedByName: names.staff.get(a['addedBy']),
      addedAt: new Date(a['addedAt']),
      content: a['content'],
    }));
    const vitals: VitalMeasurement[] = (JSON.parse(row.vitalsJson) as Array<Record<string, unknown>>).map(v => ({
      ...(v as unknown as VitalMeasurement),
      recordedAt: new Date(v['recordedAt'] as string),
    }));
    const patient = names.patients.get(row.patientId);

    return {
      id: row.id as EncounterId,
      appointmentId: row.appointmentId,
      patientId: row.patientId,
      providerId: row.providerId,
      templateId: row.templateId as TemplateId | null,
      status: row.status as EncounterStatus,
      vitals,
      note: mergeNote(emptySoapNote(), JSON.parse(row.noteJson)),
      serviceCodes: JSON.parse(row.serviceCodesJson),
      prescriptions: [...row.prescriptions]
        .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime())
        .map(p => this.toPrescription(p, names.staff)),
      addenda,
      signedBy: row.signedBy,
      signedAt: row.signedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      patientName: patient?.name,
      patientMrn: patient?.mrn,
      providerName: names.staff.get(row.providerId),
      signedByName: row.signedBy ? names.staff.get(row.signedBy) : undefined,
      reasonForVisit: row.appointmentId ? names.reasons.get(row.appointmentId) ?? null : null,
    };
  }

  private toPrescription(row: PrescriptionRow, staff: Map<string, string>): Prescription {
    return {
      id: row.id as PrescriptionId,
      patientId: row.patientId,
      encounterId: row.encounterId as EncounterId,
      prescriberId: row.prescriberId,
      prescriberName: staff.get(row.prescriberId),
      drug: JSON.parse(row.drugJson),
      refillsAllowed: row.refillsAllowed,
      refillsRemaining: row.refillsRemaining,
      instructions: row.instructions,
      drugInteractionCheckPassed: row.drugInteractionCheckPassed,
      allergyCheckPassed: row.allergyCheckPassed,
      status: row.status as PrescriptionStatus,
      issuedAt: row.issuedAt,
      pharmacyNotes: row.pharmacyNotes,
    };
  }

  private toTemplate(row: TemplateRow): EncounterTemplate {
    return {
      id: row.id as TemplateId,
      name: row.name,
      specialty: row.specialty,
      defaultNote: JSON.parse(row.defaultNoteJson),
      defaultCptCodes: JSON.parse(row.defaultCptCodesJson),
      createdBy: row.createdBy,
      isShared: row.isShared,
      isActive: row.isActive,
    };
  }
}
