// ── Branded IDs ───────────────────────────────────────────────────────────────
export type EncounterId = string & { readonly _brand: 'EncounterId' };
export type PrescriptionId = string & { readonly _brand: 'PrescriptionId' };
export type TemplateId = string & { readonly _brand: 'TemplateId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum EncounterStatus {
  Draft = 'DRAFT',
  InProgress = 'IN_PROGRESS',
  Signed = 'SIGNED',
  Amended = 'AMENDED',
}

export enum VitalType {
  BloodPressureSystolic = 'BP_SYSTOLIC',
  BloodPressureDiastolic = 'BP_DIASTOLIC',
  HeartRate = 'HEART_RATE',
  Temperature = 'TEMPERATURE',
  RespiratoryRate = 'RESPIRATORY_RATE',
  OxygenSaturation = 'OXYGEN_SATURATION',
  WeightKg = 'WEIGHT_KG',
  HeightCm = 'HEIGHT_CM',
  BMI = 'BMI',
  PainScale = 'PAIN_SCALE',
}

export enum PrescriptionStatus {
  Active = 'ACTIVE',
  Completed = 'COMPLETED',
  Discontinued = 'DISCONTINUED',
  OnHold = 'ON_HOLD',
}

// ── Value Objects ─────────────────────────────────────────────────────────────
export interface ICD10Code {
  readonly code: string;
  readonly description: string;
}

export interface CPTCode {
  readonly code: string;
  readonly description: string;
}

export interface VitalMeasurement {
  readonly type: VitalType;
  readonly value: number;
  readonly unit: string;
  readonly recordedAt: Date;
  readonly recordedBy: string;
}

export interface DrugDose {
  readonly medicationName: string;
  readonly strength: string;
  readonly form: string;
  readonly route: string;
  readonly dosageAmount: string;
  readonly frequency: string;
  readonly durationDays: number | null;
}

// ── Entities ──────────────────────────────────────────────────────────────────
export interface SoapSubjective {
  readonly chiefComplaint: string;
  readonly historyOfPresentIllness: string;
  readonly reviewOfSystems: string | null;
}

export interface EncounterDiagnosis {
  readonly code: ICD10Code;
  readonly isPrimary: boolean;
  readonly notes: string | null;
}

export interface SoapObjective {
  readonly physicalExamFindings: string | null;
  readonly relevantResults: string | null;
}

export interface SoapAssessment {
  readonly diagnoses: ReadonlyArray<EncounterDiagnosis>;
  readonly clinicalReasoning: string | null;
}

export interface SoapPlan {
  readonly treatmentPlan: string;
  readonly patientInstructions: string | null;
  readonly followUpInstructions: string | null;
  readonly ordersNotes: string | null;
}

export interface SoapNote {
  readonly subjective: SoapSubjective;
  readonly objective: SoapObjective;
  readonly assessment: SoapAssessment;
  readonly plan: SoapPlan;
}

export interface Prescription {
  readonly id: PrescriptionId;
  readonly patientId: string;
  readonly encounterId: EncounterId;
  readonly prescriberId: string;
  readonly drug: DrugDose;
  readonly refillsAllowed: number;
  readonly refillsRemaining: number;
  readonly instructions: string | null;
  readonly drugInteractionCheckPassed: boolean;
  readonly allergyCheckPassed: boolean;
  readonly status: PrescriptionStatus;
  readonly issuedAt: Date;
  readonly pharmacyNotes: string | null;
}

export interface EncounterAddendum {
  readonly addedBy: string;
  readonly addedAt: Date;
  readonly content: string;
}

/** Encounter aggregate root */
export interface Encounter {
  readonly id: EncounterId;
  readonly appointmentId: string;
  readonly patientId: string;
  readonly providerId: string;
  readonly templateId: TemplateId | null;
  readonly status: EncounterStatus;
  readonly vitals: ReadonlyArray<VitalMeasurement>;
  readonly note: SoapNote;
  readonly serviceCodes: ReadonlyArray<CPTCode>;
  readonly prescriptions: ReadonlyArray<Prescription>;
  readonly addenda: ReadonlyArray<EncounterAddendum>;
  readonly signedBy: string | null;
  readonly signedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EncounterTemplate {
  readonly id: TemplateId;
  readonly name: string;
  readonly specialty: string | null;
  readonly defaultNote: Partial<SoapNote>;
  readonly defaultCptCodes: ReadonlyArray<CPTCode>;
  readonly createdBy: string;
  readonly isShared: boolean;
  readonly isActive: boolean;
}

// ── Domain Events ─────────────────────────────────────────────────────────────
export interface EncounterStartedEvent {
  readonly type: 'clinical.EncounterStarted';
  readonly encounterId: EncounterId;
  readonly appointmentId: string;
  readonly patientId: string;
  readonly providerId: string;
  readonly timestamp: Date;
}

export interface VitalsRecordedEvent {
  readonly type: 'clinical.VitalsRecorded';
  readonly encounterId: EncounterId;
  readonly patientId: string;
  readonly vitals: ReadonlyArray<VitalMeasurement>;
  readonly timestamp: Date;
}

export interface EncounterSignedEvent {
  readonly type: 'clinical.EncounterSigned';
  readonly encounterId: EncounterId;
  readonly patientId: string;
  readonly providerId: string;
  readonly diagnoses: ReadonlyArray<ICD10Code>;
  readonly serviceCodes: ReadonlyArray<CPTCode>;
  readonly timestamp: Date;
}

export interface PrescriptionIssuedEvent {
  readonly type: 'clinical.PrescriptionIssued';
  readonly prescriptionId: PrescriptionId;
  readonly encounterId: EncounterId;
  readonly patientId: string;
  readonly medicationName: string;
  readonly timestamp: Date;
}

export type ClinicalDomainEvent =
  | EncounterStartedEvent
  | VitalsRecordedEvent
  | EncounterSignedEvent
  | PrescriptionIssuedEvent;

// ── Repository Interfaces ─────────────────────────────────────────────────────
export interface EncounterFilters {
  patientId?: string;
  providerId?: string;
  status?: EncounterStatus | EncounterStatus[];
  dateRange?: { from: Date; to: Date };
  limit?: number;
  offset?: number;
}

export interface EncounterRepository {
  findById(id: EncounterId): Promise<Encounter | null>;
  findByAppointment(appointmentId: string): Promise<Encounter | null>;
  findMany(filters: EncounterFilters): Promise<{ encounters: Encounter[]; total: number }>;
  save(encounter: Omit<Encounter, 'id' | 'createdAt' | 'updatedAt'>): Promise<Encounter>;
  update(id: EncounterId, updates: Partial<Omit<Encounter, 'id' | 'createdAt'>>): Promise<Encounter>;
  sign(id: EncounterId, signedBy: string): Promise<Encounter>;
}

export interface EncounterTemplateRepository {
  findById(id: TemplateId): Promise<EncounterTemplate | null>;
  findAll(filters?: { specialty?: string; isShared?: boolean; createdBy?: string }): Promise<EncounterTemplate[]>;
  save(template: Omit<EncounterTemplate, 'id'>): Promise<EncounterTemplate>;
  update(id: TemplateId, updates: Partial<Omit<EncounterTemplate, 'id'>>): Promise<EncounterTemplate>;
}
