import { Injectable } from '@nestjs/common';
import type { BillingSummary, MonthlyRevenue, PayerCategory, PayerMixEntry } from '@clinova/billing/domain';
import { AGING_BUCKETS, ClaimStatus, InvoiceStatus, agingBucketIndex, payerCategory } from '@clinova/billing/domain';
import type { InsurancePolicy } from '@clinova/patient/domain';
import { PrismaService } from '../prisma/prisma.service';
import { LocalClock } from '../common/local-clock';
import { INVOICE_INCLUDE, InvoiceWithRelations, invoiceStatus, invoiceTotals, parseAdjustments, parseLines, toInvoice } from './billing.mapper';
import { InvoicesService } from './invoices.service';

const DAY_MS = 86_400_000;
const TREND_MONTHS = 6;
const OPEN_CLAIM_STATUSES = [ClaimStatus.Draft, ClaimStatus.Submitted, ClaimStatus.Pending, ClaimStatus.Denied, ClaimStatus.Appealed];
const PAYER_ORDER: PayerCategory[] = ['PRIVATE', 'MEDICARE', 'MEDICAID', 'SELF_PAY'];

@Injectable()
export class BillingSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  async getSummary(query: { date: string; tzOffset: number }, now = new Date()): Promise<BillingSummary> {
    const clock = new LocalClock(query.tzOffset);
    const todayKey = query.date;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const months = lastMonths(todayKey, TREND_MONTHS);
    const trendStart = clock.midnight(`${months[0]}-01`);

    const [invoiceRows, payments, openClaims, recentRows] = await Promise.all([
      this.prisma.invoice.findMany({ where: { issuedAt: { not: null } }, include: INVOICE_INCLUDE }),
      this.prisma.payment.findMany({
        where: { processedAt: { gte: trendStart < thirtyDaysAgo ? trendStart : thirtyDaysAgo } },
        select: { amountCents: true, processedAt: true, voidedAt: true },
      }),
      this.prisma.insuranceClaim.count({ where: { status: { in: OPEN_CLAIM_STATUSES } } }),
      this.prisma.invoice.findMany({ include: INVOICE_INCLUDE, orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    const draftCount = await this.prisma.invoice.count({ where: { issuedAt: null, voidedAt: null } });

    const live = invoiceRows.filter(r => !r.voidedAt);
    const open = live.filter(r => invoiceTotals(r).balanceCents > 0);

    // Accounts receivable now, and as it stood 30 days ago (for the trend).
    const totalArCents = open.reduce((sum, r) => sum + invoiceTotals(r).balanceCents, 0);
    const arThirtyDaysAgoCents = invoiceRows.reduce((sum, r) => {
      const t = thirtyDaysAgo.getTime();
      if (!r.issuedAt || r.issuedAt.getTime() > t || (r.voidedAt && r.voidedAt.getTime() <= t)) return sum;
      const charged = parseLines(r).reduce((s, l) => s + l.totalCents, 0);
      const adjusted = parseAdjustments(r).filter(a => a.appliedAt.getTime() <= t).reduce((s, a) => s + a.amountCents, 0);
      const paid = r.allocations
        .filter(a => a.payment.processedAt.getTime() <= t && (!a.payment.voidedAt || a.payment.voidedAt.getTime() > t))
        .reduce((s, a) => s + a.amountCents, 0);
      return sum + Math.max(charged - adjusted - paid, 0);
    }, 0);

    const validPayments = payments.filter(p => !p.voidedAt);
    const today = validPayments.filter(p => clock.dateKey(p.processedAt) === todayKey);
    const last30 = validPayments.filter(p => p.processedAt >= thirtyDaysAgo);

    const aging = AGING_BUCKETS.map(b => ({ label: b.label, totalCents: 0, invoiceCount: 0 }));
    for (const r of open) {
      const bucket = aging[agingBucketIndex(r.issuedAt as Date, now)];
      bucket.totalCents += invoiceTotals(r).balanceCents;
      bucket.invoiceCount++;
    }

    const revenueTrend: MonthlyRevenue[] = months.map(month => ({
      month,
      chargedCents: live
        .filter(r => clock.monthKey(r.issuedAt as Date) === month)
        .reduce((sum, r) => sum + invoiceTotals(r).subtotalCents, 0),
      collectedCents: validPayments
        .filter(p => clock.monthKey(p.processedAt) === month)
        .reduce((sum, p) => sum + p.amountCents, 0),
    }));

    const inWindow = live.filter(r => (r.issuedAt as Date) >= trendStart);
    const names = await this.invoices.names(recentRows);

    return {
      totalArCents,
      arThirtyDaysAgoCents,
      collectedTodayCents: today.reduce((sum, p) => sum + p.amountCents, 0),
      paymentsToday: today.length,
      averageDailyCollectionsCents: Math.round(last30.reduce((sum, p) => sum + p.amountCents, 0) / 30),
      aging,
      revenueTrend,
      payerMix: await this.payerMix(inWindow),
      draftCount,
      overdueCount: live.filter(r => invoiceStatus(r, now) === InvoiceStatus.Overdue).length,
      openClaims,
      recentInvoices: recentRows.map(r => toInvoice(r, names, now)),
    };
  }

  private async payerMix(rows: InvoiceWithRelations[]): Promise<PayerMixEntry[]> {
    const ids = [...new Set(rows.map(r => r.patientId))];
    const patients = ids.length
      ? await this.prisma.patient.findMany({ where: { id: { in: ids } }, select: { id: true, insurancePoliciesJson: true } })
      : [];
    const categoryByPatient = new Map(patients.map(p => {
      const policies: InsurancePolicy[] = JSON.parse(p.insurancePoliciesJson);
      const primary = policies.find(x => x.isPrimary) ?? policies[0];
      return [p.id, payerCategory(primary?.provider)];
    }));

    const totals = new Map<PayerCategory, number>();
    for (const r of rows) {
      const cat = categoryByPatient.get(r.patientId) ?? 'SELF_PAY';
      totals.set(cat, (totals.get(cat) ?? 0) + invoiceTotals(r).subtotalCents);
    }
    const grand = [...totals.values()].reduce((a, b) => a + b, 0);
    return PAYER_ORDER
      .filter(c => totals.has(c))
      .map(category => ({
        category,
        chargedCents: totals.get(category) ?? 0,
        share: grand ? (totals.get(category) ?? 0) / grand : 0,
      }));
  }
}

/** The last `count` calendar months ending with the month of `dateKey`, as YYYY-MM. */
export function lastMonths(dateKey: string, count: number): string[] {
  const [y, m] = dateKey.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}
