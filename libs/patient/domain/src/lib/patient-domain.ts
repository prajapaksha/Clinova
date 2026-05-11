// ── Branded IDs ───────────────────────────────────────────────────────────────
export type PatientId = string & { readonly _brand: 'PatientId' };
export type MRN = string & { readonly _brand: 'MRN' };
export type AllergyId = string & { readonly _brand: 'AllergyId' };
export type InsurancePolicyId = string & { readonly _brand: 'InsurancePolicyId' };
export type DocumentId = string & { readonly _brand: 'DocumentId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum Sex {
  Male = 'MALE',
  Female = 'FEMALE',
  Intersex = 'INTERSEX',
  Unknown = 'UNKNOWN',
}

export enum GenderIdentity {
  Man = 'MAN',
  Woman = 'WOMAN',
  NonBinary = 'NON_BINARY',
  TransgenderMan = 'TRANSGENDER_MAN',
  TransgenderWoman = 'TRANSGENDER_WOMAN',
  GenderFluid = 'GENDER_FLUID',
  NotDisclosed = 'NOT_DISCLOSED',
  Other = 'OTHER',
}

export enum BloodType {
  APositive = 'A_POSITIVE',
  ANegative = 'A_NEGATIVE',
  BPositive = 'B_POSITIVE',
  BNegative = 'B_NEGATIVE',
  ABPositive = 'AB_POSITIVE',
  ABNegative = 'AB_NEGATIVE',
  OPositive = 'O_POSITIVE',
  ONegative = 'O_NEGATIVE',
  Unknown = 'UNKNOWN',
}

export enum AlertSeverity {
  Critical = 'CRITICAL',
  High = 'HIGH',
  Medium = 'MEDIUM',
  Low = 'LOW',
}

export enum AllergyType {
  Drug = 'DRUG',
  Food = 'FOOD',
  Environmental = 'ENVIRONMENTAL',
  Latex = 'LATEX',
  Other = 'OTHER',
}

export enum ContactMethod {
  Phone = 'PHONE',
  Email = 'EMAIL',
  SMS = 'SMS',
  PatientPortal = 'PATIENT_PORTAL',
}

export enum MaritalStatus {
  Single = 'SINGLE',
  Married = 'MARRIED',
  Divorced = 'DIVORCED',
  Widowed = 'WIDOWED',
  Separated = 'SEPARATED',
  DomesticPartner = 'DOMESTIC_PARTNER',
  Other = 'OTHER',
}

export enum InsuranceRelationship {
  Self = 'SELF',
  Spouse = 'SPOUSE',
  Child = 'CHILD',
  Other = 'OTHER',
}

export enum DocumentCategory {
  ConsentForm = 'CONSENT_FORM',
  LabReport = 'LAB_REPORT',
  Referral = 'REFERRAL',
  Imaging = 'IMAGING',
  PriorRecord = 'PRIOR_RECORD',
  Insurance = 'INSURANCE',
  Other = 'OTHER',
}

// ── Value Objects ─────────────────────────────────────────────────────────────
export interface Address {
  readonly street1: string;
  readonly street2: string | null;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
}

export interface ContactInfo {
  readonly primaryPhone: string;
  readonly secondaryPhone: string | null;
  readonly email: string | null;
  readonly preferredMethod: ContactMethod;
  readonly mailingAddress: Address;
  readonly billingAddress: Address | null;
}

// ── Entities ──────────────────────────────────────────────────────────────────
export interface EmergencyContact {
  readonly name: string;
  readonly relationship: string;
  readonly phone: string;
}

export interface Allergy {
  readonly id: AllergyId;
  readonly type: AllergyType;
  readonly allergen: string;
  readonly reaction: string;
  readonly severity: AlertSeverity;
  readonly onsetDate: Date | null;
  readonly notes: string | null;
}

export interface InsurancePolicy {
  readonly id: InsurancePolicyId;
  readonly isPrimary: boolean;
  readonly provider: string;
  readonly policyNumber: string;
  readonly groupNumber: string | null;
  readonly subscriberName: string;
  readonly subscriberDob: Date | null;
  readonly relationship: InsuranceRelationship;
  readonly effectiveDate: Date;
  readonly expirationDate: Date | null;
  readonly copayAmountCents: number | null;
  readonly deductibleAmountCents: number | null;
}

export interface PatientDocument {
  readonly id: DocumentId;
  readonly patientId: PatientId;
  readonly category: DocumentCategory;
  readonly name: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: string;
  readonly uploadedAt: Date;
}

export interface PatientAlert {
  readonly id: string;
  readonly severity: AlertSeverity;
  readonly message: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

export interface ReleaseAuthorization {
  readonly authorizedTo: string;
  readonly expiresAt: Date | null;
}

export interface PatientConsent {
  readonly privacyPolicySignedAt: Date | null;
  readonly marketingConsent: boolean;
  readonly telehealthConsent: boolean;
  readonly releaseOfInfoAuthorizations: ReadonlyArray<ReleaseAuthorization>;
}

/** Patient aggregate root */
export interface Patient {
  readonly id: PatientId;
  readonly mrn: MRN;
  readonly title: string | null;
  readonly firstName: string;
  readonly middleName: string | null;
  readonly lastName: string;
  readonly preferredName: string | null;
  readonly dateOfBirth: Date;
  readonly sex: Sex;
  readonly genderIdentity: GenderIdentity | null;
  readonly pronouns: string | null;
  readonly photoUrl: string | null;

  readonly contact: ContactInfo;
  readonly emergencyContacts: ReadonlyArray<EmergencyContact>;

  readonly bloodType: BloodType;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly allergies: ReadonlyArray<Allergy>;
  readonly chronicConditions: ReadonlyArray<string>;
  readonly currentMedications: ReadonlyArray<string>;
  readonly pastSurgeries: ReadonlyArray<string>;
  readonly familyHistory: ReadonlyArray<string>;
  readonly immunizationLog: ReadonlyArray<string>;

  readonly insurancePolicies: ReadonlyArray<InsurancePolicy>;
  readonly documents: ReadonlyArray<PatientDocument>;
  readonly alerts: ReadonlyArray<PatientAlert>;
  readonly consent: PatientConsent;

  readonly maritalStatus: MaritalStatus | null;
  readonly occupation: string | null;
  readonly preferredLanguage: string;
  readonly ethnicity: string | null;

  readonly isVip: boolean;
  readonly isArchived: boolean;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ── Domain Events ─────────────────────────────────────────────────────────────
export interface PatientRegisteredEvent {
  readonly type: 'patient.PatientRegistered';
  readonly patientId: PatientId;
  readonly mrn: MRN;
  readonly timestamp: Date;
}

export interface PatientArchivedEvent {
  readonly type: 'patient.PatientArchived';
  readonly patientId: PatientId;
  readonly archivedBy: string;
  readonly timestamp: Date;
}

export interface AllergyAddedEvent {
  readonly type: 'patient.AllergyAdded';
  readonly patientId: PatientId;
  readonly allergyId: AllergyId;
  readonly severity: AlertSeverity;
  readonly timestamp: Date;
}

export interface DocumentUploadedEvent {
  readonly type: 'patient.DocumentUploaded';
  readonly patientId: PatientId;
  readonly documentId: DocumentId;
  readonly category: DocumentCategory;
  readonly timestamp: Date;
}

export type PatientDomainEvent =
  | PatientRegisteredEvent
  | PatientArchivedEvent
  | AllergyAddedEvent
  | DocumentUploadedEvent;

// ── Repository Interfaces ─────────────────────────────────────────────────────
export interface PatientSearchFilters {
  query?: string;
  isArchived?: boolean;
  providerId?: string;
  limit?: number;
  offset?: number;
}

export interface PatientRepository {
  findById(id: PatientId): Promise<Patient | null>;
  findByMrn(mrn: MRN): Promise<Patient | null>;
  search(filters: PatientSearchFilters): Promise<{ patients: Patient[]; total: number }>;
  save(patient: Omit<Patient, 'id' | 'mrn' | 'createdAt' | 'updatedAt'>): Promise<Patient>;
  update(id: PatientId, updates: Partial<Omit<Patient, 'id' | 'mrn' | 'createdAt'>>): Promise<Patient>;
  archive(id: PatientId, archivedBy: string): Promise<void>;
  generateMrn(): Promise<MRN>;
}
