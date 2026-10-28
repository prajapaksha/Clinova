import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { SavedPaymentMethod } from '@prisma/client';
import type { Invoice, Payment } from '@clinova/billing/domain';
import { InvoiceStatus, PaymentMethod } from '@clinova/billing/domain';
import type { CardBrand, SavedCard } from '@clinova/portal/domain';
import { cardBrand, cardDigits, isCardExpired, isValidCardNumber } from '@clinova/portal/domain';
import { UserRole } from '@clinova/identity/domain';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../billing/invoices.service';
import type { AuthUser } from '../auth/auth.service';
import type { CardDto, PortalPayDto } from './dto/portal.dto';

/** Test card that is always declined (as with real processors' test modes). */
export const DECLINE_TEST_CARD = '4000000000000002';
const OPEN = [InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Overdue];

export interface TokenizedCard {
  token: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
}

/**
 * Stand-in for a hosted payment processor (Stripe/Square): validates and tokenizes cards and
 * "charges" tokens. Card numbers are never persisted. Replace with a real gateway in production.
 */
@Injectable()
export class SimulatedPaymentGateway {
  tokenize(card: CardDto, now = new Date()): TokenizedCard {
    const digits = cardDigits(card.number);
    if (!isValidCardNumber(digits)) throw new BadRequestException('Check your card number.');
    if (isCardExpired(card.expMonth, card.expYear, now)) throw new BadRequestException('This card has expired.');
    const decline = digits === DECLINE_TEST_CARD ? 'decline_' : '';
    return {
      token: `tok_sim_${decline}${randomBytes(12).toString('hex')}`,
      brand: cardBrand(digits),
      last4: digits.slice(-4),
      expMonth: card.expMonth,
      expYear: card.expYear,
    };
  }

  /** Returns the processor's charge reference. */
  charge(token: string, amountCents: number): string {
    if (amountCents <= 0) throw new BadRequestException('Enter an amount to pay.');
    if (token.includes('_decline_')) throw new BadRequestException('Your card was declined. Please use a different card.');
    return `ch_sim_${randomBytes(10).toString('hex')}`;
  }
}

/** Patient self-pay (PRD §4.5, §4.8): invoices, saved cards, payments. */
@Injectable()
export class PortalBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly gateway: SimulatedPaymentGateway,
  ) {}

  async invoiceList(patientId: string, now = new Date()): Promise<Invoice[]> {
    const { invoices } = await this.invoices.findMany({ patientId, limit: 200 }, now);
    return invoices.filter(i => i.status !== InvoiceStatus.Draft);
  }

  async invoice(patientId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoices.findById(invoiceId).catch(() => null);
    if (!invoice || invoice.patientId !== patientId || invoice.status === InvoiceStatus.Draft) throw new NotFoundException('Bill not found.');
    return invoice;
  }

  async summary(patientId: string, now = new Date()) {
    const invoices = await this.invoiceList(patientId, now);
    const open = invoices.filter(i => OPEN.includes(i.status));
    const statement = await this.invoices.statement(patientId, now);
    const due = open.map(i => i.dueDate).filter((d): d is Date => !!d).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return {
      balanceCents: open.reduce((s, i) => s + i.balanceCents, 0),
      creditCents: statement.creditCents,
      openInvoiceCount: open.length,
      oldestDueDate: due[0] ?? null,
      overdue: open.some(i => i.status === InvoiceStatus.Overdue),
    };
  }

  async payments(patientId: string): Promise<Payment[]> {
    return (await this.invoices.listPayments({ patientId, limit: 200 })).filter(p => !p.voidedAt);
  }

  // ── Cards ──────────────────────────────────────────────────────────────────

  async cards(patientId: string, now = new Date()): Promise<SavedCard[]> {
    const rows = await this.prisma.savedPaymentMethod.findMany({ where: { patientId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
    return rows.map(r => this.toCard(r, now));
  }

  async addCard(patientId: string, card: CardDto, makeDefault = false): Promise<SavedCard> {
    const t = this.gateway.tokenize(card);
    const count = await this.prisma.savedPaymentMethod.count({ where: { patientId } });
    if (count >= 5) throw new BadRequestException('You can save up to 5 cards. Remove one first.');
    const isDefault = makeDefault || count === 0;
    if (isDefault) await this.prisma.savedPaymentMethod.updateMany({ where: { patientId }, data: { isDefault: false } });
    const row = await this.prisma.savedPaymentMethod.create({
      data: { patientId, brand: t.brand, last4: t.last4, expMonth: t.expMonth, expYear: t.expYear, cardholderName: card.cardholderName.trim(), gatewayToken: t.token, isDefault },
    });
    return this.toCard(row);
  }

  async removeCard(patientId: string, id: string): Promise<void> {
    const row = await this.ownCard(patientId, id);
    await this.prisma.savedPaymentMethod.delete({ where: { id } });
    if (row.isDefault) {
      const next = await this.prisma.savedPaymentMethod.findFirst({ where: { patientId }, orderBy: { createdAt: 'desc' } });
      if (next) await this.prisma.savedPaymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  async setDefaultCard(patientId: string, id: string): Promise<SavedCard[]> {
    await this.ownCard(patientId, id);
    await this.prisma.savedPaymentMethod.updateMany({ where: { patientId }, data: { isDefault: false } });
    await this.prisma.savedPaymentMethod.update({ where: { id }, data: { isDefault: true } });
    return this.cards(patientId);
  }

  // ── Pay ────────────────────────────────────────────────────────────────────

  async pay(user: AuthUser & { patientId: string }, dto: PortalPayDto, now = new Date()): Promise<Payment> {
    const { balanceCents } = await this.summary(user.patientId, now);
    if (balanceCents <= 0) throw new BadRequestException('You have no balance due.');
    if (dto.amountCents > balanceCents) throw new BadRequestException('The amount is more than your balance due.');

    let token: string;
    let label: string;
    if (dto.savedCardId) {
      const card = await this.ownCard(user.patientId, dto.savedCardId);
      if (isCardExpired(card.expMonth, card.expYear, now)) throw new BadRequestException('This card has expired. Update your payment method.');
      token = card.gatewayToken;
      label = `${card.brand} •••• ${card.last4}`;
    } else if (dto.card) {
      const t = this.gateway.tokenize(dto.card, now);
      token = t.token;
      label = `${t.brand} •••• ${t.last4}`;
    } else {
      throw new BadRequestException('Choose a payment method.');
    }

    const chargeId = this.gateway.charge(token, dto.amountCents);
    const payment = await this.invoices.takePayment(
      {
        patientId: user.patientId,
        amountCents: dto.amountCents,
        method: PaymentMethod.PatientPortal,
        invoiceIds: dto.invoiceIds?.length ? dto.invoiceIds : undefined,
        referenceNumber: `${label} · ${chargeId}`,
        receiptEmail: user.email,
      },
      { ...user, role: UserRole.Patient },
    );
    if (dto.card && dto.saveCard) await this.addCard(user.patientId, dto.card).catch(() => undefined);
    return payment;
  }

  private async ownCard(patientId: string, id: string): Promise<SavedPaymentMethod> {
    const row = await this.prisma.savedPaymentMethod.findUnique({ where: { id } });
    if (!row || row.patientId !== patientId) throw new NotFoundException('Card not found.');
    return row;
  }

  private toCard(r: SavedPaymentMethod, now = new Date()): SavedCard {
    return {
      id: r.id,
      brand: r.brand as CardBrand,
      last4: r.last4,
      expMonth: r.expMonth,
      expYear: r.expYear,
      cardholderName: r.cardholderName,
      isDefault: r.isDefault,
      isExpired: isCardExpired(r.expMonth, r.expYear, now),
    };
  }
}
