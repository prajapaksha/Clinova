import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '@clinova/api/shared';
import type { NotificationLogEntry, PortalNotification, StaffNotificationItem } from '@clinova/notifications/domain';
import { NOTIFICATION_TYPES, NotificationChannel, NotificationStatus, NotificationType } from '@clinova/notifications/domain';

export interface LogFilters {
  patientId?: string;
  appointmentId?: string;
  status?: string;
  channel?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

/** Notification log (staff), portal and staff notification centers. */
@Injectable()
export class NotificationQueries {
  constructor(private readonly prisma: PrismaService) {}

  async log(f: LogFilters): Promise<{ entries: NotificationLogEntry[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      ...(f.patientId ? { patientId: f.patientId } : {}),
      ...(f.appointmentId ? { appointmentId: f.appointmentId } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.channel ? { channel: f.channel } : {}),
      ...(f.type ? { type: f.type } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: [{ scheduledFor: 'desc' }, { createdAt: 'desc' }], take: Math.min(f.limit ?? 50, 200), skip: f.offset ?? 0 }),
      this.prisma.notification.count({ where }),
    ]);
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: [...new Set(rows.map(r => r.patientId).filter((id): id is string => !!id))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const names = new Map(patients.map(p => [p.id, `${p.firstName} ${p.lastName}`]));
    return { entries: rows.map(r => this.toEntry(r, names)), total };
  }

  async summary(): Promise<Record<string, number>> {
    const groups = await this.prisma.notification.groupBy({ by: ['status'], _count: { _all: true } });
    return Object.fromEntries(groups.map(g => [g.status, g._count._all]));
  }

  /** Puts a failed or cancelled message back in the queue. */
  async retry(id: string): Promise<NotificationLogEntry> {
    const row = await this.get(id);
    if (row.channel === NotificationChannel.Portal) throw new BadRequestException('Portal notifications are delivered instantly.');
    if (![NotificationStatus.Failed, NotificationStatus.Cancelled].includes(row.status as NotificationStatus)) {
      throw new BadRequestException('Only failed or cancelled messages can be retried.');
    }
    const updated = await this.prisma.notification.update({
      where: { id }, data: { status: NotificationStatus.Queued, scheduledFor: new Date(), attempts: 0, lastError: null, statusReason: 'Retried by staff' },
    });
    return this.toEntry(updated, new Map());
  }

  async cancel(id: string, byName: string): Promise<NotificationLogEntry> {
    const row = await this.get(id);
    if (row.status !== NotificationStatus.Queued) throw new BadRequestException('Only queued messages can be cancelled.');
    const updated = await this.prisma.notification.update({ where: { id }, data: { status: NotificationStatus.Cancelled, statusReason: `Cancelled by ${byName}` } });
    return this.toEntry(updated, new Map());
  }

  // ── Patient portal notification center ─────────────────────────────────────

  async portal(accountId: string, limit = 30): Promise<{ items: PortalNotification[]; unread: number }> {
    const where = { channel: NotificationChannel.Portal, recipient: accountId, status: NotificationStatus.Sent };
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 100) }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return {
      items: rows.map(r => ({ id: r.id, type: r.type as NotificationType, title: r.subject ?? '', body: r.body, link: r.link, createdAt: r.createdAt, read: !!r.readAt })),
      unread,
    };
  }

  async markPortalRead(accountId: string, id?: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { channel: NotificationChannel.Portal, recipient: accountId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
  }

  // ── Staff notification center ──────────────────────────────────────────────

  async staff(userId: string, limit = 30): Promise<{ items: StaffNotificationItem[]; unread: number }> {
    const [rows, unread] = await Promise.all([
      this.prisma.staffNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 100) }),
      this.prisma.staffNotification.count({ where: { userId, readAt: null } }),
    ]);
    return { items: rows.map(r => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, createdAt: r.createdAt, read: !!r.readAt })), unread };
  }

  async markStaffRead(userId: string, id?: string): Promise<void> {
    await this.prisma.staffNotification.updateMany({ where: { userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  }

  private async get(id: string): Promise<Notification> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notification not found.');
    return row;
  }

  private toEntry(r: Notification, names: Map<string, string>): NotificationLogEntry {
    return {
      id: r.id,
      type: r.type as NotificationType,
      typeLabel: NOTIFICATION_TYPES[r.type as NotificationType]?.label ?? r.type,
      channel: r.channel as NotificationChannel,
      patientId: r.patientId,
      patientName: r.patientId ? names.get(r.patientId) : undefined,
      appointmentId: r.appointmentId,
      relatedType: r.relatedType,
      relatedId: r.relatedId,
      recipient: r.recipient,
      subject: r.subject,
      body: r.body,
      status: r.status as NotificationStatus,
      statusReason: r.statusReason,
      scheduledFor: r.scheduledFor,
      sentAt: r.sentAt,
      attempts: r.attempts,
      lastError: r.lastError,
      provider: r.provider,
      createdAt: r.createdAt,
    };
  }
}