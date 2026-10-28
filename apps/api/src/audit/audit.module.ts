import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditAction } from '@clinova/identity/domain';
import { Permit, read } from '../auth/decorators/permit.decorator';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audited';

@ApiTags('audit')
@ApiBearerAuth()
@Permit(read('identity:auditLogs'))
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Search the audit trail (super admin: full, practice admin: read)' })
  findMany(
    @Query('userId') userId?: string,
    @Query('patientId') patientId?: string,
    @Query('action') action?: AuditAction | AuditAction[],
    @Query('resourceType') resourceType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.findMany({
      userId, patientId, action, resourceType, from, to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
