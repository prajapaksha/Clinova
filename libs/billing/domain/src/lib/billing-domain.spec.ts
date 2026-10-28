import {
  agingBucketIndex,
  allocatePayment,
  computeInvoiceTotals,
  deriveInvoiceStatus,
  formatInvoiceNumber,
  InvoiceStatus,
  isInvoiceOpen,
  payerCategory,
} from './billing-domain';

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('billing domain', () => {
  describe('computeInvoiceTotals', () => {
    it('subtracts adjustments and payments from the subtotal', () => {
      expect(computeInvoiceTotals([{ totalCents: 15000 }, { totalCents: 4500 }], [{ amountCents: 2000 }], 5000)).toEqual({
        subtotalCents: 19500,
        totalAdjustmentsCents: 2000,
        totalPaidCents: 5000,
        balanceCents: 12500,
      });
    });
  });

  describe('deriveInvoiceStatus', () => {
    const base = { issuedAt: day('2026-10-01'), voidedAt: null, dueDate: day('2026-10-31'), totalPaidCents: 0, balanceCents: 10000 };
    const now = day('2026-10-15');

    it('is draft until issued and voided once voided', () => {
      expect(deriveInvoiceStatus({ ...base, issuedAt: null }, now)).toBe(InvoiceStatus.Draft);
      expect(deriveInvoiceStatus({ ...base, voidedAt: now }, now)).toBe(InvoiceStatus.Voided);
    });

    it('tracks payment progress', () => {
      expect(deriveInvoiceStatus(base, now)).toBe(InvoiceStatus.Sent);
      expect(deriveInvoiceStatus({ ...base, totalPaidCents: 2000, balanceCents: 8000 }, now)).toBe(InvoiceStatus.PartiallyPaid);
      expect(deriveInvoiceStatus({ ...base, totalPaidCents: 10000, balanceCents: 0 }, now)).toBe(InvoiceStatus.Paid);
    });

    it('is overdue after the due date while a balance remains', () => {
      expect(deriveInvoiceStatus({ ...base, totalPaidCents: 2000, balanceCents: 8000 }, day('2026-11-02'))).toBe(InvoiceStatus.Overdue);
      expect(deriveInvoiceStatus({ ...base, balanceCents: 0 }, day('2026-11-02'))).toBe(InvoiceStatus.Paid);
    });

    it('treats only issued unpaid invoices as open', () => {
      expect([InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Overdue].every(isInvoiceOpen)).toBe(true);
      expect([InvoiceStatus.Draft, InvoiceStatus.Paid, InvoiceStatus.Voided].some(isInvoiceOpen)).toBe(false);
    });
  });

  describe('allocatePayment', () => {
    const open = [{ id: 'a', balanceCents: 3000 }, { id: 'b', balanceCents: 5000 }];

    it('pays invoices in order and splits across them', () => {
      expect(allocatePayment(6000, open)).toEqual({
        allocations: [{ invoiceId: 'a', amountCents: 3000 }, { invoiceId: 'b', amountCents: 3000 }],
        unappliedCents: 0,
      });
    });

    it('keeps overpayment as unapplied credit', () => {
      expect(allocatePayment(9000, open).unappliedCents).toBe(1000);
    });

    it('skips invoices without a balance', () => {
      expect(allocatePayment(1000, [{ id: 'x', balanceCents: 0 }, ...open]).allocations).toEqual([{ invoiceId: 'a', amountCents: 1000 }]);
    });
  });

  it('agingBucketIndex groups by days since issue', () => {
    const now = day('2026-10-31');
    expect(agingBucketIndex(day('2026-10-20'), now)).toBe(0);
    expect(agingBucketIndex(day('2026-09-20'), now)).toBe(1);
    expect(agingBucketIndex(day('2026-08-15'), now)).toBe(2);
    expect(agingBucketIndex(day('2026-06-01'), now)).toBe(3);
  });

  it('payerCategory classifies plan names', () => {
    expect(payerCategory('Medicare Part B')).toBe('MEDICARE');
    expect(payerCategory('Illinois Medicaid — HFS')).toBe('MEDICAID');
    expect(payerCategory('Anthem Blue Cross PPO')).toBe('PRIVATE');
    expect(payerCategory(null)).toBe('SELF_PAY');
  });

  it('formatInvoiceNumber pads the sequence', () => {
    expect(formatInvoiceNumber(42)).toBe('INV-000042');
  });
});
