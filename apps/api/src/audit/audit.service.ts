import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditLogEntry, AuditLogFilters } from '@clinova/identity/domain';
import { AuditAction } from '@clinova/identity/domain';
import { PrismaService } from '../prisma/prisma.service';

/** Who did something, from where. Built from the request by @AuditCtx(). */
export interface AuditContext {
  user: { id: string; firstName: string; lastName: string; role: string } | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditRecord {
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  patientId?: string | null;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  /** Overrides the user name when there is no authenticated user (e.g. failed logins). */
  userName?: string;
}

const MAX_VALUE_LENGTH = 2000;

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Append-only audit trail of PHI access and security events (PRD §5.1). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records an entry; failures are logged and never break the audited request. */
  async log(ctx: AuditContext, record: AuditRecord): Promise<void> {
    await this.logMany(ctx, [record]);
  }

  async logMany(ctx: AuditContext, records: AuditRecord[]): Promise<void> {
    if (!records.length) return;
    try {
      await this.prisma.auditLog.createMany({
        data: records.map(r => ({
          userId: ctx.user?.id ?? null,
          userName: r.userName ?? (ctx.user ? `${ctx.user.firstName} ${ctx.user.lastName}` : null),
          userRole: ctx.user?.role ?? null,
          action: r.action,
          resourceType: r.resourceType,
          resourceId: r.resourceId ?? null,
          patientId: r.patientId ?? null,
          fieldName: r.fieldName ?? null,
          oldValue: serialize(r.oldValue),
          newValue: serialize(r.newValue),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        })),
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** One UPDATE entry per changed field (field-level audit). */
  async logFieldChanges(
    ctx: AuditContext,
    target: { resourceType: string; resourceId: string; patientId?: string | null },
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    fields: string[],
  ): Promise<void> {
    const changes = fields.filter(f => !sameValue(before[f], after[f]));
    await this.logMany(ctx, changes.map(f => ({
      action: AuditAction.Update,
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      patientId: target.patientId ?? null,
      fieldName: f,
      oldValue: before[f],
      newValue: after[f],
    })));
  }

  async findMany(filters: AuditLogFilters): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.action) where.action = { in: Array.isArray(filters.action) ? filters.action : [filters.action] };
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(filters.limit ?? 50, 500),
        skip: filters.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const patientIds = [...new Set(rows.map(r => r.patientId).filter((id): id is string => !!id))];
    const patients = patientIds.length
      ? await this.prisma.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const names = new Map(patients.map(p => [p.id, `${p.firstName} ${p.lastName}`]));

    return {
      entries: rows.map(r => ({ ...r, action: r.action as AuditAction, patientName: r.patientId ? names.get(r.patientId) : undefined })),
      total,
    };
  }
}
