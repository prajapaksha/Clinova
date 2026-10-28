import type { PrismaService } from '@clinova/api/shared';
import type { Adjustment, InvoiceLine } from '@clinova/billing/domain';
import { computeInvoiceTotals } from '@clinova/billing/domain';

export interface InvoiceBalance {
  id: string;
  number: string;
  patientId: string;
  dueDate: Date | null;
  totalCents: number;
  balanceCents: number;
}

/** Balances of issued, non-voided invoices (computed the same way as the billing context). */
export async function invoiceBalances(prisma: PrismaService, where: { patientId?: string; ids?: string[] }): Promise<InvoiceBalance[]> {
  const rows = await prisma.invoice.findMany({
    where: {
      issuedAt: { not: null },
      voidedAt: null,
      ...(where.patientId ? { patientId: where.patientId } : {}),
      ...(where.ids ? { id: { in: where.ids } } : {}),
    },
    include: { allocations: { include: { payment: { select: { voidedAt: true } } } } },
  });
  return rows.map(r => {
    const paid = r.allocations.filter(a => !a.payment.voidedAt).reduce((s, a) => s + a.amountCents, 0);
    const totals = computeInvoiceTotals(JSON.parse(r.linesJson) as InvoiceLine[], JSON.parse(r.adjustmentsJson) as Adjustment[], paid);
    return {
      id: r.id, number: r.number, patientId: r.patientId, dueDate: r.dueDate,
      totalCents: totals.subtotalCents - totals.totalAdjustmentsCents, balanceCents: totals.balanceCents,
    };
  });
}

export async function patientBalanceCents(prisma: PrismaService, patientId: string): Promise<number> {
  return (await invoiceBalances(prisma, { patientId })).reduce((s, i) => s + Math.max(i.balanceCents, 0), 0);
}