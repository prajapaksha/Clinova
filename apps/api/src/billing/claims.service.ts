import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Adjustment, InsuranceClaim } from '@clinova/billing/domain';
import { AdjustmentType, CLAIM_TRANSITIONS, ClaimStatus, InvoiceStatus } from '@clinova/billing/domain';
import type { InsurancePolicy } from '@clinova/patient/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.service';
import { invoiceStatus, invoiceTotals, parseAdjustments, toClaim } from './billing.mapper';
import { InvoicesService } from './invoices.service';
import { CreateClaimDto, UpdateClaimDto } from './dto/billing.dto';

const ACTIVE_CLAIM_STATUSES = [ClaimStatus.Draft, ClaimStatus.Submitted, ClaimStatus.Pending, ClaimStatus.Appealed, ClaimStatus.Paid];

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  async findMany(filters: { status?: string | string[]; patientId?: string }): Promise<InsuranceClaim[]> {
    const statuses = filters.status ? (Array.isArray(filters.status) ? filters.status : [filters.status]) : null;
    const rows = await this.prisma.insuranceClaim.findMany({
      where: {
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(statuses ? { status: { in: statuses } } : {}),
      },
      include: { invoice: { select: { number: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    const names = await this.invoices.namesFor(rows.map(r => r.patientId), []);
    return rows.map(r => toClaim(r, names, r.invoice.number));
  }

  async create(dto: CreateClaimDto): Promise<InsuranceClaim> {
    const invoice = await this.invoices.getRow(dto.invoiceId);
    const status = invoiceStatus(invoice);
    if (status === InvoiceStatus.Draft || status === InvoiceStatus.Voided) {
      throw new BadRequestException('Claims can only be filed for issued invoices.');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: invoice.patientId },
      select: { insurancePoliciesJson: true },
    });
    const policies: InsurancePolicy[] = JSON.parse(patient?.insurancePoliciesJson ?? '[]');
    const policy = dto.insurancePolicyId
      ? policies.find(p => p.id === dto.insurancePolicyId)
      : policies.find(p => p.isPrimary) ?? policies[0];
    if (!policy) throw new BadRequestException('The patient has no insurance policy on file.');

    const duplicate = invoice.claims.find(c =>
      c.insurancePolicyId === policy.id && ACTIVE_CLAIM_STATUSES.includes(c.status as ClaimStatus));
    if (duplicate) throw new ConflictException(`A ${duplicate.status.toLowerCase()} claim already exists for this invoice and policy.`);

    const row = await this.prisma.insuranceClaim.create({
      data: {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        insurancePolicyId: policy.id,
        payerName: policy.provider,
        policyNumber: policy.policyNumber,
        billedCents: invoiceTotals(invoice).subtotalCents,
      },
    });
    return this.findOne(row.id);
  }

  async update(id: string, dto: UpdateClaimDto, user: AuthUser, now = new Date()): Promise<InsuranceClaim> {
    const claim = await this.prisma.insuranceClaim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException(`Claim ${id} not found`);

    const from = claim.status as ClaimStatus;
    if (!CLAIM_TRANSITIONS[from].includes(dto.status)) {
      throw new ConflictException(`A ${from.toLowerCase()} claim cannot be moved to ${dto.status.toLowerCase()}.`);
    }
    if (dto.status === ClaimStatus.Denied && !dto.denialReason?.trim()) {
      throw new BadRequestException('A denial reason is required.');
    }
    if (dto.status === ClaimStatus.Appealed && !dto.appealNote?.trim()) {
      throw new BadRequestException('An appeal note is required.');
    }
    if (dto.status === ClaimStatus.Paid && !dto.paidAmountCents) {
      throw new BadRequestException('Enter the amount the payer paid.');
    }

    await this.prisma.$transaction(async tx => {
      let paymentId: string | null = claim.paymentId;

      if (dto.status === ClaimStatus.Paid) {
        const invoice = await this.invoices.getRow(claim.invoiceId);
        const balance = invoiceTotals(invoice).balanceCents;
        const paid = dto.paidAmountCents ?? 0;
        const payment = await this.invoices.recordInsurancePayment(tx, {
          invoiceId: claim.invoiceId,
          patientId: claim.patientId,
          amountCents: paid,
          allocateCents: Math.min(paid, Math.max(balance, 0)),
          payer: claim.payerName,
        }, user);
        paymentId = payment.id;

        const writeDown = Math.min(dto.contractualAdjustmentCents ?? 0, Math.max(balance - paid, 0));
        if (writeDown > 0) {
          const adjustment: Adjustment = {
            id: randomUUID(),
            type: AdjustmentType.InsuranceContractual,
            amountCents: writeDown,
            reason: `${claim.payerName} contractual adjustment`,
            appliedBy: user.id,
            appliedAt: now,
          };
          await tx.invoice.update({
            where: { id: claim.invoiceId },
            data: { adjustmentsJson: JSON.stringify([...parseAdjustments(invoice), adjustment]) },
          });
        }
      }

      await tx.insuranceClaim.update({
        where: { id },
        data: {
          status: dto.status,
          paymentId,
          ...(dto.status === ClaimStatus.Submitted ? { submittedAt: now } : {}),
          ...(dto.status === ClaimStatus.Paid ? { paidAt: now, paidAmountCents: dto.paidAmountCents } : {}),
          ...(dto.denialReason !== undefined ? { denialReason: dto.denialReason.trim() } : {}),
          ...(dto.appealNote !== undefined ? { appealNote: dto.appealNote.trim() } : {}),
        },
      });
    });

    return this.findOne(id);
  }

  private async findOne(id: string): Promise<InsuranceClaim> {
    const row = await this.prisma.insuranceClaim.findUniqueOrThrow({
      where: { id },
      include: { invoice: { select: { number: true } } },
    });
    const names = await this.invoices.namesFor([row.patientId], []);
    return toClaim(row, names, row.invoice.number);
  }
}
