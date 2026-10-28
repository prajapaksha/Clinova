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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@clinova/identity/domain';
import { full, Permit, read, write } from '../auth/decorators/permit.decorator';
import { Audited, AuditCtx } from '../audit/audited';
import type { AuditContext } from '../audit/audit.service';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { SearchPatientsDto } from './dto/search-patients.dto';

const patientParam = (req: { params: Record<string, string> }) => req.params['id'];

@ApiTags('patients')
@Permit(read('patient:profiles'))
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Search patients' })
  search(@Query() query: SearchPatientsDto) {
    return this.patients.search({
      query: query.query,
      isArchived: query.isArchived,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('mrn/:mrn')
  @Audited({ action: AuditAction.View, resourceType: 'Patient', patientId: (_, r) => (r as { id: string }).id })
  @ApiOperation({ summary: 'Find patient by MRN' })
  findByMrn(@Param('mrn') mrn: string) {
    return this.patients.findByMrn(mrn);
  }

  @Get(':id')
  @Audited({ action: AuditAction.View, resourceType: 'Patient', patientId: patientParam })
  @ApiOperation({ summary: 'Find patient by ID' })
  findById(@Param('id') id: string) {
    return this.patients.findById(id);
  }

  @Post()
  @Permit(write('patient:profiles'))
  @Audited({ action: AuditAction.Create, resourceType: 'Patient', patientId: (_, r) => (r as { id: string }).id })
  @ApiOperation({ summary: 'Register new patient' })
  create(@Body() dto: CreatePatientDto) {
    return this.patients.create(dto);
  }

  @Patch(':id')
  @Permit(write('patient:profiles'))
  @ApiOperation({ summary: 'Update patient (limited roles cannot change medical fields)' })
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>, @AuditCtx() ctx: AuditContext) {
    return this.patients.update(id, dto, ctx);
  }

  @Delete(':id')
  @Permit(full('patient:profiles'))
  @Audited({ action: AuditAction.Delete, resourceType: 'Patient', patientId: patientParam })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive patient' })
  archive(@Param('id') id: string) {
    return this.patients.archive(id);
  }

  @Post(':id/allergies')
  @Permit(full('patient:profiles'))
  @Audited({ action: AuditAction.Create, resourceType: 'Allergy', patientId: patientParam })
  @ApiOperation({ summary: 'Add allergy to patient' })
  addAllergy(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.patients.addAllergy(id, body as Parameters<PatientsService['addAllergy']>[1]);
  }

  @Delete(':id/allergies/:allergyId')
  @Permit(full('patient:profiles'))
  @Audited({ action: AuditAction.Delete, resourceType: 'Allergy', resourceId: req => req.params['allergyId'], patientId: patientParam })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove allergy from patient' })
  removeAllergy(@Param('id') id: string, @Param('allergyId') allergyId: string) {
    return this.patients.removeAllergy(id, allergyId);
  }

  @Post(':id/documents')
  @Permit(write('patient:profiles'))
  @Audited({ action: AuditAction.Create, resourceType: 'Document', resourceId: (_, r) => (r as { id: string }).id, patientId: patientParam })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload document for patient' })
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File & { originalname: string; mimetype: string; size: number },
    @Body('category') category: string,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.patients.addDocument(id, {
      category,
      name: file.originalname,
      storageKey: `uploads/${id}/${Date.now()}-${file.originalname}`,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: ctx.user ? `${ctx.user.firstName} ${ctx.user.lastName}` : 'system',
    });
  }

  @Delete(':id/documents/:documentId')
  @Permit(full('patient:profiles'))
  @Audited({ action: AuditAction.Delete, resourceType: 'Document', resourceId: req => req.params['documentId'], patientId: patientParam })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove document from patient' })
  removeDocument(@Param('id') id: string, @Param('documentId') documentId: string) {
    return this.patients.removeDocument(id, documentId);
  }
}