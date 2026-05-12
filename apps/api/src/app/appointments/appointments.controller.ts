import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
  BookAppointmentDto,
  CancelAppointmentDto,
  UpdateAppointmentDto,
} from './dto/book-appointment.dto';

@ApiTags('appointments')
@Controller()
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('appointments')
  @ApiOperation({ summary: 'List appointments with optional filters' })
  findMany(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('providerId') providerId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string | string[],
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.appointments.findMany({
      from,
      to,
      providerId,
      patientId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('appointments/conflicts')
  @ApiOperation({ summary: 'Find conflicting appointments for a provider' })
  findConflicts(
    @Query('providerId') providerId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.appointments.findConflicts(
      providerId,
      new Date(start),
      new Date(end),
      excludeId,
    );
  }

  @Get('appointment-types')
  @ApiOperation({ summary: 'List appointment types' })
  findAllTypes(@Query('activeOnly') activeOnly?: string) {
    const onlyActive = activeOnly !== 'false';
    return this.appointments.findAllTypes(onlyActive);
  }

  @Get('appointments/:id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  findById(@Param('id') id: string) {
    return this.appointments.findById(id);
  }

  @Post('appointments')
  @ApiOperation({ summary: 'Book a new appointment' })
  create(@Body() dto: BookAppointmentDto) {
    return this.appointments.create(dto);
  }

  @Patch('appointments/:id')
  @ApiOperation({ summary: 'Update an appointment' })
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointments.update(id, dto);
  }

  @Post('appointments/:id/check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in a patient for their appointment' })
  checkIn(@Param('id') id: string) {
    return this.appointments.checkIn(id);
  }

  @Post('appointments/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an appointment' })
  cancel(@Param('id') id: string, @Body() dto: CancelAppointmentDto) {
    return this.appointments.cancel(id, dto.reason, dto.note);
  }

  @Post('appointments/:id/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark appointment as no-show' })
  noShow(@Param('id') id: string) {
    return this.appointments.noShow(id);
  }
}
