import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.service';
import { AuditAction } from '@clinova/identity/domain';
import { full, Permit, read, write } from '../auth/decorators/permit.decorator';
import { Audited } from '../audit/audited';
import { EncountersService } from './encounters.service';
import {
  AddendumDto,
  CreateTemplateDto,
  IssuePrescriptionDto,
  PrescriptionCheckDto,
  StartEncounterDto,
  UpdateEncounterDto,
  UpdatePrescriptionDto,
} from './dto/encounter.dto';

type AuthedRequest = { user: AuthUser };

@ApiTags('encounters')
@ApiBearerAuth()
@Permit(read('clinical:notes'))
@Controller()
export class EncountersController {
  constructor(private readonly encounters: EncountersService) {}

  @Get('encounters')
  @ApiOperation({ summary: 'List encounters' })
  findMany(
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string | string[],
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.encounters.findMany({
      patientId,
      providerId,
      status,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('encounters/by-appointment/:appointmentId')
  @Audited({ action: AuditAction.View, resourceType: 'Encounter', resourceId: (_, r) => (r as { id?: string } | null)?.id })
  @ApiOperation({ summary: 'Get the encounter for an appointment (null if not started)' })
  findByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.encounters.findByAppointment(appointmentId);
  }

  @Get('encounters/:id')
  @Audited({ action: AuditAction.View, resourceType: 'Encounter' })
  @ApiOperation({ summary: 'Get encounter by ID' })
  findById(@Param('id') id: string) {
    return this.encounters.findById(id);
  }

  @Post('encounters')
  @Permit(write('clinical:notes'))
  @Audited({ action: AuditAction.Create, resourceType: 'Encounter' })
  @ApiOperation({ summary: 'Begin an encounter (from a checked-in appointment or as a walk-in)' })
  start(@Body() dto: StartEncounterDto, @Request() req: AuthedRequest) {
    return this.encounters.start(dto, req.user);
  }

  @Patch('encounters/:id')
  @Permit(write('clinical:notes'))
  @Audited({ action: AuditAction.Update, resourceType: 'Encounter' })
  @ApiOperation({ summary: 'Update an unsigned note, vitals, or draft status' })
  update(@Param('id') id: string, @Body() dto: UpdateEncounterDto, @Request() req: AuthedRequest) {
    return this.encounters.update(id, dto, req.user);
  }

  @Delete('encounters/:id')
  @Permit(write('clinical:notes'))
  @Audited({ action: AuditAction.Delete, resourceType: 'Encounter' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Discard an unsigned encounter' })
  discard(@Param('id') id: string) {
    return this.encounters.discard(id);
  }

  @Post('encounters/:id/sign')
  @Permit(full('clinical:notes'))
  @Audited({ action: AuditAction.Sign, resourceType: 'Encounter' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign and lock the note' })
  sign(@Param('id') id: string, @Request() req: AuthedRequest) {
    return this.encounters.sign(id, req.user);
  }

  @Post('encounters/:id/addenda')
  @Permit(full('clinical:notes'))
  @Audited({ action: AuditAction.Create, resourceType: 'Addendum', resourceId: req => req.params['id'] })
  @ApiOperation({ summary: 'Add an addendum to a signed note' })
  addAddendum(@Param('id') id: string, @Body() dto: AddendumDto, @Request() req: AuthedRequest) {
    return this.encounters.addAddendum(id, dto.content, req.user);
  }

  @Post('encounters/:id/prescriptions')
  @Permit(full('clinical:prescriptions'))
  @Audited({ action: AuditAction.Create, resourceType: 'Prescription', resourceId: (_, r) => (r as { id?: string }).id })
  @ApiOperation({ summary: 'Issue a prescription (409 if safety alerts are not acknowledged)' })
  issuePrescription(@Param('id') id: string, @Body() dto: IssuePrescriptionDto, @Request() req: AuthedRequest) {
    return this.encounters.issuePrescription(id, dto, req.user);
  }

  @Post('prescriptions/check')
  @Permit(read('clinical:prescriptions'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run allergy and interaction checks for a medication' })
  checkPrescription(@Body() dto: PrescriptionCheckDto) {
    return this.encounters.checkPrescription(dto.patientId, dto.medicationName);
  }

  @Patch('prescriptions/:id')
  @Permit(full('clinical:prescriptions'))
  @Audited({ action: AuditAction.Update, resourceType: 'Prescription' })
  @ApiOperation({ summary: 'Update prescription status (e.g. discontinue)' })
  updatePrescription(@Param('id') id: string, @Body() dto: UpdatePrescriptionDto, @Request() req: AuthedRequest) {
    return this.encounters.updatePrescription(id, dto, req.user);
  }

  @Get('encounter-templates')
  @ApiOperation({ summary: 'List active encounter templates' })
  findTemplates(@Query('specialty') specialty?: string) {
    return this.encounters.findTemplates({ specialty });
  }

  @Post('encounter-templates')
  @Permit(full('clinical:notes'), write('system:settings'))
  @ApiOperation({ summary: 'Create an encounter template' })
  createTemplate(@Body() dto: CreateTemplateDto, @Request() req: AuthedRequest) {
    return this.encounters.createTemplate(dto, req.user);
  }

  @Get('icd10/search')
  @ApiOperation({ summary: 'Search ICD-10-CM codes (ranked by match and usage)' })
  searchIcd10(@Query('q') q = '') {
    return this.encounters.searchIcd10(q);
  }

  @Get('drugs/search')
  @ApiOperation({ summary: 'Search the drug catalog' })
  searchDrugs(@Query('q') q = '') {
    return this.encounters.searchDrugs(q);
  }
}
