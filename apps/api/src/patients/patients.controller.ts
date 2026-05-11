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
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { SearchPatientsDto } from './dto/search-patients.dto';

@ApiTags('patients')
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
  @ApiOperation({ summary: 'Find patient by MRN' })
  findByMrn(@Param('mrn') mrn: string) {
    return this.patients.findByMrn(mrn);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find patient by ID' })
  findById(@Param('id') id: string) {
    return this.patients.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Register new patient' })
  create(@Body() dto: CreatePatientDto) {
    return this.patients.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patient' })
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.patients.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive patient' })
  archive(@Param('id') id: string) {
    return this.patients.archive(id, 'system');
  }

  @Post(':id/allergies')
  @ApiOperation({ summary: 'Add allergy to patient' })
  addAllergy(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.patients.addAllergy(id, body as Parameters<PatientsService['addAllergy']>[1]);
  }

  @Delete(':id/allergies/:allergyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove allergy from patient' })
  removeAllergy(@Param('id') id: string, @Param('allergyId') allergyId: string) {
    return this.patients.removeAllergy(id, allergyId);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload document for patient' })
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File & { originalname: string; mimetype: string; size: number },
    @Body('category') category: string,
  ) {
    return this.patients.addDocument(id, {
      category,
      name: file.originalname,
      storageKey: `uploads/${id}/${Date.now()}-${file.originalname}`,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: 'system',
    });
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove document from patient' })
  removeDocument(@Param('id') id: string, @Param('documentId') documentId: string) {
    return this.patients.removeDocument(id, documentId);
  }
}
