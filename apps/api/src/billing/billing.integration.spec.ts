import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdjustmentType, ClaimStatus, InvoiceStatus, PaymentMethod } from '@clinova/billing/domain';
import type { AuthUser } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { createTestDatabase } from '../testing/test-database';
import { InvoicesService } from './invoices.service';
import { ClaimsService } from './claims.service';
import { FeeSchedulesService } from './fee-schedules.service';
import { BillingSummaryService, lastMonths } from './billing-summary.service';

const DAY = 86_400_000;

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected a value');
  return value;
}
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const billing: AuthUser = { id: 'staff-billing', email: 'b@x', role: 'BILLING', firstName: 'Bea', lastName: 'Biller' };

describe('Billing services (integration)', () => {
  let prisma: PrismaService;
  let cleanup: () => Promise<void>;
  let invoices: InvoicesService;
  let claims: ClaimsService;
  let summary: BillingSummaryService;
  let patientId: string;
  let selfPayPatientId: string;
  let encounterId: string;

  beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDatabase());
    const feeSchedules = new FeeSchedulesService(prisma);
    invoices = new InvoicesService(prisma, feeSchedules);
    claims = new ClaimsService(prisma, invoices);
    summary = new BillingSummaryService(prisma, invoices);

    await prisma.staff.create({ data: { id: 'doc-1', email: 'd@x', passwordHash: 'x', firstName: 'Wei', lastName: 'Chen', role: 'PHYSICIAN' } });
    await prisma.staff.create({ data: { id: billing.id, email: billing.email, passwordHash: 'x', firstName: 'Bea', lastName: 'Biller', role: 'BILLING' } });
    await feeSchedules.create({
      name: 'Standard',
      isDefault: true,
      lines: [
        { cptCode: '99213', description: 'Office visit, established, low complexity', priceCents: 15000 },
        { cptCode: '99203', description: 'Office visit, new patient, low complexity', priceCents: 20000 },
        { cptCode: '36415', description: 'Venipuncture', priceCents: 2500 },
      ],
    });

    const patient = (id: string, policies: unknown[]) => prisma.patient.create({
      data: {
        id, mrn: `MRN-${id}`, firstName: 'Pat', lastName: id, dateOfBirth: new Date('1970-01-01'), sex: 'FEMALE',
        contactJson: JSON.stringify({ mailingAddress: { street1: '1 Main St', street2: null, city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' }, billingAddress: null }),
        consentJson: '{}',
        insurancePoliciesJson: JSON.stringify(policies),
      },
    });
    patientId = (await patient('insured', [{ id: 'pol-1', isPrimary: true, provider: 'Medicare Part B', policyNumber: 'MCR-1' }])).id;
    selfPayPatientId = (await patient('selfpay', [])).id;

    const type = await prisma.appointmentType.create({ data: { name: 'Follow-Up Visit', defaultServiceCode: '99213' } });
    const appt = await prisma.appointment.create({
      data: { patientId, providerId: 'doc-1', appointmentTypeId: type.id, slotStart: new Date('2026-10-20T14:00:00Z'), slotEnd: new Date('2026-10-20T14:15:00Z'), status: 'COMPLETED' },
    });
    encounterId = (await prisma.encounter.create({
      data: { patientId, providerId: 'doc-1', appointmentId: appt.id, status: 'SIGNED', noteJson: '{}' },
    })).id;
  });

  afterAll(async () => cleanup());

  describe('invoice lifecycle', () => {
    it('drafts an invoice from a signed encounter using the visit type code and fee schedule', async () => {
      const inv = await invoices.createFromEncounter(encounterId);

      expect(inv.status).toBe(InvoiceStatus.Draft);
      expect(inv.number).toBe('INV-000001');
      expect(inv.lines).toEqual([expect.objectContaining({ serviceCode: '99213', unitPriceCents: 15000, totalCents: 15000 })]);
      expect(inv.serviceDate).toEqual(new Date('2026-10-20T14:00:00Z'));
      expect(inv.providerName).toBe('Dr. Wei Chen');
    });

    it('is idempotent per encounter', async () => {
      const again = await invoices.createFromEncounter(encounterId);
      expect(again.number).toBe('INV-000001');
      expect(await prisma.invoice.count()).toBe(1);
    });

    it('drafts automatically when the encounter-signed event is published', async () => {
      const bus = new DomainEventBus();
      const listening = new InvoicesService(prisma, new FeeSchedulesService(prisma), bus);
      listening.onModuleInit();
      const enc = await prisma.encounter.create({ data: { patientId, providerId: 'doc-1', status: 'SIGNED', noteJson: '{}' } });

      bus.publish({ type: 'clinical.EncounterSigned', encounterId: enc.id, timestamp: new Date() } as never);
      await new Promise(r => setTimeout(r, 50));

      const drafted = await invoices.findByEncounter(enc.id);
      expect(drafted?.notes).toContain('No billable service codes');
      await prisma.invoice.delete({ where: { id: must(drafted).id } });
      bus.onModuleDestroy();
    });

    it('edits drafts, refuses to issue an empty invoice, then issues with a due date', async () => {
      const draft = await invoices.createDraft({ patientId, providerId: 'doc-1', lines: [] }, billing);
      await expect(invoices.issue(draft.id)).rejects.toBeInstanceOf(BadRequestException);

      await invoices.updateDraft(draft.id, { lines: [{ serviceCode: '36415', quantity: 2 }] });
      const issuedAt = daysAgo(2);
      const issued = await invoices.issue(draft.id, issuedAt);

      expect(issued.subtotalCents).toBe(5000);
      expect(issued.dueDate).toEqual(new Date(issuedAt.getTime() + 30 * DAY));
      await expect(invoices.updateDraft(draft.id, { notes: 'x' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects unknown codes without a price', async () => {
      await expect(invoices.createDraft({ patientId, lines: [{ serviceCode: 'XYZ', quantity: 1 }] }, billing))
        .rejects.toThrow(/No price for service code XYZ/);
    });
  });

  describe('payments', () => {
    let older: string;
    let newer: string;

    beforeAll(async () => {
      older = must(await invoices.findByEncounter(encounterId)).id;
      await invoices.issue(older, daysAgo(5));
      newer = (await invoices.findMany({ patientId, status: InvoiceStatus.Sent })).invoices.find(i => i.id !== older)?.id as string;
    });

    it('requires a check number for checks', async () => {
      await expect(invoices.takePayment({ patientId, amountCents: 100, method: PaymentMethod.Check }, billing))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies payments oldest-first and keeps overpayment as credit', async () => {
      const payment = await invoices.takePayment({ patientId, amountCents: 17000, method: PaymentMethod.CreditCard, referenceNumber: 'AUTH-1' }, billing);

      expect(payment.allocations.map(a => [a.invoiceNumber, a.amountCents])).toEqual([['INV-000001', 15000], ['INV-000003', 2000]]);
      expect(payment.unappliedCents).toBe(0);
      expect((await invoices.findById(older)).status).toBe(InvoiceStatus.Paid);
      expect((await invoices.findById(newer)).status).toBe(InvoiceStatus.PartiallyPaid);

      const credit = await invoices.takePayment({ patientId, amountCents: 4000, method: PaymentMethod.Cash, invoiceIds: [newer] }, billing);
      expect(credit.unappliedCents).toBe(1000);
      expect((await invoices.statement(patientId)).creditCents).toBe(1000);
    });

    it('locks paid invoices against adjustments and voiding', async () => {
      await expect(invoices.addAdjustment(older, { type: AdjustmentType.CourtesyDiscount, amountCents: 100, reason: 'courtesy' }, billing))
        .rejects.toThrow(/credit memo/);
      await expect(invoices.void(older, 'mistake', billing)).rejects.toBeInstanceOf(ConflictException);
    });

    it('reopens the balance when a payment is voided', async () => {
      const list = await invoices.listPayments({ patientId });
      const card = must(list.find(p => p.referenceNumber === 'AUTH-1'));
      await invoices.voidPayment(card.id, 'Duplicate charge', billing);

      expect((await invoices.findById(older)).balanceCents).toBe(15000);
      await expect(invoices.voidPayment(card.id, 'again', billing)).rejects.toBeInstanceOf(ConflictException);
    });

    it('limits adjustments to the remaining balance', async () => {
      await expect(invoices.addAdjustment(older, { type: AdjustmentType.Writeoff, amountCents: 999999, reason: 'too much' }, billing))
        .rejects.toThrow(/cannot exceed/);
      const adjusted = await invoices.addAdjustment(older, { type: AdjustmentType.CourtesyDiscount, amountCents: 1000, reason: 'Courtesy' }, billing);
      expect(adjusted.balanceCents).toBe(14000);
      expect(adjusted.adjustments[0].appliedByName).toBe('Bea Biller');
    });
  });

  describe('claims', () => {
    it('files against the primary policy and enforces the status pipeline', async () => {
      const inv = must(await invoices.findByEncounter(encounterId));
      const claim = await claims.create({ invoiceId: inv.id });
      expect(claim).toEqual(expect.objectContaining({ payerName: 'Medicare Part B', status: ClaimStatus.Draft, billedCents: 15000 }));

      await expect(claims.create({ invoiceId: inv.id })).rejects.toBeInstanceOf(ConflictException);
      await expect(claims.update(claim.id, { status: ClaimStatus.Paid, paidAmountCents: 100 }, billing)).rejects.toBeInstanceOf(ConflictException);
      await expect(claims.update(claim.id, { status: ClaimStatus.Submitted }, billing)).resolves.toEqual(expect.objectContaining({ status: ClaimStatus.Submitted }));
      await expect(claims.update(claim.id, { status: ClaimStatus.Denied }, billing)).rejects.toThrow(/denial reason/);
    });

    it('records the insurer payment and contractual write-down when paid', async () => {
      const inv = must(await invoices.findByEncounter(encounterId));
      const [claim] = await claims.findMany({ patientId });

      const paid = await claims.update(claim.id, { status: ClaimStatus.Paid, paidAmountCents: 9000, contractualAdjustmentCents: 5000 }, billing);
      const after = await invoices.findById(inv.id);

      expect(paid.status).toBe(ClaimStatus.Paid);
      expect(after.payments.some(p => p.method === PaymentMethod.Insurance && p.amountCents === 9000)).toBe(true);
      expect(after.adjustments.map(a => a.type)).toContain(AdjustmentType.InsuranceContractual);
      expect(after.status).toBe(InvoiceStatus.Paid);
    });

    it('refuses claims for patients without insurance', async () => {
      const inv = await invoices.createDraft({ patientId: selfPayPatientId, lines: [{ serviceCode: '99203', quantity: 1 }] }, billing);
      await invoices.issue(inv.id);
      await expect(claims.create({ invoiceId: inv.id })).rejects.toThrow(/no insurance/);
    });
  });

  describe('summary', () => {
    it('reports AR, aging, collections, and payer mix', async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const s = await summary.getSummary({ date: today, tzOffset: 0 }, now);

      expect(s.totalArCents).toBe(s.aging.reduce((sum, b) => sum + b.totalCents, 0));
      expect(s.totalArCents).toBeGreaterThan(0);
      expect(s.aging.map(b => b.label)).toEqual(['0-30 days', '31-60 days', '61-90 days', '90+ days']);
      expect(s.revenueTrend.map(m => m.month)).toEqual(lastMonths(today, 6));
      expect(s.payerMix.map(p => p.category).sort()).toEqual(['MEDICARE', 'SELF_PAY']);
      expect(s.payerMix.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1);
      expect(s.recentInvoices.length).toBeGreaterThan(0);
    });
  });
});
