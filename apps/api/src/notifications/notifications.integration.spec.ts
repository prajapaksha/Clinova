import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  AppointmentNotices,
  DeliveryProviders,
  NotificationDispatcher,
  NotificationEventHandlers,
  NotificationOutbox,
  NotificationQueries,
  NotificationScheduler,
  NotificationTemplates,
  PracticeSettings,
} from '@clinova/api/notifications';
import { DomainEventBus } from '@clinova/api/shared';
import { NotificationChannel, NotificationStatus, NotificationType } from '@clinova/notifications/domain';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestDatabase } from '../testing/test-database';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const flush = () => new Promise(r => setTimeout(r, 50));

describe('Notifications (integration)', () => {
  let prisma: PrismaService;
  let cleanup: () => Promise<void>;
  let outDir: string;
  let outbox: NotificationOutbox;
  let templates: NotificationTemplates;
  let appointments: AppointmentNotices;
  let dispatcher: NotificationDispatcher;
  let scheduler: NotificationScheduler;
  let queries: NotificationQueries;
  let providers: DeliveryProviders;
  let bus: DomainEventBus;
  const sent: Array<{ channel: string; to: string; body: string }> = [];
  let smsFails = false;
  const ids = { pat: 'pt-1', bare: 'pt-2', doc: 'doc-1', nurse: 'nurse-1', desk: 'desk-1', type: '', account: '' };

  const rows = (where: Record<string, unknown> = {}) => prisma.notification.findMany({ where, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'clinova-outbox-'));
    process.env['FILE_STORAGE_DIR'] = outDir;
    process.env['PRACTICE_TIMEZONE'] = 'UTC';
    ({ prisma, cleanup } = await createTestDatabase());
    const practice = new PracticeSettings();
    providers = new DeliveryProviders();
    (providers as { email: unknown }).email = { name: 'fake-email', send: async (m: { to: string; body: string }) => { sent.push({ channel: 'EMAIL', ...m }); return { provider: 'fake-email', providerMessageId: 'e1' }; } };
    (providers as { sms: unknown }).sms = {
      name: 'fake-sms',
      send: async (m: { to: string; body: string }) => {
        if (smsFails) throw new Error('carrier unavailable');
        sent.push({ channel: 'SMS', ...m });
        return { provider: 'fake-sms', providerMessageId: 's1' };
      },
    };
    templates = new NotificationTemplates(prisma);
    outbox = new NotificationOutbox(prisma, templates, practice);
    appointments = new AppointmentNotices(prisma, outbox, practice);
    dispatcher = new NotificationDispatcher(prisma, providers, appointments, practice);
    scheduler = new NotificationScheduler(prisma, appointments, outbox, practice);
    queries = new NotificationQueries(prisma);
    bus = new DomainEventBus();
    new NotificationEventHandlers(bus, prisma, outbox, appointments, practice).onModuleInit();

    await prisma.staff.create({ data: { id: ids.doc, email: 'doc@x', passwordHash: 'x', firstName: 'Wei', lastName: 'Chen', title: 'Dr.', role: 'PHYSICIAN', officeLocation: 'Room 204' } });
    await prisma.staff.create({ data: { id: ids.nurse, email: 'nurse@x', passwordHash: 'x', firstName: 'Ji', lastName: 'Kim', role: 'NURSE' } });
    await prisma.staff.create({ data: { id: ids.desk, email: 'desk@x', passwordHash: 'x', firstName: 'Marcus', lastName: 'Grant', role: 'STAFF' } });
    const patient = (id: string, contact: object) => prisma.patient.create({
      data: { id, mrn: `MRN-${id}`, firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: new Date('1980-01-01'), sex: 'FEMALE', consentJson: '{}', contactJson: JSON.stringify(contact) },
    });
    await patient(ids.pat, { email: 'ada@example.com', primaryPhone: '+15550100' });
    await patient(ids.bare, { email: null, primaryPhone: '+15550199' });
    ids.account = (await prisma.patientAccount.create({
      data: { patientId: ids.pat, email: 'ada@example.com', status: 'ACTIVE', notificationPrefsJson: JSON.stringify({ billing: { email: false, sms: false } }) },
    })).id;
    ids.type = (await prisma.appointmentType.create({ data: { name: 'Follow-Up Visit' } })).id;
  });

  afterAll(async () => {
    await cleanup();
    rmSync(outDir, { recursive: true, force: true });
  });

  const appointment = (start: Date, patientId = ids.pat) => prisma.appointment.create({
    data: { patientId, providerId: ids.doc, appointmentTypeId: ids.type, slotStart: start, slotEnd: new Date(start.getTime() + HOUR / 2) },
  });

  describe('outbox', () => {
    it('renders each channel once and skips duplicates', async () => {
      const n = { type: NotificationType.AppointmentConfirmation, patientId: ids.pat, dedupeKey: 'test-confirm', values: { provider_name: 'Dr. Wei Chen', appointment_date: 'Friday, November 6', appointment_time: '9:00 AM' } };
      expect(await outbox.notifyPatient(n)).toBe(2);
      expect(await outbox.notifyPatient(n)).toBe(0);
      const [email, sms] = await rows({ dedupeKey: { startsWith: 'test-confirm' } });
      expect(email).toMatchObject({ channel: 'EMAIL', status: 'QUEUED', recipient: 'ada@example.com', subject: 'Your appointment on Friday, November 6 is confirmed' });
      expect(sms.body).toContain('Dr. Wei Chen on Friday, November 6 at 9:00 AM');
    });

    it('honours preferences and missing contact details, keeping a record of why', async () => {
      await outbox.notifyPatient({ type: NotificationType.InvoiceIssued, patientId: ids.pat, dedupeKey: 'test-invoice', values: { invoice_amount: '$10.00' } });
      const [email, portal] = await rows({ dedupeKey: { startsWith: 'test-invoice' } });
      expect(email).toMatchObject({ status: 'SUPPRESSED', statusReason: 'Patient turned off email for this topic' });
      expect(portal).toMatchObject({ channel: 'PORTAL', status: 'SENT', recipient: ids.account });

      await outbox.notifyPatient({ type: NotificationType.NoShowFollowUp, patientId: ids.bare, dedupeKey: 'test-bare' });
      expect((await rows({ dedupeKey: { startsWith: 'test-bare' } }))[0]).toMatchObject({ status: 'SUPPRESSED', statusReason: 'No email address on file' });
    });

    it('uses practice templates and lets the practice turn a message off', async () => {
      await templates.save(NotificationType.PaymentReceipt, NotificationChannel.Portal, { subject: 'Thanks!', body: 'We got {{payment_amount}}.', isActive: true }, ids.desk);
      await outbox.notifyPatient({ type: NotificationType.PaymentReceipt, patientId: ids.pat, dedupeKey: 'test-pay', values: { payment_amount: '$5.00' } });
      expect((await rows({ dedupeKey: 'test-pay:PORTAL' }))[0]).toMatchObject({ subject: 'Thanks!', body: 'We got $5.00.' });
      await expect(templates.save(NotificationType.PaymentReceipt, NotificationChannel.Portal, { subject: 'x', body: '{{appointment_date}}', isActive: true }, null)).rejects.toThrow(/Unknown merge field/);

      await templates.save(NotificationType.NoShowFollowUp, NotificationChannel.Email, { subject: 'Missed', body: 'Hi', isActive: false }, null);
      await outbox.notifyPatient({ type: NotificationType.NoShowFollowUp, patientId: ids.pat, dedupeKey: 'test-off' });
      expect((await rows({ dedupeKey: 'test-off:EMAIL' }))[0].statusReason).toBe('Template turned off by the practice');
      await templates.reset(NotificationType.NoShowFollowUp, NotificationChannel.Email);
    });
  });

  describe('appointments', () => {
    it('confirms, schedules reminders, and reschedules them when the visit moves', async () => {
      const now = new Date();
      const appt = await appointment(new Date(now.getTime() + 3 * DAY));
      await appointments.booked(appt.id, now);
      const queued = await rows({ appointmentId: appt.id });
      expect(queued.map(r => `${r.type}/${r.channel}`).sort()).toEqual([
        'APPOINTMENT_CONFIRMATION/EMAIL', 'APPOINTMENT_CONFIRMATION/SMS',
        'APPOINTMENT_REMINDER_2H/EMAIL', 'APPOINTMENT_REMINDER_2H/SMS',
        'APPOINTMENT_REMINDER_48H/EMAIL', 'APPOINTMENT_REMINDER_48H/SMS',
      ]);
      expect(queued.find(r => r.type === 'APPOINTMENT_REMINDER_48H')?.scheduledFor.getTime()).toBe(appt.slotStart.getTime() - 48 * HOUR);

      await prisma.appointment.update({ where: { id: appt.id }, data: { slotStart: new Date(appt.slotStart.getTime() + DAY) } });
      await appointments.rescheduled(appt.id, now);
      const after = await rows({ appointmentId: appt.id });
      expect(after.filter(r => r.status === 'CANCELLED' && r.type.startsWith('APPOINTMENT_REMINDER'))).toHaveLength(4);
      expect(after.filter(r => r.status === 'QUEUED' && r.type.startsWith('APPOINTMENT_REMINDER'))).toHaveLength(4);
      expect(after.filter(r => r.type === 'APPOINTMENT_RESCHEDULED')).toHaveLength(2);
    });

    it('backfills reminders for upcoming visits without duplicating them', async () => {
      const now = new Date();
      const appt = await appointment(new Date(now.getTime() + 30 * HOUR));
      expect(await scheduler.ensureReminders(now)).toBeGreaterThanOrEqual(2);
      expect(await scheduler.ensureReminders(now)).toBe(0);
      expect((await rows({ appointmentId: appt.id })).map(r => r.type)).toEqual(['APPOINTMENT_REMINDER_2H', 'APPOINTMENT_REMINDER_2H']);
    });
  });

  describe('dispatch', () => {
    beforeEach(async () => {
      await prisma.notification.deleteMany({});
      sent.length = 0;
      smsFails = false;
    });

    it('delivers due messages, retries failures with backoff, and gives up after max attempts', async () => {
      const noon = new Date('2030-03-04T12:00:00Z');
      await outbox.notifyPatient({ type: NotificationType.RefillApproved, patientId: ids.pat, dedupeKey: 'd1', scheduledFor: noon, values: { medication_name: 'Metformin', pharmacy: 'Main St' } });
      smsFails = true;
      const first = await dispatcher.dispatchDue(noon);
      expect(first).toMatchObject({ sent: 1, retried: 1 });
      expect(sent.map(s => s.channel)).toEqual(['EMAIL']);
      const sms = (await rows({ channel: 'SMS' }))[0];
      expect(sms).toMatchObject({ status: 'QUEUED', attempts: 1, lastError: 'carrier unavailable' });
      expect(sms.scheduledFor.getTime()).toBe(noon.getTime() + 60_000);

      let t = noon;
      for (let i = 0; i < 6; i++) {
        t = new Date(t.getTime() + 2 * HOUR);
        await dispatcher.dispatchDue(new Date(Math.min(t.getTime(), new Date('2030-03-04T20:00:00Z').getTime())));
      }
      expect((await rows({ channel: 'SMS' }))[0]).toMatchObject({ status: 'FAILED', attempts: 5 });
      const retried = await queries.retry(sms.id);
      expect(retried.status).toBe(NotificationStatus.Queued);
    });

    it('defers texts during quiet hours and cancels reminders for moved appointments', async () => {
      const night = new Date('2030-03-05T03:00:00Z');
      await outbox.notifyPatient({ type: NotificationType.RefillApproved, patientId: ids.pat, dedupeKey: 'd2', scheduledFor: night, values: {} });
      expect(await dispatcher.dispatchDue(night)).toMatchObject({ sent: 1, deferred: 1 });
      expect((await rows({ channel: 'SMS' }))[0].scheduledFor.toISOString()).toBe('2030-03-05T08:00:00.000Z');

      const appt = await appointment(new Date('2030-03-10T15:00:00Z'));
      await appointments.scheduleReminders(appt, new Date('2030-03-01T00:00:00Z'));
      await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED' } });
      const summary = await dispatcher.dispatchDue(new Date('2030-03-08T16:00:00Z'));
      expect(summary.cancelled).toBe(2);
    });
  });

  describe('events and notification centers', () => {
    it('notifies the patient of replies and the prescriber of refill requests', async () => {
      const thread = await prisma.messageThread.create({
        data: { patientId: ids.pat, subject: 'Dose question', messages: { create: { authorType: 'STAFF', authorId: ids.nurse, authorName: 'Ji Kim', body: 'Take with food.' } } },
        include: { messages: true },
      });
      bus.publish({ type: 'portal.CareTeamReplied', threadId: thread.id, messageId: thread.messages[0].id, timestamp: new Date() });
      await flush();
      const portal = await queries.portal(ids.account);
      expect(portal.items[0]).toMatchObject({ title: 'New reply: Dose question', link: `/messages/${thread.id}`, read: false });
      await queries.markPortalRead(ids.account);
      expect((await queries.portal(ids.account)).unread).toBe(0);

      const enc = await prisma.encounter.create({ data: { patientId: ids.pat, providerId: ids.doc, status: 'SIGNED', noteJson: '{}' } });
      const rx = await prisma.prescription.create({
        data: { encounterId: enc.id, patientId: ids.pat, prescriberId: ids.doc, drugJson: JSON.stringify({ medicationName: 'Metformin', strength: '500 mg' }) },
      });
      const req = await prisma.refillRequest.create({ data: { patientId: ids.pat, prescriptionId: rx.id } });
      bus.publish({ type: 'portal.RefillRequested', refillRequestId: req.id, timestamp: new Date() });
      bus.publish({ type: 'portal.PatientMessageSent', threadId: thread.id, messageId: thread.messages[0].id, timestamp: new Date() });
      await flush();
      expect((await queries.staff(ids.doc)).items.map(i => i.kind)).toEqual(['REFILL_REQUEST']);
      expect((await queries.staff(ids.desk)).items.map(i => i.title)).toEqual(['Message from Ada Lovelace']);
    });

    it('sends one 30-day balance reminder per patient covering all overdue bills', async () => {
      const bill = (number: string, daysAgo: number) => {
        const due = new Date(Date.now() - daysAgo * DAY);
        return prisma.invoice.create({
          data: {
            number, patientId: ids.pat, providerId: ids.doc, serviceDate: due, issuedAt: due, dueDate: due,
            linesJson: JSON.stringify([{ id: 'l1', serviceCode: '99213', description: 'Visit', quantity: 1, unitPriceCents: 9000, totalCents: 9000, notes: null }]),
          },
        });
      };
      const oldest = await bill('INV-1', 40);
      await bill('INV-2', 35);
      // Billing email is turned off for this patient: the reminder is logged as suppressed.
      expect(await scheduler.statementReminders()).toBe(1);
      expect(await scheduler.statementReminders()).toBe(0);
      const [reminder] = await rows({ type: NotificationType.StatementReminder30d });
      expect(reminder).toMatchObject({ status: 'SUPPRESSED', relatedType: 'Invoice', relatedId: oldest.id });
      expect(reminder.body).toContain('past-due balance of $180.00 (oldest bill INV-1');
    });
  });
});
