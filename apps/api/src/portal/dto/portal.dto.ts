import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ThreadCategory } from '@clinova/portal/domain';

// ── Auth ──────────────────────────────────────────────────────────────────────
export class PortalLoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}

export class PortalRegisterDto {
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' }) dateOfBirth!: string;
  @IsEmail() email!: string;
  @IsString() @MaxLength(200) password!: string;
}

export class PortalActivateDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(4) @MaxLength(20) code!: string;
  @IsString() @MaxLength(200) password!: string;
}

export class ForgotPasswordDto {
  @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
  @IsString() @MaxLength(200) password!: string;
}

export class PortalChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
  @IsString() @MaxLength(200) newPassword!: string;
}

export class InviteDto {
  /** Defaults to the email in the patient's contact details. */
  @IsOptional() @IsEmail() email?: string;
}

// ── Scheduling ────────────────────────────────────────────────────────────────
export class BookDto {
  @IsString() providerId!: string;
  @IsString() appointmentTypeId!: string;
  @IsDateString() start!: string;
  @IsOptional() @IsString() @MaxLength(500) reasonForVisit?: string;
  @Type(() => Number) @IsInt() @Min(-840) @Max(840) tzOffset!: number;
}

export class RescheduleDto {
  @IsDateString() start!: string;
  @Type(() => Number) @IsInt() @Min(-840) @Max(840) tzOffset!: number;
}

export class PortalCancelDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// ── Billing ───────────────────────────────────────────────────────────────────
export class CardDto {
  @Matches(/^[\d ]{13,23}$/, { message: 'Enter a valid card number' }) number!: string;
  @IsInt() @Min(1) @Max(12) expMonth!: number;
  @IsInt() @Min(2000) @Max(2100) expYear!: number;
  @Matches(/^\d{3,4}$/, { message: 'Enter the 3 or 4 digit security code' }) cvc!: string;
  @IsString() @MinLength(2) @MaxLength(100) cardholderName!: string;
}

export class SaveCardDto extends CardDto {
  @IsOptional() @IsBoolean() makeDefault?: boolean;
}

export class PortalPayDto {
  @IsInt() @Min(1) amountCents!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) invoiceIds?: string[];
  /** Pay with a saved card… */
  @IsOptional() @IsString() savedCardId?: string;
  /** …or a new card. */
  @IsOptional() @ValidateNested() @Type(() => CardDto) card?: CardDto;
  @IsOptional() @IsBoolean() saveCard?: boolean;
}

// ── Messages & requests ───────────────────────────────────────────────────────
export class NewThreadDto {
  @IsString() @MinLength(1) @MaxLength(150) subject!: string;
  @IsIn(Object.values(ThreadCategory)) category!: ThreadCategory;
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}

export class ReplyDto {
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}

export class ThreadStatusDto {
  @IsIn(['OPEN', 'CLOSED']) status!: 'OPEN' | 'CLOSED';
}

export class RefillRequestDto {
  @IsString() prescriptionId!: string;
  @IsOptional() @IsString() @MaxLength(200) pharmacy?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class RefillResponseDto {
  @IsIn(['APPROVED', 'DENIED']) decision!: 'APPROVED' | 'DENIED';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ProfileChangeDto {
  @IsOptional() @IsString() @MaxLength(80) preferredName?: string | null;
  @IsOptional() @IsString() @MaxLength(40) pronouns?: string | null;
  @IsOptional() @IsString() @MaxLength(40) preferredLanguage?: string;
  @IsOptional() @IsObject() contact?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(5) emergencyContacts?: Array<Record<string, unknown>>;
  @IsOptional() @IsArray() @ArrayMaxSize(3) insurancePolicies?: Array<Record<string, unknown>>;
}

export class ReviewChangeDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class PreferencesDto {
  @IsObject() preferences!: Record<string, Record<string, boolean>>;
}
