import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@clinova/identity/domain';
import type { PortalDashboard } from '@clinova/portal/domain';
import { NOTIFICATION_TOPICS, normalizePreferences } from '@clinova/portal/domain';
import { PatientRoute } from '../auth/decorators/patient-route.decorator';
import { Audited, AuditCtx, AuthedRequest } from '../audit/audited';
import type { AuditContext } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { contentDisposition, FileResponse } from '../patients/patients.controller';
import { PortalSchedulingService } from './portal-scheduling.service';
import { PortalRecordsService } from './portal-records.service';
import { PortalBillingService } from './portal-billing.service';
import { MessagingService } from './messaging.service';
import { PortalRequestsService } from './portal-requests.service';
import {
  BookDto,
  NewThreadDto,
  PortalCancelDto,
  PortalPayDto,
  PreferencesDto,
  ProfileChangeDto,
  RefillRequestDto,
  ReplyDto,
  RescheduleDto,
  SaveCardDto,
} from './dto/portal.dto';

type PatientUser = AuthUser & { patientId: string };
type Req = { user: PatientUser };
const own = (req: AuthedRequest) => (req.user as { patientId?: string } | null | undefined)?.patientId;

/** Patient-facing API. Every route is scoped to the signed-in patient's own record. */
@ApiTags('portal')
@ApiBearerAuth()
@PatientRoute()
@Controller('portal')
export class PortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: PortalSchedulingService,
    private readonly records: PortalRecordsService,
    private readonly billing: PortalBillingService,
    private readonly messaging: MessagingService,
    private readonly requests: PortalRequestsService,
  ) {}

  @Get('dashboard')
  async dashboard(@Req() req: Req): Promise<PortalDashboard> {
    const { patientId } = req.user;
    const now = new Date();
    const [patient, appointments, bill, unread, documents, refills, changes] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: { firstName: true, preferredName: true } }),
      this.scheduling.appointments(patientId, now),
      this.billing.summary(patientId, now),
      this.messaging.patientUnreadCount(patientId),
      this.records.documents(patientId),
      this.prisma.refillRequest.count({ where: { patientId, status: 'PENDING' } }),
      this.prisma.profileChangeRequest.count({ where: { patientId, status: 'PENDING' } }),
    ]);
    const upcoming = appointments
      .filter(a => new Date(a.end) > now && ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'].includes(a.status))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return {
      greetingName: patient.preferredName || patient.firstName,
      nextAppointment: upcoming[0] ?? null,
      upcomingCount: upcoming.length,
      balanceCents: bill.balanceCents,
      openInvoiceCount: bill.openInvoiceCount,
      oldestDueDate: bill.oldestDueDate,
      unreadMessages: unread,
      newDocuments: documents.filter(d => d.isNew).slice(0, 5),
      pendingRequests: refills + changes,
    };
  }

  // ── Appointments ───────────────────────────────────────────────────────────

  @Get('appointments')
  appointments(@Req() req: Req) {
    return this.scheduling.appointments(req.user.patientId);
  }

  @Get('booking/types')
  bookableTypes() {
    return this.scheduling.bookableTypes();
  }

  @Get('booking/providers')
  providers(@Req() req: Req) {
    return this.scheduling.providers(req.user.patientId);
  }

  @Get('booking/availability')
  @ApiOperation({ summary: 'Open slots from the provider schedule (from = local YYYY-MM-DD)' })
  availability(
    @Query('providerId') providerId: string,
    @Query('appointmentTypeId') appointmentTypeId: string,
    @Query('from') from: string,
    @Query('days') days = '7',
    @Query('tzOffset') tzOffset = '0',
    @Query('excludeAppointmentId') excludeAppointmentId?: string,
  ) {
    return this.scheduling.availability({
      providerId, appointmentTypeId, from: /^\d{4}-\d{2}-\d{2}$/.test(from ?? '') ? from : new Date().toISOString().slice(0, 10),
      days: parseInt(days, 10) || 7, tzOffset: parseInt(tzOffset, 10) || 0, excludeAppointmentId,
    });
  }

  @Post('appointments')
  @Audited({ action: AuditAction.Create, resourceType: 'Appointment', patientId: own })
  book(@Req() req: Req, @Body() dto: BookDto) {
    return this.scheduling.book(req.user.patientId, dto);
  }

  @Put('appointments/:id')
  @Audited({ action: AuditAction.Update, resourceType: 'Appointment', patientId: own })
  reschedule(@Req() req: Req, @Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.scheduling.reschedule(req.user.patientId, id, dto);
  }

  @Post('appointments/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Audited({ action: AuditAction.Update, resourceType: 'Appointment', patientId: own, fieldName: 'status' })
  cancel(@Req() req: Req, @Param('id') id: string, @Body() dto: PortalCancelDto) {
    return this.scheduling.cancel(req.user.patientId, id, dto.note);
  }

  // ── Health records ─────────────────────────────────────────────────────────

  @Get('records/visits')
  visits(@Req() req: Req) {
    return this.records.visits(req.user.patientId);
  }

  @Get('records/visits/:id')
  @Audited({ action: AuditAction.View, resourceType: 'VisitSummary', patientId: own })
  visit(@Req() req: Req, @Param('id') id: string) {
    return this.records.visitSummary(req.user.patientId, id);
  }

  @Get('records/health')
  health(@Req() req: Req) {
    return this.records.health(req.user.patientId);
  }

  @Get('records/documents')
  documents(@Req() req: Req) {
    return this.records.documents(req.user.patientId);
  }

  @Get('records/documents/:id/file')
  @Audited({ action: AuditAction.View, resourceType: 'Document', patientId: own })
  async document(@Req() req: Req, @Param('id') id: string, @Query('inline') inline: string | undefined, @Res({ passthrough: true }) res: FileResponse) {
    const { document, data } = await this.records.documentFile(req.user.patientId, id);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', contentDisposition(document.name, inline === 'true'));
    return new StreamableFile(data);
  }

  @Get('refills')
  refills(@Req() req: Req) {
    return this.requests.refills({ patientId: req.user.patientId });
  }

  @Post('refills')
  @Audited({ action: AuditAction.Create, resourceType: 'RefillRequest', patientId: own })
  requestRefill(@Req() req: Req, @Body() dto: RefillRequestDto) {
    return this.requests.requestRefill(req.user.patientId, dto);
  }

  // ── Billing ────────────────────────────────────────────────────────────────

  @Get('billing/summary')
  billingSummary(@Req() req: Req) {
    return this.billing.summary(req.user.patientId);
  }

  @Get('billing/invoices')
  invoices(@Req() req: Req) {
    return this.billing.invoiceList(req.user.patientId);
  }

  @Get('billing/invoices/:id')
  @Audited({ action: AuditAction.View, resourceType: 'Invoice', patientId: own })
  invoice(@Req() req: Req, @Param('id') id: string) {
    return this.billing.invoice(req.user.patientId, id);
  }

  @Get('billing/payments')
  payments(@Req() req: Req) {
    return this.billing.payments(req.user.patientId);
  }

  @Post('billing/payments')
  @Audited({ action: AuditAction.Create, resourceType: 'Payment', patientId: own })
  pay(@Req() req: Req, @Body() dto: PortalPayDto) {
    return this.billing.pay(req.user, dto);
  }

  @Get('billing/cards')
  cards(@Req() req: Req) {
    return this.billing.cards(req.user.patientId);
  }

  @Post('billing/cards')
  @Audited({ action: AuditAction.Create, resourceType: 'PaymentMethod', patientId: own })
  addCard(@Req() req: Req, @Body() dto: SaveCardDto) {
    return this.billing.addCard(req.user.patientId, dto, dto.makeDefault);
  }

  @Put('billing/cards/:id/default')
  setDefaultCard(@Req() req: Req, @Param('id') id: string) {
    return this.billing.setDefaultCard(req.user.patientId, id);
  }

  @Delete('billing/cards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited({ action: AuditAction.Delete, resourceType: 'PaymentMethod', patientId: own })
  removeCard(@Req() req: Req, @Param('id') id: string) {
    return this.billing.removeCard(req.user.patientId, id);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  @Get('messages')
  threads(@Req() req: Req) {
    return this.messaging.patientThreads(req.user.patientId);
  }

  @Get('messages/:id')
  thread(@Req() req: Req, @Param('id') id: string) {
    return this.messaging.patientThread(req.user.patientId, id);
  }

  @Post('messages')
  startThread(@Req() req: Req, @Body() dto: NewThreadDto) {
    return this.messaging.startThread(req.user.patientId, dto, this.author(req.user));
  }

  @Post('messages/:id/replies')
  reply(@Req() req: Req, @Param('id') id: string, @Body() dto: ReplyDto) {
    return this.messaging.patientReply(req.user.patientId, id, dto.body, this.author(req.user));
  }

  // ── Profile & preferences ──────────────────────────────────────────────────

  @Get('profile')
  @Audited({ action: AuditAction.View, resourceType: 'Patient', patientId: own })
  profile(@Req() req: Req) {
    return this.requests.editableProfile(req.user.patientId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Request changes to contact, demographics or insurance (reviewed by staff)' })
  requestChange(@Req() req: Req, @Body() dto: ProfileChangeDto, @AuditCtx() ctx: AuditContext) {
    return this.requests.submitChange(req.user.patientId, dto as Record<string, unknown>, ctx);
  }

  @Get('profile/requests')
  changeRequests(@Req() req: Req) {
    return this.requests.changeRequests({ patientId: req.user.patientId });
  }

  @Get('preferences')
  async preferences(@Req() req: Req) {
    const account = await this.prisma.patientAccount.findUniqueOrThrow({ where: { id: req.user.id } });
    return { topics: NOTIFICATION_TOPICS, preferences: normalizePreferences(JSON.parse(account.notificationPrefsJson)) };
  }

  @Put('preferences')
  async savePreferences(@Req() req: Req, @Body() dto: PreferencesDto) {
    const preferences = normalizePreferences(dto.preferences);
    await this.prisma.patientAccount.update({ where: { id: req.user.id }, data: { notificationPrefsJson: JSON.stringify(preferences) } });
    return { topics: NOTIFICATION_TOPICS, preferences };
  }

  private author(user: PatientUser) {
    return { id: user.id, name: `${user.firstName} ${user.lastName}` };
  }
}
