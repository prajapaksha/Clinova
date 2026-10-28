import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationEventsModule, NotificationQueries, NotificationTemplates } from '@clinova/api/notifications';
import { AuditAction } from '@clinova/identity/domain';
import { NotificationChannel, NotificationType } from '@clinova/notifications/domain';
import { Module } from '@nestjs/common';
import { Permit, read, write } from '../auth/decorators/permit.decorator';
import { PatientRoute } from '../auth/decorators/patient-route.decorator';
import { Audited } from '../audit/audited';
import type { AuthUser } from '../auth/auth.service';

class TemplateDto {
  @IsOptional() @IsString() @MaxLength(200) subject?: string | null;
  @IsString() @MaxLength(4000) body!: string;
  @IsBoolean() isActive!: boolean;
}

class PreviewDto {
  @IsIn(Object.values(NotificationType)) type!: NotificationType;
  @IsOptional() @IsString() @MaxLength(200) subject?: string | null;
  @IsString() @MaxLength(4000) body!: string;
}

class ReadDto {
  @IsOptional() @IsString() id?: string;
}

type Req = { user: AuthUser };

/** Staff: delivery log and templates (PRD §4.6). */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(
    private readonly queries: NotificationQueries,
    private readonly templates: NotificationTemplates,
  ) {}

  @Get('notifications')
  @Permit(read('patient:profiles'))
  @Audited({ action: AuditAction.View, resourceType: 'NotificationLog', resourceId: req => (req.query['patientId'] as string) ?? null, patientId: req => (req.query['patientId'] as string) ?? null })
  @ApiOperation({ summary: 'Sent/queued/suppressed messages (filter by patient or appointment)' })
  log(
    @Query('patientId') patientId?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.queries.log({
      patientId, appointmentId, status, channel, type,
      limit: limit ? parseInt(limit, 10) : undefined, offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('notifications/summary')
  @Permit(read('patient:profiles'))
  summary() {
    return this.queries.summary();
  }

  @Post('notifications/:id/retry')
  @HttpCode(HttpStatus.OK)
  @Permit(write('patient:profiles'))
  retry(@Param('id') id: string) {
    return this.queries.retry(id);
  }

  @Post('notifications/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permit(write('patient:profiles'))
  cancel(@Param('id') id: string, @Req() req: Req) {
    return this.queries.cancel(id, `${req.user.firstName} ${req.user.lastName}`);
  }

  @Get('notification-templates')
  @Permit(read('system:settings'))
  listTemplates() {
    return this.templates.list();
  }

  @Post('notification-templates/preview')
  @HttpCode(HttpStatus.OK)
  @Permit(read('system:settings'))
  preview(@Body() dto: PreviewDto) {
    return this.templates.preview(dto.type, dto);
  }

  @Put('notification-templates/:type/:channel')
  @Permit(write('system:settings'))
  @Audited({ action: AuditAction.Update, resourceType: 'NotificationTemplate', resourceId: req => `${req.params['type']}/${req.params['channel']}` })
  saveTemplate(@Param('type') type: NotificationType, @Param('channel') channel: NotificationChannel, @Body() dto: TemplateDto, @Req() req: Req) {
    return this.templates.save(type, channel, dto, req.user.id);
  }

  @Delete('notification-templates/:type/:channel')
  @Permit(write('system:settings'))
  @Audited({ action: AuditAction.Delete, resourceType: 'NotificationTemplate', resourceId: req => `${req.params['type']}/${req.params['channel']}` })
  resetTemplate(@Param('type') type: NotificationType, @Param('channel') channel: NotificationChannel) {
    return this.templates.reset(type, channel);
  }

  // ── Staff notification center (bell) ───────────────────────────────────────

  @Get('me/notifications')
  mine(@Req() req: Req) {
    return this.queries.staff(req.user.id);
  }

  @Post('me/notifications/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markMineRead(@Req() req: Req, @Body() dto: ReadDto) {
    return this.queries.markStaffRead(req.user.id, dto.id);
  }
}

/** Patient portal notification center. */
@ApiTags('portal')
@ApiBearerAuth()
@PatientRoute()
@Controller('portal/notifications')
export class PortalNotificationsController {
  constructor(private readonly queries: NotificationQueries) {}

  @Get()
  list(@Req() req: Req) {
    return this.queries.portal(req.user.id);
  }

  @Post('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Req() req: Req, @Body() dto: ReadDto) {
    return this.queries.markPortalRead(req.user.id, dto.id);
  }
}

@Module({
  imports: [NotificationEventsModule],
  controllers: [NotificationsController, PortalNotificationsController],
})
export class NotificationsApiModule {}