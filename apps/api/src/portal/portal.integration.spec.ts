import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuditAction, MAX_FAILED_LOGINS, UserRole } from '@clinova/identity/domain';
import { ThreadCategory } from '@clinova/portal/domain';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestDatabase } from '../testing/test-database';
import { AuditContext, AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';
import { FileStorageService } from '../storage/file-storage';
import { FeeSchedulesService } from '../billing/fee-schedules.service';
import { InvoicesService } from '../billing/invoices.service';
import { PortalAuthService } from './portal-auth.service';
import { PortalSchedulingService } from './portal-scheduling.service';
import { PortalRecordsService } from './portal-records.service';
import { DECLINE_TEST_CARD, PortalBillingService, SimulatedPaymentGateway } from './portal-billing.service';
import { MessagingService } from './messaging.service';
import { PortalRequestsService } from './portal-requests.service';

const DAY = 86_400_000;
const PASSWORD = 'Portal-Pass-2026';
const anon: AuditContext = { user: null, ipAddress: '127.0.0.1', userAgent: 'jest' };
const staffCtx = (id: string, role: string): AuditContext => ({ user: { id, firstName: 'Staff', lastName: role, role }, ipAddress: null, userAgent: null });

/** Next Monday at least 3 days out, as a UTC date string (tzOffset 0 in these tests). */
function nextMonday(): string {
  const d = new Date(Date.now() + 3 * DAY);
  while (d.getUTCDay() !== 1) d.setTime(d.getTime() + DAY);
  return d.toISOString().slice(0, 10);
}

describe('Patient portal (integration)', () => {
  let prisma: PrismaService;
  let cleanup: () => Promise<void>;
  let storageDir: string;
  let audit: AuditService;
  let auth: PortalAuthService;
  let scheduling: PortalSchedulingService;
  let billing: PortalBillingService;
  let messaging: MessagingService;
  let requests: PortalRequestsService;
  let invoices: InvoicesService;
  let patients: PatientsService;
  const ids = { ada: 'pt-ada', bob: 'pt-bob', doc: 'doc-1', nurse: 'nurse-1', desk: 'desk-1', type: '' };
  const monday = nextMonday();

  beforeAll(async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'clinova-files-'));
    process.env['FILE_STORAGE_DIR'] = storageDir;
    ({ prisma, cleanup } = await createTestDatabase());
    audit = new AuditService(prisma);
    patients = new PatientsService(prisma, audit, new FileStorageService());
    const records = new PortalRecordsService(prisma, patients);
    auth = new PortalAuthService(prisma, new JwtService({ secret: 'test' }), audit);
    scheduling = new PortalSchedulingService(prisma);
    invoices = new InvoicesService(prisma, new FeeSchedulesService(prisma));
    billing = new PortalBillingService(prisma, invoices, new SimulatedPaymentGateway());
    messaging = new MessagingService(prisma, audit);
    requests = new PortalRequestsService(prisma, audit, patients, records);

    const weekdays = JSON.stringify(Array.from({ length: 7 }, (_, d) => ({
      dayOfWeek: d, isWorking: d >= 1 && d <= 5, hours: d >= 1 && d <= 5 ? { start: '09:00', end: '11:00' } : null, lunchBreak: null,
    })));
    await prisma.staff.create({ data: { id: ids.doc, email: 'doc@x', passwordHash: 'x', firstName: 'Wei', lastName: 'Chen', title: 'Dr.', role: 'PHYSICIAN', scheduleJson: weekdays } });
    await prisma.staff.create({ data: { id: ids.nurse, email: 'nurse@x', passwordHash: 'x', firstName: 'Ji', lastName: 'Kim', role: 'NURSE' } });
    await prisma.staff.create({ data: { id: ids.desk, email: 'desk@x', passwordHash: 'x', firstName: 'Marcus', lastName: 'Grant', role: 'STAFF' } });
    const patient = (id: string, lastName: string, email: string) => prisma.patient.create({
      data: {
        id, mrn: `MRN-${id}`, firstName: 'Pat', lastName, dateOfBirth: new Date('1980-05-17T00:00:00Z'), sex: 'FEMALE', consentJson: '{}',
        contactJson: JSON.stringify({ primaryPhone: '555-0100', secondaryPhone: null, email, preferredMethod: 'EMAIL',
          mailingAddress: { street1: '1 Main St', street2: null, city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' }, billingAddress: null }),
      },
    });
    await patient(ids.ada, 'Lovelace', 'ada@example.com');
    await patient(ids.bob, 'Builder', 'bob@example.com');
    ids.type = (await prisma.appointmentType.create({ data: { name: 'Follow-Up Visit', defaultDurationMinutes: 30, isPatientBookable: true, defaultServiceCode: '99213' } })).id;
    await new FeeSchedulesService(prisma).create({ name: 'Std', isDefault: true, lines: [{ cptCode: '99213', description: 'Office visit', priceCents: 15000 }] });
  });

  afterAll(async () => {
    await cleanup();
    rmSync(storageDir, { recursive: true, force: true });
  });

  describe('accounts', () => {
    it('lets existing patients self-register only when name, birth date and email all match', async () => {
      await expect(auth.register({ lastName: 'Lovelace', dateOfBirth: '1980-05-18', email: 'ada@example.com', password: PASSWORD }, anon))
        .rejects.toBeInstanceOf(BadRequestException);
      await expect(auth.register({ lastName: 'Lovelace', dateOfBirth: '1980-05-17', email: 'other@example.com', password: PASSWORD }, anon))
        .rejects.toBeInstanceOf(BadRequestException);
      await expect(auth.register({ lastName: 'lovelace', dateOfBirth: '1980-05-17', email: 'ADA@example.com', password: 'weak' }, anon))
        .rejects.toBeInstanceOf(BadRequestException);

      const session = await auth.register({ lastName: 'lovelace', dateOfBirth: '1980-05-17', email: 'ADA@example.com', password: PASSWORD }, anon);
      expect(session.accessToken).toBeTruthy();
      expect(session.user.patientId).toBe(ids.ada);
      await expect(auth.register({ lastName: 'Lovelace', dateOfBirth: '1980-05-17', email: 'ada@example.com', password: PASSWORD }, anon))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('activates invited accounts with the one-time code', async () => {
      const invite = await auth.invite(ids.bob, undefined, staffCtx(ids.desk, UserRole.FrontDesk));
      expect(invite.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect((await auth.accessSummary(ids.bob)).status).toBe('INVITED');
      await expect(auth.login('bob@example.com', PASSWORD, anon)).rejects.toThrow(/not activated/);
      await expect(auth.activate({ email: 'bob@example.com', code: 'AAAA-AAAA', password: PASSWORD }, anon)).rejects.toBeInstanceOf(BadRequestException);

      const session = await auth.activate({ email: 'bob@example.com', code: invite.code.toLowerCase(), password: PASSWORD }, anon);
      expect(session.user.patientId).toBe(ids.bob);
      await expect(auth.activate({ email: 'bob@example.com', code: invite.code, password: PASSWORD }, anon)).rejects.toBeInstanceOf(BadRequestException);
      await expect(auth.invite(ids.bob, undefined, staffCtx(ids.desk, UserRole.FrontDesk))).rejects.toBeInstanceOf(ConflictException);
    });

    it('locks after repeated failures and supports password reset', async () => {
      for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) await expect(auth.login('bob@example.com', 'nope', anon)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(auth.login('bob@example.com', 'nope', anon)).rejects.toThrow(/locked/);
      await expect(auth.login('bob@example.com', PASSWORD, anon)).rejects.toThrow(/locked/);

      await auth.forgotPassword('bob@example.com', anon);
      const account = await prisma.patientAccount.findUniqueOrThrow({ where: { email: 'bob@example.com' } });
      expect(account.resetTokenHash).toBeTruthy();
      await expect(auth.resetPassword('x'.repeat(64), 'New-Portal-Pass-1', anon)).rejects.toBeInstanceOf(BadRequestException);
      await expect(auth.forgotPassword('nobody@example.com', anon)).resolves.toBeUndefined();
    });
  });

  describe('self-scheduling', () => {
    it('offers slots from the provider schedule and books them', async () => {
      const [day] = await scheduling.availability({ providerId: ids.doc, appointmentTypeId: ids.type, from: monday, days: 1, tzOffset: 0 });
      expect(day.slots.map(s => s.start.toISOString().slice(11, 16))).toEqual(['09:00', '09:30', '10:00', '10:30']);

      const booked = await scheduling.book(ids.ada, { providerId: ids.doc, appointmentTypeId: ids.type, start: `${monday}T09:30:00.000Z`, tzOffset: 0, reasonForVisit: 'Check-up' });
      expect(booked).toMatchObject({ status: 'SCHEDULED', providerName: 'Dr. Wei Chen', canChange: true });

      const [after] = await scheduling.availability({ providerId: ids.doc, appointmentTypeId: ids.type, from: monday, days: 1, tzOffset: 0 });
      expect(after.slots.map(s => s.start.toISOString().slice(11, 16))).toEqual(['09:00', '10:00', '10:30']);
      await expect(scheduling.book(ids.bob, { providerId: ids.doc, appointmentTypeId: ids.type, start: `${monday}T09:30:00.000Z`, tzOffset: 0 }))
        .rejects.toBeInstanceOf(ConflictException);
      await expect(scheduling.book(ids.bob, { providerId: ids.doc, appointmentTypeId: ids.type, start: `${monday}T09:10:00.000Z`, tzOffset: 0 }))
        .rejects.toBeInstanceOf(ConflictException);

      const moved = await scheduling.reschedule(ids.ada, booked.id, { start: `${monday}T10:30:00.000Z`, tzOffset: 0 });
      expect(new Date(moved.start).toISOString().slice(11, 16)).toBe('10:30');
      await expect(scheduling.cancel(ids.bob, booked.id, undefined)).rejects.toBeInstanceOf(NotFoundException);
      expect((await scheduling.cancel(ids.ada, booked.id, 'Feeling better')).status).toBe('CANCELLED');
    });

    it('blocks online changes inside the 24-hour cutoff', async () => {
      const soon = await prisma.appointment.create({
        data: { patientId: ids.ada, providerId: ids.doc, appointmentTypeId: ids.type, slotStart: new Date(Date.now() + 3 * 3_600_000), slotEnd: new Date(Date.now() + 3.5 * 3_600_000) },
      });
      const list = await scheduling.appointments(ids.ada);
      expect(list.find(a => a.id === soon.id)?.canChange).toBe(false);
      await expect(scheduling.cancel(ids.ada, soon.id, undefined)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('billing', () => {
    it('pays open bills by card, rejecting declines and overpayment', async () => {
      const appt = await prisma.appointment.create({
        data: { patientId: ids.ada, providerId: ids.doc, appointmentTypeId: ids.type, slotStart: new Date(Date.now() - 5 * DAY), slotEnd: new Date(Date.now() - 5 * DAY + 1_800_000), status: 'COMPLETED' },
      });
      const enc = await prisma.encounter.create({ data: { patientId: ids.ada, providerId: ids.doc, appointmentId: appt.id, status: 'SIGNED', noteJson: '{}' } });
      const inv = await invoices.createFromEncounter(enc.id);
      expect(await billing.invoiceList(ids.ada)).toEqual([]);
      await invoices.issue(inv.id);
      expect((await billing.summary(ids.ada)).balanceCents).toBe(15000);
      await expect(billing.invoice(ids.bob, inv.id)).rejects.toBeInstanceOf(NotFoundException);

      const user = { id: 'acct', email: 'ada@example.com', role: UserRole.Patient, firstName: 'Pat', lastName: 'Lovelace', patientId: ids.ada };
      const card = { number: '4242 4242 4242 4242', expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', cardholderName: 'Ada Lovelace' };
      await expect(billing.pay(user, { amountCents: 20000, card })).rejects.toThrow(/more than your balance/);
      await expect(billing.pay(user, { amountCents: 5000, card: { ...card, number: DECLINE_TEST_CARD } })).rejects.toThrow(/declined/);

      const payment = await billing.pay(user, { amountCents: 5000, card, saveCard: true });
      expect(payment.method).toBe('PATIENT_PORTAL');
      expect(payment.processedByName).toBe('Patient portal');
      expect((await billing.summary(ids.ada)).balanceCents).toBe(10000);

      const [saved] = await billing.cards(ids.ada);
      expect(saved).toMatchObject({ brand: 'Visa', last4: '4242', isDefault: true });
      expect(JSON.stringify(await prisma.savedPaymentMethod.findMany())).not.toContain('4242424242424242');
      await billing.pay(user, { amountCents: 10000, savedCardId: saved.id });
      expect((await billing.summary(ids.ada)).balanceCents).toBe(0);
    });
  });

  describe('messages & requests', () => {
    it('threads messages with per-side unread state, isolated per patient', async () => {
      const thread = await messaging.startThread(ids.ada, { subject: 'Question about my dose', category: ThreadCategory.Prescription, body: 'Should I take it with food?' }, { id: 'acct', name: 'Pat Lovelace' });
      expect(thread.unread).toBe(false);
      expect((await messaging.inbox({ status: 'OPEN', unreadOnly: true })).map(t => t.id)).toContain(thread.id);
      await expect(messaging.patientThread(ids.bob, thread.id)).rejects.toBeInstanceOf(NotFoundException);

      await messaging.staffReply(thread.id, 'Yes, with breakfast.', { id: ids.nurse, name: 'Ji Kim' }, staffCtx(ids.nurse, UserRole.Nurse));
      expect(await messaging.patientUnreadCount(ids.ada)).toBe(1);
      const read = await messaging.patientThread(ids.ada, thread.id);
      expect(read.messages.map(m => m.authorType)).toEqual(['PATIENT', 'STAFF']);
      expect(await messaging.patientUnreadCount(ids.ada)).toBe(0);
    });

    it('routes refill requests to physicians', async () => {
      const enc = await prisma.encounter.create({ data: { patientId: ids.ada, providerId: ids.doc, status: 'SIGNED', noteJson: '{}' } });
      const rx = await prisma.prescription.create({
        data: { encounterId: enc.id, patientId: ids.ada, prescriberId: ids.doc, refillsAllowed: 2, refillsRemaining: 2,
          drugJson: JSON.stringify({ medicationName: 'Lisinopril', strength: '10 mg', form: 'tablet', route: 'oral', dosageAmount: '1 tablet', frequency: 'daily', durationDays: null }) },
      });
      await expect(requests.requestRefill(ids.bob, { prescriptionId: rx.id })).rejects.toBeInstanceOf(NotFoundException);
      const req = await requests.requestRefill(ids.ada, { prescriptionId: rx.id, pharmacy: 'Main St Pharmacy' });
      expect(req).toMatchObject({ medicationName: 'Lisinopril 10 mg tablet', status: 'PENDING' });
      await expect(requests.requestRefill(ids.ada, { prescriptionId: rx.id })).rejects.toBeInstanceOf(ConflictException);
      await expect(requests.respondRefill(req.id, 'APPROVED', undefined, staffCtx(ids.nurse, UserRole.Nurse))).rejects.toBeInstanceOf(ForbiddenException);
      const approved = await requests.respondRefill(req.id, 'APPROVED', 'Sent to pharmacy', staffCtx(ids.doc, UserRole.Doctor));
      expect(approved).toMatchObject({ status: 'APPROVED', refillsRemaining: 1 });
    });

    it('applies approved profile changes through the audited patient update', async () => {
      const profile = await requests.editableProfile(ids.ada);
      await expect(requests.submitChange(ids.ada, { preferredName: null }, anon)).rejects.toBeInstanceOf(BadRequestException);
      const req = await requests.submitChange(ids.ada, {
        preferredName: 'Countess',
        contact: { ...profile.contact, primaryPhone: '555-0199', bloodType: 'ignored' },
      }, anon);
      expect(Object.keys(req.changes).sort()).toEqual(['contact', 'preferredName']);

      const desk = staffCtx(ids.desk, UserRole.FrontDesk);
      await expect(requests.reviewChange(req.id, 'REJECTED', '', desk)).rejects.toBeInstanceOf(BadRequestException);
      await requests.reviewChange(req.id, 'APPROVED', undefined, desk);
      const updated = await patients.findById(ids.ada);
      expect(updated.preferredName).toBe('Countess');
      expect(updated.contact.primaryPhone).toBe('555-0199');
      const { entries } = await audit.findMany({ patientId: ids.ada, action: AuditAction.Update });
      expect(entries.map(e => e.fieldName)).toEqual(expect.arrayContaining(['preferredName', 'contact']));
    });
  });

  describe('documents', () => {
    it('only exposes shared documents, and only physicians release results', async () => {
      const files = new FileStorageService();
      await files.save('patients/pt-ada/lab.pdf', Buffer.from('%PDF-1.4 test'));
      const doc = await patients.addDocument(ids.ada, { category: 'LAB_REPORT', name: 'CBC.pdf', storageKey: 'patients/pt-ada/lab.pdf', mimeType: 'application/pdf', sizeBytes: 13, uploadedBy: 'Ji Kim' });
      const records = new PortalRecordsService(prisma, patients);
      expect(await records.documents(ids.ada)).toEqual([]);
      await expect(records.documentFile(ids.ada, doc.id)).rejects.toBeInstanceOf(NotFoundException);

      await expect(patients.setDocumentSharing(ids.ada, doc.id, true, null, staffCtx(ids.desk, UserRole.FrontDesk))).rejects.toBeInstanceOf(ForbiddenException);
      await patients.setDocumentSharing(ids.ada, doc.id, true, 'All normal.', staffCtx(ids.doc, UserRole.Doctor));
      const [shared] = await records.documents(ids.ada);
      expect(shared).toMatchObject({ name: 'CBC.pdf', isResult: true, note: 'All normal.', isNew: true });
      expect((await records.documentFile(ids.ada, doc.id)).data.toString()).toContain('%PDF');
      expect((await records.documents(ids.ada))[0].isNew).toBe(false);
      await expect(records.documentFile(ids.bob, doc.id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
