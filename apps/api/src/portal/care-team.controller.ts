import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { AuditAction, hasAccess } from '@clinova/identity/domain';
import { full, Permit, read, write } from '../auth/decorators/permit.decorator';
import { Audited, AuditCtx } from '../audit/audited';
import type { AuditContext } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.service';
import { PortalAuthService } from './portal-auth.service';
import { MessagingService } from './messaging.service';
import { PortalRequestsService } from './portal-requests.service';
import { PortalRecordsService } from './portal-records.service';
import { InviteDto, RefillResponseDto, ReplyDto, ReviewChangeDto, ThreadStatusDto } from './dto/portal.dto';

class PortalStatusDto {
  @IsBoolean() disabled!: boolean;
}

/** Staff side of the portal: invites, the care-team inbox, refill and profile-change review. */
@ApiTags('care-team')
@ApiBearerAuth()
@Controller()
export class CareTeamController {
  constructor(
    private readonly portalAuth: PortalAuthService,
    private readonly messaging: MessagingService,
    private readonly requests: PortalRequestsService,
    private readonly records: PortalRecordsService,
  ) {}

  // ── Portal access per patient ──────────────────────────────────────────────

  @Get('patients/:id/portal-access')
  @Permit(read('patient:profiles'))
  access(@Param('id') id: string) {
    return this.portalAuth.accessSummary(id);
  }

  @Post('patients/:id/portal-access/invite')
  @Permit(write('patient:profiles'))
  @ApiOperation({ summary: 'Invite the patient to the portal; returns a one-time activation code' })
  invite(@Param('id') id: string, @Body() dto: InviteDto, @AuditCtx() ctx: AuditContext) {
    return this.portalAuth.invite(id, dto.email, ctx);
  }

  @Put('patients/:id/portal-access/status')
  @Permit(write('patient:profiles'))
  setStatus(@Param('id') id: string, @Body() dto: PortalStatusDto, @AuditCtx() ctx: AuditContext) {
    return this.portalAuth.setDisabled(id, dto.disabled, ctx);
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────

  @Get('inbox/summary')
  @Permit(read('patient:profiles'))
  async summary(@Req() req: { user: AuthUser }) {
    const role = req.user.role;
    const [unreadThreads, pendingRefills, pendingChanges] = await Promise.all([
      this.messaging.staffUnreadCount(),
      hasAccess(role, 'clinical:prescriptions', 'read') ? this.requests.refills({ status: 'PENDING' }).then(r => r.length) : 0,
      hasAccess(role, 'patient:profiles', 'write') ? this.requests.changeRequests({ status: 'PENDING' }).then(r => r.length) : 0,
    ]);
    return { unreadThreads, pendingRefills, pendingChanges };
  }

  @Get('inbox/threads')
  @Permit(read('patient:profiles'))
  threads(
    @Query('status') status = 'OPEN',
    @Query('category') category?: string,
    @Query('patientId') patientId?: string,
    @Query('unread') unread?: string,
  ) {
    return this.messaging.inbox({ status, category, patientId, unreadOnly: unread === 'true' });
  }

  @Get('inbox/threads/:id')
  @Permit(read('patient:profiles'))
  thread(@Param('id') id: string, @AuditCtx() ctx: AuditContext) {
    return this.messaging.staffThread(id, ctx);
  }

  @Post('inbox/threads/:id/messages')
  @Permit(read('patient:profiles'))
  async reply(@Param('id') id: string, @Body() dto: ReplyDto, @Req() req: { user: AuthUser }, @AuditCtx() ctx: AuditContext) {
    const name = (await this.records.staffNames([req.user.id])).get(req.user.id) ?? `${req.user.firstName} ${req.user.lastName}`;
    return this.messaging.staffReply(id, dto.body, { id: req.user.id, name }, ctx);
  }

  @Patch('inbox/threads/:id')
  @Permit(read('patient:profiles'))
  setThreadStatus(@Param('id') id: string, @Body() dto: ThreadStatusDto) {
    return this.messaging.setStatus(id, dto.status);
  }

  // ── Refills ────────────────────────────────────────────────────────────────

  @Get('refill-requests')
  @Permit(read('clinical:prescriptions'))
  refills(@Query('status') status = 'PENDING', @Query('patientId') patientId?: string) {
    return this.requests.refills({ status, patientId });
  }

  @Post('refill-requests/:id/response')
  @HttpCode(HttpStatus.OK)
  @Permit(full('clinical:prescriptions'))
  respondRefill(@Param('id') id: string, @Body() dto: RefillResponseDto, @AuditCtx() ctx: AuditContext) {
    return this.requests.respondRefill(id, dto.decision, dto.note, ctx);
  }

  // ── Profile change requests ────────────────────────────────────────────────

  @Get('profile-change-requests')
  @Permit(write('patient:profiles'))
  changes(@Query('status') status = 'PENDING', @Query('patientId') patientId?: string) {
    return this.requests.changeRequests({ status, patientId });
  }

  @Post('profile-change-requests/:id/review')
  @HttpCode(HttpStatus.OK)
  @Permit(write('patient:profiles'))
  @Audited({ action: AuditAction.Update, resourceType: 'ProfileChangeRequest', patientId: (_, r) => (r as { patientId: string }).patientId })
  review(@Param('id') id: string, @Body() dto: ReviewChangeDto, @AuditCtx() ctx: AuditContext) {
    return this.requests.reviewChange(id, dto.decision, dto.reason, ctx);
  }
}
