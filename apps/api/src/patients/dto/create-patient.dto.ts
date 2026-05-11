import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum SexDto {
  Male = 'MALE',
  Female = 'FEMALE',
  Intersex = 'INTERSEX',
  Unknown = 'UNKNOWN',
}

export enum BloodTypeDto {
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

export enum MaritalStatusDto {
  Single = 'SINGLE',
  Married = 'MARRIED',
  Divorced = 'DIVORCED',
  Widowed = 'WIDOWED',
  Separated = 'SEPARATED',
  DomesticPartner = 'DOMESTIC_PARTNER',
  Other = 'OTHER',
}

export enum ContactMethodDto {
  Phone = 'PHONE',
  Email = 'EMAIL',
  SMS = 'SMS',
  PatientPortal = 'PATIENT_PORTAL',
}

export enum InsuranceRelationshipDto {
  Self = 'SELF',
  Spouse = 'SPOUSE',
  Child = 'CHILD',
  Other = 'OTHER',
}

export class AddressDto {
  @IsString() @IsNotEmpty() street1!: string;
  @IsOptional() @IsString() street2?: string;
  @IsString() @IsNotEmpty() city!: string;
  @IsString() @IsNotEmpty() state!: string;
  @IsString() @IsNotEmpty() postalCode!: string;
  @IsString() country = 'US';
}

export class ContactInfoDto {
  @IsString() @IsNotEmpty() primaryPhone!: string;
  @IsOptional() @IsString() secondaryPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsEnum(ContactMethodDto) preferredMethod: ContactMethodDto = ContactMethodDto.Phone;
  @ValidateNested() @Type(() => AddressDto) mailingAddress!: AddressDto;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) billingAddress?: AddressDto;
}

export class EmergencyContactDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() relationship!: string;
  @IsString() @IsNotEmpty() phone!: string;
}

export class InsurancePolicyDto {
  @IsBoolean() isPrimary!: boolean;
  @IsString() @IsNotEmpty() provider!: string;
  @IsString() @IsNotEmpty() policyNumber!: string;
  @IsOptional() @IsString() groupNumber?: string;
  @IsString() @IsNotEmpty() subscriberName!: string;
  @IsOptional() @IsDateString() subscriberDob?: string;
  @IsEnum(InsuranceRelationshipDto) relationship!: InsuranceRelationshipDto;
  @IsDateString() effectiveDate!: string;
  @IsOptional() @IsDateString() expirationDate?: string;
  @IsOptional() @IsNumber() @Min(0) copayAmountCents?: number;
  @IsOptional() @IsNumber() @Min(0) deductibleAmountCents?: number;
}

export class ConsentDto {
  @IsOptional() @IsDateString() privacyPolicySignedAt?: string;
  @IsBoolean() marketingConsent!: boolean;
  @IsBoolean() telehealthConsent!: boolean;
}

export class CreatePatientDto {
  @IsOptional() @IsString() title?: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsOptional() @IsString() middleName?: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsOptional() @IsString() preferredName?: string;
  @IsDateString() dateOfBirth!: string;
  @IsEnum(SexDto) sex!: SexDto;
  @IsOptional() @IsString() genderIdentity?: string;
  @IsOptional() @IsString() pronouns?: string;
  @IsOptional() @IsString() preferredLanguage?: string;
  @IsOptional() @IsEnum(MaritalStatusDto) maritalStatus?: MaritalStatusDto;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsEnum(BloodTypeDto) bloodType?: BloodTypeDto;

  @ValidateNested() @Type(() => ContactInfoDto) contact!: ContactInfoDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InsurancePolicyDto)
  insurancePolicies?: InsurancePolicyDto[];

  @ValidateNested() @Type(() => ConsentDto) consent!: ConsentDto;
}
