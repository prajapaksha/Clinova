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
  readonly prescriberName?: string;
}

// ── Medication safety ─────────────────────────────────────────────────────────
export type InteractionSeverity = 'MAJOR' | 'MODERATE' | 'MINOR';

export interface AllergyAlert {
  readonly allergen: string;
  readonly severity: string;
  readonly reaction: string;
  readonly reason: string;
}

export interface InteractionAlert {
  readonly withMedication: string;
  readonly severity: InteractionSeverity;
  readonly message: string;
}

export interface PrescriptionSafetyCheck {
  readonly allergyAlerts: ReadonlyArray<AllergyAlert>;
  readonly interactionAlerts: ReadonlyArray<InteractionAlert>;
}

export interface DrugCatalogEntry {
  readonly name: string;
  readonly form: string;
  readonly strength: string;
  readonly route: string;
}

/** Signing locks the note; only these statuses accept edits. */
export const EDITABLE_ENCOUNTER_STATUSES: ReadonlyArray<EncounterStatus> = [
  EncounterStatus.Draft,
  EncounterStatus.InProgress,
];

export function isEncounterEditable(status: EncounterStatus): boolean {
  return EDITABLE_ENCOUNTER_STATUSES.includes(status);
}

export function emptySoapNote(): SoapNote {
  return {
    subjective: { chiefComplaint: '', historyOfPresentIllness: '', reviewOfSystems: null },
    objective: { physicalExamFindings: null, relevantResults: null },
    assessment: { diagnoses: [], clinicalReasoning: null },
    plan: { treatmentPlan: '', patientInstructions: null, followUpInstructions: null, ordersNotes: null },
  };
}

/** Returns the reasons a note cannot be signed yet (empty when it is ready). */
export function signingBlockers(note: SoapNote): string[] {
  const blockers: string[] = [];
  if (!note.subjective.chiefComplaint.trim()) blockers.push('Chief complaint is required.');
  if (note.assessment.diagnoses.length === 0) blockers.push('At least one diagnosis is required.');
  return blockers;
}

// ── Vitals ────────────────────────────────────────────────────────────────────
export const VITAL_UNITS: Readonly<Record<VitalType, string>> = {
  [VitalType.BloodPressureSystolic]: 'mmHg',
  [VitalType.BloodPressureDiastolic]: 'mmHg',
  [VitalType.HeartRate]: 'bpm',
  [VitalType.Temperature]: '°F',
  [VitalType.RespiratoryRate]: '/min',
  [VitalType.OxygenSaturation]: '%',
  [VitalType.WeightKg]: 'kg',
  [VitalType.HeightCm]: 'cm',
  [VitalType.BMI]: 'kg/m²',
  [VitalType.PainScale]: '/10',
};

export type VitalsRecord = Partial<Record<VitalType, number>>;

/** Body-mass index rounded to one decimal, or null when inputs are missing. */
export function computeBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function vitalsToRecord(vitals: ReadonlyArray<Pick<VitalMeasurement, 'type' | 'value'>>): VitalsRecord {
  return vitals.reduce<VitalsRecord>((acc, v) => ({ ...acc, [v.type]: v.value }), {});
}

/** Converts form values to measurements, dropping empties and deriving BMI from height/weight. */
export function recordToVitals(record: VitalsRecord): Array<{ type: VitalType; value: number; unit: string }> {
  const bmi = computeBmi(record[VitalType.WeightKg], record[VitalType.HeightCm]);
  const withBmi: VitalsRecord = { ...record, [VitalType.BMI]: bmi ?? undefined };
  return (Object.values(VitalType) as VitalType[])
    .filter(type => typeof withBmi[type] === 'number' && Number.isFinite(withBmi[type]))
    .map(type => ({ type, value: withBmi[type] as number, unit: VITAL_UNITS[type] }));
}

export function formatBloodPressure(vitals: VitalsRecord): string | null {
  const sys = vitals[VitalType.BloodPressureSystolic];
  const dia = vitals[VitalType.BloodPressureDiastolic];
  return sys && dia ? `${sys}/${dia}` : null;
}

export interface EncounterAddendum {
  readonly addedBy: string;
  readonly addedByName?: string;
  readonly addedAt: Date;
  readonly content: string;
}

/** Encounter aggregate root */
export interface Encounter {
  readonly id: EncounterId;
  /** Null for walk-in encounters started without an appointment. */
  readonly appointmentId: string | null;
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

  // Read-model enrichment (populated by API)
  readonly patientName?: string;
  readonly patientMrn?: string;
  readonly providerName?: string;
  readonly signedByName?: string;
  readonly reasonForVisit?: string | null;
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
