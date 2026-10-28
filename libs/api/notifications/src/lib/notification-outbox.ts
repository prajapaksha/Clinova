import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@clinova/api/shared';
import type { MergeField } from '@clinova/notifications/domain';
import { NOTIFICATION_TYPES, NotificationChannel, NotificationStatus, NotificationType, renderTemplate } from '@clinova/notifications/domain';
import type { NotificationTopic } from '@clinova/portal/domain';
import { defaultNotificationPreferences, normalizePreferences } from '@clinova/portal/domain';
import { NotificationTemplates } from './notification-templates';
import { PracticeSettings } from './practice-settings';

export type MergeValues = Partial<Record<MergeField, string | null | undefined>>;

export interface PatientNotice {
  type: NotificationType;
  patientId: string;
  /** Unique per logical message; each channel gets `${dedupeKey}:${channel}`. */
  dedupeKey: string;
  values?: MergeValues;
  appointmentId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  scheduledFor?: Date;
  /** Portal route opened from the portal notification. */
  link?: string | null;
}

export interface StaffNotice {
  userIds: string[];
  kind: string;
  title: string;
  body: string;
  link?: string | null;
}

/**
 * Transactional outbox (PRD §4.6): renders each channel of a notice, applies the patient's
 * preferences and contact details, and records a row per channel — queued for the worker,
 * delivered immediately (portal), or suppressed with the reason so staff can see why.
 */
@Injectable()
export class NotificationOutbox {
  private readonly logger = new Logger(NotificationOutbox.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: NotificationTemplates,
    private readonly practice: PracticeSettings,
  ) {}

  async notifyPatient(n: PatientNotice): Promise<number> {
    const patient = await this.prisma.patient.findUnique({ where: { id: n.patientId }, include: { portalAccount: true } });
    if (!patient || patient.isArchived) return 0;
    const spec = NOTIFICATION_TYPES[n.type];
    const contact = JSON.parse(patient.contactJson) as { email?: string | null; primaryPhone?: string | null };
    const account = patient.portalAccount;
    const prefs = account ? normalizePreferences(JSON.parse(account.notificationPrefsJson)) : defaultNotificationPreferences();
    const topic = spec.topic as NotificationTopic;
    const values: MergeValues = {
      patient_first_name: patient.preferredName || patient.firstName,
      patient_last_name: patient.lastName,
      practice_name: this.practice.name,
      practice_phone: this.practice.phone,
      portal_link: this.practice.portalUrl,
      ...n.values,
    };

    let created = 0;
    for (const channel of spec.channels) {
      const template = await this.templates.effective(n.type, channel);
      if (!template) continue;
      let status: NotificationStatus = NotificationStatus.Queued;
      let reason: string | null = null;
      let recipient: string | null = null;

      if (channel === NotificationChannel.Portal) {
        // Portal notifications only exist for patients who can sign in.
        if (!account || account.status === 'DISABLED') continue;
        recipient = account.id;
        status = NotificationStatus.Sent;
      } else if (channel === NotificationChannel.Email) {
        recipient = contact.email?.trim() || null;
        if (!recipient) [status, reason] = [NotificationStatus.Suppressed, 'No email address on file'];
        else if (!prefs[topic]?.email) [status, reason] = [NotificationStatus.Suppressed, 'Patient turned off email for this topic'];
      } else {
        recipient = contact.primaryPhone?.trim() || null;
        if (!recipient) [status, reason] = [NotificationStatus.Suppressed, 'No phone number on file'];
        else if (!prefs[topic]?.sms) [status, reason] = [NotificationStatus.Suppressed, 'Patient turned off text messages for this topic'];
      }
      if (!template.isActive) [status, reason] = [NotificationStatus.Suppressed, 'Template turned off by the practice'];

      const now = new Date();
      const data: Prisma.NotificationCreateInput = {
        type: n.type,
        channel,
        patientId: patient.id,
        appointmentId: n.appointmentId ?? null,
        relatedType: n.relatedType ?? null,
        relatedId: n.relatedId ?? null,
        link: n.link ?? null,
        recipient,
        subject: template.subject ? renderTemplate(template.subject, values) : null,
        body: renderTemplate(template.body, values),
        status,
        statusReason: reason,
        scheduledFor: n.scheduledFor ?? now,
        sentAt: status === NotificationStatus.Sent ? now : null,
        provider: channel === NotificationChannel.Portal ? 'portal' : null,
        dedupeKey: `${n.dedupeKey}:${channel}`,
      };
      try {
        await this.prisma.notification.create({ data });
        created++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue; // already recorded
        throw err;
      }
    }
    return created;
  }

  /** Withdraws queued messages that no longer apply (e.g. reminders for a moved appointment). */
  async cancelQueued(where: { appointmentId: string; types: NotificationType[] }, reason: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { appointmentId: where.appointmentId, type: { in: where.types }, status: NotificationStatus.Queued },
      data: { status: NotificationStatus.Cancelled, statusReason: reason },
    });
    return result.count;
  }

  async notifyStaff(n: StaffNotice): Promise<number> {
    const ids = [...new Set(n.userIds)];
    if (!ids.length) return 0;
    const result = await this.prisma.staffNotification.createMany({
      data: ids.map(userId => ({ userId, kind: n.kind, title: n.title, body: n.body, link: n.link ?? null })),
    });
    this.logger.debug(`Staff notification "${n.title}" → ${result.count} user(s)`);
    return result.count;
  }
}
