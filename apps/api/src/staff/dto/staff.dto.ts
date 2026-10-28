import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { STAFF_ROLES } from '@clinova/identity/domain';
import { CredentialType } from '@clinova/staff/domain';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateStaffDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsIn([...STAFF_ROLES]) role!: string;
  @IsOptional() @IsString() @MaxLength(20) title?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  /** Generated (and returned once) when omitted. */
  @IsOptional() @IsString() @MaxLength(200) temporaryPassword?: string;
}

export class UpdateStaffProfileDto {
  @IsOptional() @IsString() @MaxLength(20) title?: string | null;
  @IsOptional() @IsString() @MaxLength(20) suffix?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(120) officeLocation?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== '' && v !== null) @Matches(/^\d{10}$/, { message: 'NPI must be 10 digits' }) npi?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) specialties?: string[];
  @IsOptional() @IsString() @MaxLength(2000) bio?: string | null;
}

export class UpdateAccountDto {
  @IsOptional() @IsIn([...STAFF_ROLES]) role?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TimeRangeDto {
  @Matches(TIME) start!: string;
  @Matches(TIME) end!: string;
}

export class DayScheduleDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsBoolean() isWorking!: boolean;
  @IsOptional() @ValidateNested() @Type(() => TimeRangeDto) hours!: TimeRangeDto | null;
  @IsOptional() @ValidateNested() @Type(() => TimeRangeDto) lunchBreak!: TimeRangeDto | null;
}

export class UpdateScheduleDto {
  @IsArray() @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => DayScheduleDto)
  schedule!: DayScheduleDto[];
}

export class CredentialDto {
  @IsIn(Object.values(CredentialType)) type!: CredentialType;
  @IsString() @MinLength(1) @MaxLength(60) number!: string;
  @IsOptional() @IsString() @MaxLength(40) issuingState?: string | null;
  @IsOptional() @IsString() @MaxLength(120) issuingAuthority?: string | null;
  @IsOptional() @IsDateString() issueDate?: string | null;
  @IsOptional() @IsDateString() expirationDate?: string | null;
  @IsOptional() @IsBoolean() isVerified?: boolean;
}