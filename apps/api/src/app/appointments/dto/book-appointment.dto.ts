import { IsString, IsOptional, IsDateString } from 'class-validator';

export class BookAppointmentDto {
  @IsString() patientId!: string;
  @IsString() providerId!: string;
  @IsOptional() @IsString() locationId?: string;
  @IsString() appointmentTypeId!: string;
  @IsDateString() slotStart!: string;
  @IsDateString() slotEnd!: string;
  @IsOptional() @IsString() reasonForVisit?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() slotStart?: string;
  @IsOptional() @IsDateString() slotEnd?: string;
  @IsOptional() @IsString() reasonForVisit?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() cancellationReason?: string;
  @IsOptional() @IsString() cancellationNote?: string;
}

export class CancelAppointmentDto {
  @IsString() reason!: string;
  @IsOptional() @IsString() note?: string;
}
