import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ProfileChangeRequest as ChangeRow, RefillRequest as RefillRow } from '@prisma/client';
import type { DrugDose } from '@clinova/clinical/domain';
import { PrescriptionStatus } from '@clinova/clinical/domain';
import { AuditAction, isProviderRole } from '@clinova/identity/domain';
import type { ProfileChangeField, ProfileChangeRequest, RefillRequest } from '@clinova/portal/domain';
import { ChangeRequestStatus, PROFILE_CHANGE_FIELDS, RefillStatus, diffProfile } from '@clinova/portal/domain';
import { ContactMethod, InsuranceRelationship } from '@clinova/patient/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';
import { PortalRecordsService, medicationName } from './portal-records.service';

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const isoDate = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function address(v: unknown, required: boolean) {
  const a = (v ?? {}) as Record<string, unknown>;
  const out = {
    street1: str(a['street1'], 120), street2: str(a['street2'], 120), city: str(a['city'], 80),
    state: str(a['state'], 40), postalCode: str(a['postalCode'], 20), country: str(a['country'], 40) ?? 'US',
  };
  if (!out.street1 || !out.city || !out.state || !out.postalCode) {
    if (required) throw new BadRequestException('Enter a complete mailing address.');
    return null;
  }
  return out;
}

/** Whitelists and normalizes portal-submitted profile values (never trust client shapes). */
export function sanitizeProfile(input: Record<string, unknown>): Partial<Record<ProfileChangeField, unknown>> {
  const out: Partial<Record<ProfileChangeField, unknown>> = {};
  if ('preferredName' in input) out.preferredName = str(input['preferredName'], 80);
  if ('pronouns' in input) out.pronouns = str(input['pronouns'], 40);
  if ('preferredLanguage' in input) out.preferredLanguage = str(input['preferredLanguage'], 40) ?? 'English';
  if (input['contact']) {
    const c = input['contact'] as Record<string, unknown>;
    const primaryPhone = str(c['primaryPhone'], 40);
    if (!primaryPhone) throw new BadRequestException('A primary phone number is required.');
    const method = Object.values(ContactMethod).includes(c['preferredMethod'] as ContactMethod) ? c['preferredMethod'] : ContactMethod.Phone;
    out.contact = {
      primaryPhone,
      secondaryPhone: str(c['secondaryPhone'], 40),
      email: str(c['email'], 200)?.toLowerCase() ?? null,
      preferredMethod: method,
      mailingAddress: address(c['mailingAddress'], true),
      billingAddress: address(c['billingAddress'], false),
    };
  }
  if (Array.isArray(input['emergencyContacts'])) {
    out.emergencyContacts = (input['emergencyContacts'] as Array<Record<string, unknown>>)
      .map(e => ({ name: str(e['name'], 100), relationship: str(e['relationship'], 60), phone: str(e['phone'], 40) }))
      .filter(e => e.name && e.phone);
  }
  if (Array.isArray(input['insurancePolicies'])) {
    out.insurancePolicies = (input['insurancePolicies'] as Array<Record<string, unknown>>).map((p, i) => {
      const provider = str(p['provider'], 120);
      const policyNumber = str(p['policyNumber'], 60);
      if (!provider || !policyNumber) throw new BadRequestException('Insurance needs a company name and member ID.');
      const relationship = Object.values(InsuranceRelationship).includes(p['relationship'] as InsuranceRelationship) ? p['relationship'] : InsuranceRelationship.Self;
      return {
        id: str(p['id'], 60),
        isPrimary: i === 0 ? true : !!p['isPrimary'],
        provider,
        policyNumber,
        groupNumber: str(p['groupNumber'], 60),
        subscriberName: str(p['subscriberName'], 120) ?? '',
        subscriberDob: isoDate(p['subscriberDob']),
        relationship,
        effectiveDate: isoDate(p['effectiveDate']) ?? new Date().toISOString(),
        expirationDate: isoDate(p['expirationDate']),
        copayAmountCents: typeof p['copayAmountCents'] === 'number' ? p['copayAmountCents'] : null,
        deductibleAmountCents: typeof p['deductibleAmountCents'] === 'number' ? p['deductibleAmountCents'] : null,
      };
    });
  }
  return out;
}

/** JSON round-trip so Dates compare equal to ISO strings. */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));

/** Refill requests and profile change requests submitted from the portal, reviewed by staff. */
@Injectable()
export class PortalRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly patients: PatientsService,
    private readonly records: PortalRecordsService,
  ) {}

  // ── Refills ────────────────────────────────────────────────────────────────

  async requestRefill(patientId: string, dto: { prescriptionId: string; pharmacy?: string; note?: string }): Promise<RefillRequest> {
    const rx = await this.prisma.prescription.findUnique({ where: { id: dto.prescriptionId } });
    if (!rx || rx.patientId !== patientId) throw new NotFoundException('Prescription not found.');
    if (rx.status !== PrescriptionStatus.Active) throw new BadRequestException('Refills can only be requested for active prescriptions.');
    const pending = await this.prisma.refillRequest.count({ where: { prescriptionId: rx.id, status: RefillStatus.Pending } });
    if (pending) throw new ConflictException('A refill request for this medication is already waiting for review.');
    const row = await this.prisma.refillRequest.create({
      data: { patientId, prescriptionId: rx.id, pharmacy: dto.pharmacy?.trim() || null, note: dto.note?.trim() || null },
    });
    return (await this.refills({ ids: [row.id] }))[0];
  }

  async refills(filters: { patientId?: string; status?: string; ids?: string[] }): Promise<RefillRequest[]> {
    const rows = await this.prisma.refillRequest.findMany({
      where: {
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
        ...(filters.ids ? { id: { in: filters.ids } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.toRefills(rows);
  }

  /** Physicians approve or deny; approval uses one of the prescription's remaining refills. */
  async respondRefill(id: string, decision: 'APPROVED' | 'DENIED', note: string | undefined, ctx: AuditContext): Promise<RefillRequest> {
    if (!isProviderRole(ctx.user?.role)) throw new ForbiddenException('Only a physician can respond to refill requests.');
    const row = await this.prisma.refillRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Refill request not found.');
    if (row.status !== RefillStatus.Pending) throw new ConflictException('This request has already been answered.');
    if (decision === RefillStatus.Denied && !note?.trim()) throw new BadRequestException('Tell the patient why the refill was denied.');
    await this.prisma.$transaction(async tx => {
      await tx.refillRequest.update({
        where: { id },
        data: { status: decision, responseNote: note?.trim() || null, respondedBy: ctx.user?.id ?? null, respondedAt: new Date() },
      });
      if (decision === RefillStatus.Approved) {
        await tx.prescription.updateMany({ where: { id: row.prescriptionId, refillsRemaining: { gt: 0 } }, data: { refillsRemaining: { decrement: 1 } } });
      }
    });
    await this.audit.log(ctx, { action: AuditAction.Update, resourceType: 'RefillRequest', resourceId: id, patientId: row.patientId, newValue: decision });
    return (await this.refills({ ids: [id] }))[0];
  }

  // ── Profile changes ────────────────────────────────────────────────────────

  async editableProfile(patientId: string) {
    const p = await this.patients.findById(patientId);
    const pending = await this.prisma.profileChangeRequest.findFirst({ where: { patientId, status: ChangeRequestStatus.Pending } });
    return {
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      sex: p.sex,
      mrn: p.mrn,
      preferredName: p.preferredName,
      pronouns: p.pronouns,
      preferredLanguage: p.preferredLanguage,
      contact: p.contact,
      emergencyContacts: p.emergencyContacts,
      insurancePolicies: p.insurancePolicies,
      pendingRequest: pending ? (await this.toChanges([pending]))[0] : null,
    };
  }

  /** One pending request per patient; a new submission replaces it. */
  async submitChange(patientId: string, input: Record<string, unknown>, ctx: AuditContext): Promise<ProfileChangeRequest> {
    const p = await this.patients.findById(patientId);
    const current = plain(Object.fromEntries(PROFILE_CHANGE_FIELDS.map(f => [f, (p as unknown as Record<string, unknown>)[f] ?? null])));
    const proposed = plain(sanitizeProfile(input)) as Record<string, unknown>;
    if (Array.isArray(proposed['insurancePolicies']) && Array.isArray(current['insurancePolicies'])) {
      // Patients don't see internal ids: carry over ids for unchanged policy numbers.
      for (const pol of proposed['insurancePolicies'] as Array<Record<string, unknown>>) {
        pol['id'] ??= (current['insurancePolicies'] as Array<Record<string, unknown>>).find(c => c['policyNumber'] === pol['policyNumber'])?.['id'] ?? null;
      }
    }
    const changes = diffProfile(current, proposed);
    if (!Object.keys(changes).length) throw new BadRequestException("You haven't changed anything.");
    const existing = await this.prisma.profileChangeRequest.findFirst({ where: { patientId, status: ChangeRequestStatus.Pending } });
    const row = existing
      ? await this.prisma.profileChangeRequest.update({ where: { id: existing.id }, data: { changesJson: JSON.stringify(changes), createdAt: new Date() } })
      : await this.prisma.profileChangeRequest.create({ data: { patientId, changesJson: JSON.stringify(changes) } });
    await this.audit.log(ctx, { action: AuditAction.Create, resourceType: 'ProfileChangeRequest', resourceId: row.id, patientId, newValue: Object.keys(changes) });
    return (await this.toChanges([row]))[0];
  }

  async changeRequests(filters: { patientId?: string; status?: string }): Promise<ProfileChangeRequest[]> {
    const rows = await this.prisma.profileChangeRequest.findMany({
      where: {
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.toChanges(rows);
  }

  /** Approval applies the new values through the patient service (field-level audit). */
  async reviewChange(id: string, decision: 'APPROVED' | 'REJECTED', reason: string | undefined, ctx: AuditContext): Promise<ProfileChangeRequest> {
    const row = await this.prisma.profileChangeRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Change request not found.');
    if (row.status !== ChangeRequestStatus.Pending) throw new ConflictException('This request has already been reviewed.');
    if (decision === ChangeRequestStatus.Rejected && !reason?.trim()) throw new BadRequestException('Give the patient a reason.');
    if (decision === ChangeRequestStatus.Approved) {
      const changes = JSON.parse(row.changesJson) as Record<string, { new: unknown }>;
      const updates: Record<string, unknown> = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new]));
      if (Array.isArray(updates['insurancePolicies'])) {
        updates['insurancePolicies'] = (updates['insurancePolicies'] as Array<Record<string, unknown>>).map(p => ({ ...p, id: p['id'] ?? randomUUID() }));
      }
      await this.patients.update(row.patientId, updates, ctx);
    }
    const updated = await this.prisma.profileChangeRequest.update({
      where: { id },
      data: { status: decision, reviewedBy: ctx.user?.id ?? null, reviewedAt: new Date(), rejectionReason: reason?.trim() || null },
    });
    return (await this.toChanges([updated]))[0];
  }

  // ── Mapping ────────────────────────────────────────────────────────────────

  private async toRefills(rows: RefillRow[]): Promise<RefillRequest[]> {
    if (!rows.length) return [];
    const [rxs, patients] = await Promise.all([
      this.prisma.prescription.findMany({ where: { id: { in: rows.map(r => r.prescriptionId) } } }),
      this.prisma.patient.findMany({ where: { id: { in: rows.map(r => r.patientId) } }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const rxById = new Map(rxs.map(r => [r.id, r]));
    const names = await this.records.staffNames([...rxs.map(r => r.prescriberId), ...rows.map(r => r.respondedBy ?? '')]);
    const patientNames = new Map(patients.map(p => [p.id, `${p.firstName} ${p.lastName}`]));
    return rows.map(r => {
      const rx = rxById.get(r.prescriptionId);
      return {
        id: r.id,
        patientId: r.patientId,
        patientName: patientNames.get(r.patientId),
        prescriptionId: r.prescriptionId,
        medicationName: rx ? medicationName(JSON.parse(rx.drugJson) as DrugDose) : 'Medication',
        prescriberName: rx ? names.get(rx.prescriberId) ?? null : null,
        refillsRemaining: rx?.refillsRemaining ?? 0,
        pharmacy: r.pharmacy,
        note: r.note,
        status: r.status as RefillStatus,
        responseNote: r.responseNote,
        respondedByName: r.respondedBy ? names.get(r.respondedBy) ?? null : null,
        respondedAt: r.respondedAt,
        createdAt: r.createdAt,
      };
    });
  }

  private async toChanges(rows: ChangeRow[]): Promise<ProfileChangeRequest[]> {
    if (!rows.length) return [];
    const [patients, names] = await Promise.all([
      this.prisma.patient.findMany({ where: { id: { in: rows.map(r => r.patientId) } }, select: { id: true, firstName: true, lastName: true, mrn: true } }),
      this.records.staffNames(rows.map(r => r.reviewedBy ?? '')),
    ]);
    const byId = new Map(patients.map(p => [p.id, p]));
    return rows.map(r => ({
      id: r.id,
      patientId: r.patientId,
      patientName: byId.get(r.patientId) ? `${byId.get(r.patientId)?.firstName} ${byId.get(r.patientId)?.lastName}` : undefined,
      patientMrn: byId.get(r.patientId)?.mrn,
      changes: JSON.parse(r.changesJson),
      status: r.status as ChangeRequestStatus,
      reviewedByName: r.reviewedBy ? names.get(r.reviewedBy) ?? null : null,
      reviewedAt: r.reviewedAt,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt,
    }));
  }
}
