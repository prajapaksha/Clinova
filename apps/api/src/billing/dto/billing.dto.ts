import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AdjustmentType, ClaimStatus, PaymentMethod } from '@clinova/billing/domain';

const MAX_CENTS = 10_000_000; // $100,000 per line/payment

export class InvoiceLineInputDto {
  @IsString() @MinLength(1) @MaxLength(20) serviceCode!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
  /** Defaults to the fee-schedule price for the code. */
  @IsOptional() @IsInt() @Min(0) @Max(MAX_CENTS) unitPriceCents?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateInvoiceDto {
  @IsString() patientId!: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsDateString() serviceDate?: string;
  @IsOptional() @IsString() feeScheduleId?: string;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => InvoiceLineInputDto)
  lines!: InvoiceLineInputDto[];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateDraftDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => InvoiceLineInputDto)
  lines?: InvoiceLineInputDto[];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class VoidDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class AdjustmentDto {
  @IsIn(Object.values(AdjustmentType)) type!: AdjustmentType;
  @IsInt() @Min(1) @Max(MAX_CENTS) amountCents!: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class TakePaymentDto {
  @IsString() patientId!: string;
  @IsInt() @Min(1) @Max(MAX_CENTS) amountCents!: number;
  @IsIn(Object.values(PaymentMethod).filter(m => m !== PaymentMethod.Insurance)) method!: PaymentMethod;
  /** Invoices to pay, in order. Defaults to all open invoices, oldest first. */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) invoiceIds?: string[];
  @IsOptional() @IsString() @MaxLength(100) referenceNumber?: string;
  @IsOptional() @IsString() @MaxLength(50) checkNumber?: string;
  @IsOptional() @IsEmail() receiptEmail?: string;
}

export class CreateClaimDto {
  @IsString() invoiceId!: string;
  /** Defaults to the patient's primary policy. */
  @IsOptional() @IsString() insurancePolicyId?: string;
}

export class UpdateClaimDto {
  @IsIn(Object.values(ClaimStatus)) status!: ClaimStatus;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_CENTS) paidAmountCents?: number;
  /** Payer's contractual write-down, applied when the claim is paid. */
  @IsOptional() @IsInt() @Min(0) @Max(MAX_CENTS) contractualAdjustmentCents?: number;
  @IsOptional() @IsString() @MaxLength(1000) denialReason?: string;
  @IsOptional() @IsString() @MaxLength(1000) appealNote?: string;
}

export class FeeScheduleLineDto {
  @IsString() @MinLength(1) @MaxLength(20) cptCode!: string;
  @IsString() @MinLength(1) @MaxLength(300) description!: string;
  @IsInt() @Min(0) @Max(MAX_CENTS) priceCents!: number;
}

export class SaveFeeScheduleDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => FeeScheduleLineDto)
  lines!: FeeScheduleLineDto[];
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
