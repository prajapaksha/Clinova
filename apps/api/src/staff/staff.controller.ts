import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { full, Permit, read, write } from '../auth/decorators/permit.decorator';
import { AuditCtx, AuthedRequest } from '../audit/audited';
import type { AuditContext } from '../audit/audit.service';
import { StaffService } from './staff.service';
import {
  CreateStaffDto,
  CredentialDto,
  UpdateAccountDto,
  UpdateScheduleDto,
  UpdateStaffProfileDto,
} from './dto/staff.dto';

/**
 * Staff directory & management (PRD §4.3). Profile edits are allowed for managers
 * (staff:profiles full) or the staff member themself — enforced in StaffService.
 */
@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'Staff directory (status: active | inactive | all)' })
  findAll(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('specialty') specialty?: string,
    @Query('search') search?: string,
  ) {
    return this.staff.findAll({ role, status, specialty, search });
  }

  @Get('credentials/expiring')
  @Permit(full('staff:profiles'))
  @ApiOperation({ summary: 'Credentials expiring within N days (default 90), including expired' })
  expiring(@Query('days') days?: string) {
    const n = days ? parseInt(days, 10) : 90;
    return this.staff.expiringCredentials(Number.isFinite(n) ? Math.min(Math.max(n, 0), 365) : 90);
  }

  @Get(':id')
  @Permit(read('staff:profiles'))
  findOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.staff.findProfile(id, req.user ?? null);
  }

  @Post()
  @Permit(write('identity:users'))
  @ApiOperation({ summary: 'Create a staff account; returns a one-time temporary password' })
  create(@Body() dto: CreateStaffDto, @AuditCtx() ctx: AuditContext) {
    return this.staff.create(dto, ctx);
  }

  @Patch(':id')
  @Permit(read('staff:profiles'))
  updateProfile(@Param('id') id: string, @Body() dto: UpdateStaffProfileDto, @AuditCtx() ctx: AuditContext) {
    return this.staff.updateProfile(id, dto, ctx);
  }

  @Patch(':id/account')
  @Permit(write('identity:users'))
  @ApiOperation({ summary: 'Change role or activate/deactivate an account' })
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto, @AuditCtx() ctx: AuditContext) {
    return this.staff.updateAccount(id, dto, ctx);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @Permit(write('identity:users'))
  resetPassword(@Param('id') id: string, @AuditCtx() ctx: AuditContext) {
    return this.staff.resetPassword(id, ctx);
  }

  @Post(':id/unlock')
  @HttpCode(200)
  @Permit(write('identity:users'))
  unlock(@Param('id') id: string, @AuditCtx() ctx: AuditContext) {
    return this.staff.unlock(id, ctx);
  }

  @Put(':id/schedule')
  @Permit(read('staff:profiles'))
  updateSchedule(@Param('id') id: string, @Body() dto: UpdateScheduleDto, @AuditCtx() ctx: AuditContext) {
    return this.staff.updateSchedule(id, dto.schedule, ctx);
  }

  @Post(':id/credentials')
  @Permit(read('staff:profiles'))
  addCredential(@Param('id') id: string, @Body() dto: CredentialDto, @AuditCtx() ctx: AuditContext) {
    return this.staff.addCredential(id, dto, ctx);
  }

  @Put(':id/credentials/:credentialId')
  @Permit(read('staff:profiles'))
  updateCredential(
    @Param('id') id: string,
    @Param('credentialId') credentialId: string,
    @Body() dto: CredentialDto,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.staff.updateCredential(id, credentialId, dto, ctx);
  }

  @Delete(':id/credentials/:credentialId')
  @HttpCode(204)
  @Permit(read('staff:profiles'))
  removeCredential(@Param('id') id: string, @Param('credentialId') credentialId: string, @AuditCtx() ctx: AuditContext) {
    return this.staff.removeCredential(id, credentialId, ctx);
  }
}