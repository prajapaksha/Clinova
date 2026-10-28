import { Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEventBus, PrismaService } from '@clinova/api/shared';
import type { DrugDose } from '@clinova/clinical/domain';
import { hasAccess, isProviderRole, UserRole } from '@clinova/identity/domain';
import { NotificationType } from '@clinova/notifications/domain';
import { AppointmentNotices } from './appointment-notices';
import { NotificationOutbox } from './notification-outbox';
import { PracticeSettings } from './practice-settings';
import { invoiceBalances, patientBalanceCents } from './billing-snapshot';
import type {
  AppointmentEvent,
  CareTeamRepliedEvent,
  DocumentSharedEvent,
  InvoiceIssuedEvent,
  PatientMessageSentEvent,
  PaymentReceivedEvent,
  ProfileChangeEvent,
  RefillRequestedEvent,
  RefillRespondedEvent,
} from './notification-events';

const PAYMENT_METHODS: Record<string, string> = {
  CREDIT_CARD: 'credit card', DEBIT_CARD: 'debit card', ACH: 'bank transfer', CASH: 'cash', CHECK: 'check',
  HSA: 'HSA card', FSA: 'FSA card', PATIENT_PORTAL: 'card (online)',
};

/** Which staff see an in-app alert for a new patient message, by topic. */
const MESSAGE_AUDIENCE: Record<string, (role: string) => boolean> = {
  BILLING: role => hasAccess(role, 'billing:invoices', 'full') && role !== UserRole.SuperAdmin,
  PRESCRIPTION: role => isProviderRole(role) || role === UserRole.Nurse,
  RESULTS: role => isProviderRole(role) || role === UserRole.Nurse,
  GENERAL: role => role === UserRole.FrontDesk || role === UserRole.Nurse,
  APPOINTMENT: role => role === UserRole.FrontDesk || role === UserRole.Nurse,
};

/** Turns domain events into patient notices and staff in-app notifications (API process). */
@Injectable()
export class NotificationEventHandlers implements OnModuleInit {
  constructor(
    private readonly events: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly outbox: NotificationOutbox,
    private readonly appointments: AppointmentNotices,
    private readonly practice: PracticeSettings,
  ) {}

  onModuleInit(): void {
    this.events.on<AppointmentEvent>('scheduling.AppointmentBooked', e => this.appointments.booked(e.appointmentId));
    this.events.on<AppointmentEvent>('scheduling.AppointmentRescheduled', e => this.appointments.rescheduled(e.appointmentId));
    this.events.on<AppointmentEvent>('scheduling.AppointmentCancelled', e => this.appointments.cancelled(e.appointmentId));
    this.events.on<AppointmentEvent>('scheduling.AppointmentNoShow', e => this.appointments.noShow(e.appointmentId));
    this.events.on<InvoiceIssuedEvent>('billing.InvoiceIssued', e => this.invoiceIssued(e));
    this.events.on<PaymentReceivedEvent>('billing.PaymentReceived', e => this.paymentReceived(e));
    this.events.on<DocumentSharedEvent>('patient.DocumentShared', e => this.documentShared(e));
    this.events.on<RefillRespondedEvent>('portal.RefillResponded', e => this.refillResponded(e));
    this.events.on<RefillRequestedEvent>('portal.RefillRequested', e => this.refillRequested(e));
    this.events.on<CareTeamRepliedEvent>('portal.CareTeamReplied', e => this.careTeamReplied(e));
    this.events.on<PatientMessageSentEvent>('portal.PatientMessageSent', e => this.patientMessage(e));
    this.events.on<ProfileChangeEvent>('portal.ProfileChangeRequested', e => this.profileChangeRequested(e));
    this.events.on<ProfileChangeEvent>('portal.ProfileChangeReviewed', e => this.profileChangeReviewed(e));
  }

  async invoiceIssued(e: InvoiceIssuedEvent): Promise<void> {
    const [inv] = await invoiceBalances(this.prisma, { ids: [e.invoiceId] });
    if (!inv) return;
    await this.outbox.notifyPatient({
      type: NotificationType.InvoiceIssued,
      patientId: inv.patientId,
      dedupeKey: `invoice:${inv.id}`,
      relatedType: 'Invoice',
      relatedId: inv.id,
      link: `/billing/invoices/${inv.id}`,
      values: {
        invoice_number: inv.number,
        invoice_amount: this.practice.money(inv.totalCents),
        balance_amount: this.practice.money(await patientBalanceCents(this.prisma, inv.patientId)),
        due_date: inv.dueDate ? this.practice.shortDate(inv.dueDate) : '',
      },
    });
  }

  async paymentReceived(e: PaymentReceivedEvent): Promise<void> {
    if (e.method === 'INSURANCE') return;
    const payment = await this.prisma.payment.findUnique({ where: { id: e.paymentId } });
    if (!payment) return;
    const method = e.method === 'PATIENT_PORTAL' && payment.referenceNumber ? payment.referenceNumber.split(' · ')[0] : PAYMENT_METHODS[e.method] ?? 'payment';
    await this.outbox.notifyPatient({
      type: NotificationType.PaymentReceipt,
      patientId: e.patientId,
      dedupeKey: `payment:${e.paymentId}`,
      relatedType: 'Payment',
      relatedId: e.paymentId,
      link: '/billing',
      values: {
        payment_amount: this.practice.money(e.amountCents),
        payment_method: method,
        balance_amount: this.practice.money(await patientBalanceCents(this.prisma, e.patientId)),
      },
    });
  }

  async documentShared(e: DocumentSharedEvent): Promise<void> {
    await this.outbox.notifyPatient({
      type: e.isResult ? NotificationType.ResultsReady : NotificationType.DocumentAvailable,
      patientId: e.patientId,
      dedupeKey: `document:${e.documentId}:${e.timestamp.toISOString()}`,
      relatedType: 'Document',
      relatedId: e.documentId,
      link: '/records?tab=documents',
      values: { document_name: e.documentName, provider_name: e.sharedByName ?? 'Your doctor' },
    });
  }

  async refillResponded(e: RefillRespondedEvent): Promise<void> {
    const req = await this.prisma.refillRequest.findUnique({ where: { id: e.refillRequestId } });
    if (!req || req.status === 'PENDING') return;
    const rx = await this.prisma.prescription.findUnique({ where: { id: req.prescriptionId } });
    const drug = rx ? (JSON.parse(rx.drugJson) as DrugDose) : null;
    await this.outbox.notifyPatient({
      type: req.status === 'APPROVED' ? NotificationType.RefillApproved : NotificationType.RefillDenied,
      patientId: req.patientId,
      dedupeKey: `refill:${req.id}`,
      relatedType: 'RefillRequest',
      relatedId: req.id,
      link: '/records?tab=medications',
      values: {
        medication_name: drug ? [drug.medicationName, drug.strength].filter(Boolean).join(' ') : 'your medication',
        pharmacy: req.pharmacy ?? 'your pharmacy',
        response_note: req.responseNote ?? '',
      },
    });
  }

  async careTeamReplied(e: CareTeamRepliedEvent): Promise<void> {
    const thread = await this.prisma.messageThread.findUnique({ where: { id: e.threadId } });
    if (!thread) return;
    await this.outbox.notifyPatient({
      type: NotificationType.MessageReceived,
      patientId: thread.patientId,
      dedupeKey: `reply:${e.messageId}`,
      relatedType: 'MessageThread',
      relatedId: thread.id,
      link: `/messages/${thread.id}`,
      values: { message_subject: thread.subject },
    });
  }

  async profileChangeReviewed(e: ProfileChangeEvent): Promise<void> {
    const req = await this.prisma.profileChangeRequest.findUnique({ where: { id: e.requestId } });
    if (!req || req.status === 'PENDING') return;
    const approved = req.status === 'APPROVED';
    await this.outbox.notifyPatient({
      type: NotificationType.ProfileUpdateReviewed,
      patientId: req.patientId,
      dedupeKey: `profile:${req.id}`,
      relatedType: 'ProfileChangeRequest',
      relatedId: req.id,
      link: '/profile',
      values: {
        review_status: approved ? 'approved' : 'not approved',
        response_note: approved ? 'Your record has been updated.' : req.rejectionReason ?? '',
      },
    });
  }

  // ── Staff in-app notifications ─────────────────────────────────────────────

  async patientMessage(e: PatientMessageSentEvent): Promise<void> {
    const thread = await this.prisma.messageThread.findUnique({ where: { id: e.threadId } });
    if (!thread) return;
    const patient = await this.patientName(thread.patientId);
    const audience = MESSAGE_AUDIENCE[thread.category] ?? MESSAGE_AUDIENCE['GENERAL'];
    await this.outbox.notifyStaff({
      userIds: await this.staffWhere(audience),
      kind: 'PATIENT_MESSAGE',
      title: `Message from ${patient}`,
      body: thread.subject,
      link: `/messages?thread=${thread.id}`,
    });
  }

  async refillRequested(e: RefillRequestedEvent): Promise<void> {
    const req = await this.prisma.refillRequest.findUnique({ where: { id: e.refillRequestId } });
    if (!req) return;
    const rx = await this.prisma.prescription.findUnique({ where: { id: req.prescriptionId } });
    const prescriber = rx ? await this.prisma.staff.findUnique({ where: { id: rx.prescriberId } }) : null;
    const userIds = prescriber?.isActive ? [prescriber.id] : await this.staffWhere(isProviderRole);
    const drug = rx ? (JSON.parse(rx.drugJson) as DrugDose) : null;
    await this.outbox.notifyStaff({
      userIds,
      kind: 'REFILL_REQUEST',
      title: `Refill request from ${await this.patientName(req.patientId)}`,
      body: drug ? `${drug.medicationName} ${drug.strength}` : 'Prescription refill',
      link: '/messages?tab=refills',
    });
  }

  async profileChangeRequested(e: ProfileChangeEvent): Promise<void> {
    const req = await this.prisma.profileChangeRequest.findUnique({ where: { id: e.requestId } });
    if (!req) return;
    await this.outbox.notifyStaff({
      userIds: await this.staffWhere(role => role === UserRole.FrontDesk || role === UserRole.Admin),
      kind: 'PROFILE_UPDATE',
      title: `Profile update from ${await this.patientName(req.patientId)}`,
      body: 'Review contact or insurance changes submitted in the portal.',
      link: '/messages?tab=updates',
    });
  }

  private async staffWhere(predicate: (role: string) => boolean): Promise<string[]> {
    const staff = await this.prisma.staff.findMany({ where: { isActive: true }, select: { id: true, role: true } });
    return staff.filter(s => predicate(s.role)).map(s => s.id);
  }

  private async patientName(id: string): Promise<string> {
    const p = await this.prisma.patient.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
    return p ? `${p.firstName} ${p.lastName}` : 'a patient';
  }
}
