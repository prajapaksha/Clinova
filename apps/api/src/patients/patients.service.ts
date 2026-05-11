import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Patient as PrismaPatient } from '@prisma/client';
import type {
  Allergy,
  AllergyId,
  BloodType,
  ContactInfo,
  DocumentId,
  GenderIdentity,
  InsurancePolicy,
  MaritalStatus,
  MRN,
  Patient,
  PatientAlert,
  PatientConsent,
  PatientDocument,
  PatientId,
  Sex,
} from '@clinova/patient/domain';
import { AlertSeverity, AllergyType } from '@clinova/patient/domain';
import { CreatePatientDto } from './dto/create-patient.dto';
import { randomUUID } from 'crypto';

function toPatient(row: PrismaPatient): Patient {
  const contact: ContactInfo = JSON.parse(row.contactJson);
  const consentRaw = JSON.parse(row.consentJson);
  const consent: PatientConsent = {
    ...consentRaw,
    privacyPolicySignedAt: consentRaw.privacyPolicySignedAt
      ? new Date(consentRaw.privacyPolicySignedAt)
      : null,
    releaseOfInfoAuthorizations: consentRaw.releaseOfInfoAuthorizations ?? [],
  };

  const allergiesRaw: any[] = JSON.parse(row.allergiesJson);
  const allergies: Allergy[] = allergiesRaw.map((a) => ({
    ...a,
    onsetDate: a.onsetDate ? new Date(a.onsetDate) : null,
  }));

  const insuranceRaw: any[] = JSON.parse(row.insurancePoliciesJson);
  const insurancePolicies: InsurancePolicy[] = insuranceRaw.map((i) => ({
    ...i,
    subscriberDob: i.subscriberDob ? new Date(i.subscriberDob) : null,
    effectiveDate: new Date(i.effectiveDate),
    expirationDate: i.expirationDate ? new Date(i.expirationDate) : null,
  }));

  const docsRaw: any[] = JSON.parse(row.documentsJson);
  const documents: PatientDocument[] = docsRaw.map((d) => ({
    ...d,
    uploadedAt: new Date(d.uploadedAt),
  }));

  const alertsRaw: any[] = JSON.parse(row.alertsJson);
  const alerts: PatientAlert[] = alertsRaw.map((a) => ({
    ...a,
    createdAt: new Date(a.createdAt),
  }));

  return {
    id: row.id as PatientId,
    mrn: row.mrn as MRN,
    title: row.title ?? null,
    firstName: row.firstName,
    middleName: row.middleName ?? null,
    lastName: row.lastName,
    preferredName: row.preferredName ?? null,
    dateOfBirth: row.dateOfBirth,
    sex: row.sex as Sex,
    genderIdentity: (row.genderIdentity as GenderIdentity) ?? null,
    pronouns: row.pronouns ?? null,
    photoUrl: row.photoUrl ?? null,
    contact,
    emergencyContacts: JSON.parse(row.emergencyContactsJson),
    bloodType: row.bloodType as BloodType,
    heightCm: row.heightCm ?? null,
    weightKg: row.weightKg ?? null,
    allergies,
    chronicConditions: JSON.parse(row.chronicConditionsJson),
    currentMedications: JSON.parse(row.currentMedicationsJson),
    pastSurgeries: JSON.parse(row.pastSurgeriesJson),
    familyHistory: JSON.parse(row.familyHistoryJson),
    immunizationLog: JSON.parse(row.immunizationLogJson),
    insurancePolicies,
    documents,
    alerts,
    consent,
    maritalStatus: (row.maritalStatus as MaritalStatus) ?? null,
    occupation: row.occupation ?? null,
    preferredLanguage: row.preferredLanguage,
    ethnicity: row.ethnicity ?? null,
    isVip: row.isVip,
    isArchived: row.isArchived,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildContactJson(dto: CreatePatientDto['contact']): string {
  return JSON.stringify({
    primaryPhone: dto.primaryPhone,
    secondaryPhone: dto.secondaryPhone ?? null,
    email: dto.email ?? null,
    preferredMethod: dto.preferredMethod ?? 'PHONE',
    mailingAddress: {
      street1: dto.mailingAddress.street1,
      street2: dto.mailingAddress.street2 ?? null,
      city: dto.mailingAddress.city,
      state: dto.mailingAddress.state,
      postalCode: dto.mailingAddress.postalCode,
      country: dto.mailingAddress.country ?? 'US',
    },
    billingAddress: dto.billingAddress
      ? {
          street1: dto.billingAddress.street1,
          street2: dto.billingAddress.street2 ?? null,
          city: dto.billingAddress.city,
          state: dto.billingAddress.state,
          postalCode: dto.billingAddress.postalCode,
          country: dto.billingAddress.country ?? 'US',
        }
      : null,
  });
}

function buildInsuranceJson(policies: CreatePatientDto['insurancePolicies']): string {
  if (!policies?.length) return '[]';
  return JSON.stringify(
    policies.map((p) => ({
      id: randomUUID(),
      isPrimary: p.isPrimary,
      provider: p.provider,
      policyNumber: p.policyNumber,
      groupNumber: p.groupNumber ?? null,
      subscriberName: p.subscriberName,
      subscriberDob: p.subscriberDob ?? null,
      relationship: p.relationship,
      effectiveDate: p.effectiveDate,
      expirationDate: p.expirationDate ?? null,
      copayAmountCents: p.copayAmountCents ?? null,
      deductibleAmountCents: p.deductibleAmountCents ?? null,
    })),
  );
}

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(filters: {
    query?: string;
    isArchived?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ patients: Patient[]; total: number }> {
    const isArchived = filters.isArchived ?? false;
    const where = filters.query
      ? {
          isArchived,
          OR: [
            { firstName: { contains: filters.query } },
            { lastName: { contains: filters.query } },
            { mrn: { contains: filters.query } },
          ],
        }
      : { isArchived };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { patients: rows.map(toPatient), total };
  }

  async findById(id: string): Promise<Patient> {
    const row = await this.prisma.patient.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Patient ${id} not found`);
    return toPatient(row);
  }

  async findByMrn(mrn: string): Promise<Patient> {
    const row = await this.prisma.patient.findUnique({ where: { mrn } });
    if (!row) throw new NotFoundException(`Patient with MRN ${mrn} not found`);
    return toPatient(row);
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    const mrn = await this.generateMrn();
    const consentJson = JSON.stringify({
      privacyPolicySignedAt: dto.consent.privacyPolicySignedAt ?? null,
      marketingConsent: dto.consent.marketingConsent,
      telehealthConsent: dto.consent.telehealthConsent,
      releaseOfInfoAuthorizations: [],
    });

    const emergencyContactsJson = JSON.stringify(
      dto.emergencyContacts?.map((ec) => ({
        name: ec.name,
        relationship: ec.relationship,
        phone: ec.phone,
      })) ?? [],
    );

    const row = await this.prisma.patient.create({
      data: {
        mrn,
        title: dto.title ?? null,
        firstName: dto.firstName,
        middleName: dto.middleName ?? null,
        lastName: dto.lastName,
        preferredName: dto.preferredName ?? null,
        dateOfBirth: new Date(dto.dateOfBirth),
        sex: dto.sex,
        genderIdentity: dto.genderIdentity ?? null,
        pronouns: dto.pronouns ?? null,
        preferredLanguage: dto.preferredLanguage ?? 'English',
        maritalStatus: dto.maritalStatus ?? null,
        occupation: dto.occupation ?? null,
        ethnicity: dto.ethnicity ?? null,
        bloodType: dto.bloodType ?? 'UNKNOWN',
        contactJson: buildContactJson(dto.contact),
        emergencyContactsJson,
        insurancePoliciesJson: buildInsuranceJson(dto.insurancePolicies),
        consentJson,
      },
    });

    return toPatient(row);
  }

  async update(id: string, updates: Record<string, unknown>): Promise<Patient> {
    const existing = await this.prisma.patient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Patient ${id} not found`);

    const data: Record<string, unknown> = {};
    const scalarFields = [
      'title', 'firstName', 'middleName', 'lastName', 'preferredName',
      'pronouns', 'sex', 'genderIdentity', 'maritalStatus', 'occupation',
      'preferredLanguage', 'ethnicity', 'bloodType', 'heightCm', 'weightKg',
      'photoUrl', 'isVip',
    ];
    for (const field of scalarFields) {
      if (field in updates) data[field] = updates[field];
    }
    if ('dateOfBirth' in updates) data['dateOfBirth'] = new Date(updates['dateOfBirth'] as string);
    if ('contact' in updates) data['contactJson'] = JSON.stringify(updates['contact']);
    if ('emergencyContacts' in updates) data['emergencyContactsJson'] = JSON.stringify(updates['emergencyContacts']);
    if ('insurancePolicies' in updates) data['insurancePoliciesJson'] = JSON.stringify(updates['insurancePolicies']);
    if ('consent' in updates) data['consentJson'] = JSON.stringify(updates['consent']);
    if ('chronicConditions' in updates) data['chronicConditionsJson'] = JSON.stringify(updates['chronicConditions']);
    if ('currentMedications' in updates) data['currentMedicationsJson'] = JSON.stringify(updates['currentMedications']);

    const row = await this.prisma.patient.update({ where: { id }, data });
    return toPatient(row);
  }

  async archive(id: string, archivedBy: string): Promise<void> {
    const existing = await this.prisma.patient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Patient ${id} not found`);
    void archivedBy;
    await this.prisma.patient.update({
      where: { id },
      data: { isArchived: true, archivedAt: new Date() },
    });
  }

  async addAllergy(
    patientId: string,
    allergyData: {
      type: string;
      allergen: string;
      reaction: string;
      severity: string;
      onsetDate?: string;
      notes?: string;
    },
  ): Promise<Allergy> {
    const row = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);

    const allergies: Allergy[] = JSON.parse(row.allergiesJson);
    const newAllergy: Allergy = {
      id: randomUUID() as AllergyId,
      type: allergyData.type as AllergyType,
      allergen: allergyData.allergen,
      reaction: allergyData.reaction,
      severity: allergyData.severity as AlertSeverity,
      onsetDate: allergyData.onsetDate ? new Date(allergyData.onsetDate) : null,
      notes: allergyData.notes ?? null,
    };
    allergies.push(newAllergy);

    await this.prisma.patient.update({
      where: { id: patientId },
      data: { allergiesJson: JSON.stringify(allergies) },
    });

    return newAllergy;
  }

  async removeAllergy(patientId: string, allergyId: string): Promise<void> {
    const row = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);

    const allergies: Allergy[] = JSON.parse(row.allergiesJson);
    const filtered = allergies.filter((a) => a.id !== allergyId);
    await this.prisma.patient.update({
      where: { id: patientId },
      data: { allergiesJson: JSON.stringify(filtered) },
    });
  }

  async addDocument(
    patientId: string,
    docData: {
      category: string;
      name: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
      uploadedBy: string;
    },
  ): Promise<PatientDocument> {
    const row = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);

    const docs: PatientDocument[] = JSON.parse(row.documentsJson);
    const newDoc: PatientDocument = {
      id: randomUUID() as DocumentId,
      patientId: patientId as PatientId,
      category: docData.category as any,
      name: docData.name,
      storageKey: docData.storageKey,
      mimeType: docData.mimeType,
      sizeBytes: docData.sizeBytes,
      uploadedBy: docData.uploadedBy,
      uploadedAt: new Date(),
    };
    docs.push(newDoc);

    await this.prisma.patient.update({
      where: { id: patientId },
      data: { documentsJson: JSON.stringify(docs) },
    });

    return newDoc;
  }

  async removeDocument(patientId: string, documentId: string): Promise<void> {
    const row = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!row) throw new NotFoundException(`Patient ${patientId} not found`);

    const docs: PatientDocument[] = JSON.parse(row.documentsJson);
    const filtered = docs.filter((d) => d.id !== documentId);
    await this.prisma.patient.update({
      where: { id: patientId },
      data: { documentsJson: JSON.stringify(filtered) },
    });
  }

  private async generateMrn(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.patient.count();
    return `CLV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
