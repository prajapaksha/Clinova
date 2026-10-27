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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
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

// Clinical notes are visible to clinicians and administrators only (PRD §3.2).
const CLINICAL_READ_ROLES = ['PHYSICIAN', 'NURSE', 'ADMIN'];
const CLINICAL_WRITE_ROLES = ['PHYSICIAN', 'NURSE'];

@ApiTags('encounters')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(...CLINICAL_READ_ROLES)
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
  @ApiOperation({ summary: 'Get the encounter for an appointment (null if not started)' })
  findByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.encounters.findByAppointment(appointmentId);
  }

  @Get('encounters/:id')
  @ApiOperation({ summary: 'Get encounter by ID' })
  findById(@Param('id') id: string) {
    return this.encounters.findById(id);
  }

  @Post('encounters')
  @Roles(...CLINICAL_WRITE_ROLES)
  @ApiOperation({ summary: 'Begin an encounter (from a checked-in appointment or as a walk-in)' })
  start(@Body() dto: StartEncounterDto, @Request() req: AuthedRequest) {
    return this.encounters.start(dto, req.user);
  }

  @Patch('encounters/:id')
  @Roles(...CLINICAL_WRITE_ROLES)
  @ApiOperation({ summary: 'Update an unsigned note, vitals, or draft status' })
  update(@Param('id') id: string, @Body() dto: UpdateEncounterDto, @Request() req: AuthedRequest) {
    return this.encounters.update(id, dto, req.user);
  }

  @Delete('encounters/:id')
  @Roles(...CLINICAL_WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Discard an unsigned encounter' })
  discard(@Param('id') id: string) {
    return this.encounters.discard(id);
  }

  @Post('encounters/:id/sign')
  @Roles('PHYSICIAN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign and lock the note' })
  sign(@Param('id') id: string, @Request() req: AuthedRequest) {
    return this.encounters.sign(id, req.user);
  }

  @Post('encounters/:id/addenda')
  @Roles('PHYSICIAN')
  @ApiOperation({ summary: 'Add an addendum to a signed note' })
  addAddendum(@Param('id') id: string, @Body() dto: AddendumDto, @Request() req: AuthedRequest) {
    return this.encounters.addAddendum(id, dto.content, req.user);
  }

  @Post('encounters/:id/prescriptions')
  @Roles('PHYSICIAN')
  @ApiOperation({ summary: 'Issue a prescription (409 if safety alerts are not acknowledged)' })
  issuePrescription(@Param('id') id: string, @Body() dto: IssuePrescriptionDto, @Request() req: AuthedRequest) {
    return this.encounters.issuePrescription(id, dto, req.user);
  }

  @Post('prescriptions/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run allergy and interaction checks for a medication' })
  checkPrescription(@Body() dto: PrescriptionCheckDto) {
    return this.encounters.checkPrescription(dto.patientId, dto.medicationName);
  }

  @Patch('prescriptions/:id')
  @Roles('PHYSICIAN')
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
  @Roles('PHYSICIAN', 'ADMIN')
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
