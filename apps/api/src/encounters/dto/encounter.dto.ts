import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const VITAL_TYPES = [
  'BP_SYSTOLIC', 'BP_DIASTOLIC', 'HEART_RATE', 'TEMPERATURE', 'RESPIRATORY_RATE',
  'OXYGEN_SATURATION', 'WEIGHT_KG', 'HEIGHT_CM', 'BMI', 'PAIN_SCALE',
] as const;

export const EDITABLE_STATUSES = ['DRAFT', 'IN_PROGRESS'] as const;
export const PRESCRIPTION_STATUSES = ['ACTIVE', 'COMPLETED', 'DISCONTINUED', 'ON_HOLD'] as const;

export class StartEncounterDto {
  @IsString() patientId!: string;
  @IsOptional() @IsString() appointmentId?: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsString() templateId?: string;
}

export class Icd10CodeDto {
  @IsString() @MaxLength(10) code!: string;
  @IsString() @MaxLength(300) description!: string;
}

export class DiagnosisDto {
  @ValidateNested() @Type(() => Icd10CodeDto) code!: Icd10CodeDto;
  @IsBoolean() isPrimary!: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

export class SubjectiveDto {
  @IsOptional() @IsString() @MaxLength(2000) chiefComplaint?: string;
  @IsOptional() @IsString() @MaxLength(20000) historyOfPresentIllness?: string;
  @IsOptional() @IsString() @MaxLength(20000) reviewOfSystems?: string | null;
}

export class ObjectiveDto {
  @IsOptional() @IsString() @MaxLength(20000) physicalExamFindings?: string | null;
  @IsOptional() @IsString() @MaxLength(20000) relevantResults?: string | null;
}

export class AssessmentDto {
  @IsOptional() @IsArray() @ArrayMaxSize(25) @ValidateNested({ each: true }) @Type(() => DiagnosisDto)
  diagnoses?: DiagnosisDto[];
  @IsOptional() @IsString() @MaxLength(20000) clinicalReasoning?: string | null;
}

export class PlanDto {
  @IsOptional() @IsString() @MaxLength(20000) treatmentPlan?: string;
  @IsOptional() @IsString() @MaxLength(20000) patientInstructions?: string | null;
  @IsOptional() @IsString() @MaxLength(20000) followUpInstructions?: string | null;
  @IsOptional() @IsString() @MaxLength(20000) ordersNotes?: string | null;
}

export class NotePatchDto {
  @IsOptional() @ValidateNested() @Type(() => SubjectiveDto) subjective?: SubjectiveDto;
  @IsOptional() @ValidateNested() @Type(() => ObjectiveDto) objective?: ObjectiveDto;
  @IsOptional() @ValidateNested() @Type(() => AssessmentDto) assessment?: AssessmentDto;
  @IsOptional() @ValidateNested() @Type(() => PlanDto) plan?: PlanDto;
}

export class VitalDto {
  @IsIn(VITAL_TYPES) type!: (typeof VITAL_TYPES)[number];
  @IsNumber() value!: number;
  @IsString() @MaxLength(20) unit!: string;
  @IsOptional() @IsDateString() recordedAt?: string;
}

export class UpdateEncounterDto {
  @IsOptional() @ValidateNested() @Type(() => NotePatchDto) note?: NotePatchDto;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => VitalDto)
  vitals?: VitalDto[];
  @IsOptional() @IsIn(EDITABLE_STATUSES) status?: (typeof EDITABLE_STATUSES)[number];
}

export class AddendumDto {
  @IsString() @MinLength(1) @MaxLength(20000) content!: string;
}

export class DrugDoseDto {
  @IsString() @MinLength(1) @MaxLength(200) medicationName!: string;
  @IsString() @MaxLength(100) strength!: string;
  @IsString() @MaxLength(100) form!: string;
  @IsString() @MaxLength(100) route!: string;
  @IsString() @MaxLength(100) dosageAmount!: string;
  @IsString() @MaxLength(200) frequency!: string;
  @IsOptional() @IsInt() @Min(1) durationDays?: number | null;
}

export class IssuePrescriptionDto {
  @ValidateNested() @Type(() => DrugDoseDto) drug!: DrugDoseDto;
  @IsInt() @Min(0) refillsAllowed!: number;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
  @IsOptional() @IsString() @MaxLength(2000) pharmacyNotes?: string;
  /** Required to issue when the safety check raised allergy or interaction alerts. */
  @IsOptional() @IsBoolean() acknowledgeWarnings?: boolean;
}

export class UpdatePrescriptionDto {
  @IsOptional() @IsIn(PRESCRIPTION_STATUSES) status?: (typeof PRESCRIPTION_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(2000) pharmacyNotes?: string;
}

export class PrescriptionCheckDto {
  @IsString() patientId!: string;
  @IsString() @MinLength(1) medicationName!: string;
}

export class CreateTemplateDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) specialty?: string;
  @IsObject() @ValidateNested() @Type(() => NotePatchDto) defaultNote!: NotePatchDto;
  @IsOptional() @IsBoolean() isShared?: boolean;
}
