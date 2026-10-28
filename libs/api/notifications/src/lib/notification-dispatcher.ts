import { Injectable, Logger } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { PrismaService } from '@clinova/api/shared';
import { MAX_DELIVERY_ATTEMPTS, NotificationChannel, NotificationStatus, NotificationType, retryDelayMs } from '@clinova/notifications/domain';
import { DeliveryProviders } from './delivery-providers';
import { AppointmentNotices } from './appointment-notices';
import { PracticeSettings } from './practice-settings';

const APPOINTMENT_TYPES: string[] = [
  NotificationType.AppointmentConfirmation, NotificationType.AppointmentReminder48h,
  NotificationType.AppointmentReminder2h, NotificationType.AppointmentRescheduled,
];
/** TCPA-friendly window for texts, in the practice time zone. */
export const SMS_WINDOW = { startHour: 8, endHour: 21 };
const STALE_SENDING_MS = 10 * 60_000;

export interface DispatchSummary {
  sent: number;
  retried: number;
  failed: number;
  deferred: number;
  cancelled: number;
}

/** Delivers due outbox rows (run by apps/worker). Safe with several workers: rows are claimed first. */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: DeliveryProviders,
    private readonly appointments: AppointmentNotices,
    private readonly practice: PracticeSettings,
  ) {}

  async dispatchDue(now = new Date(), limit = 25): Promise<DispatchSummary> {
    const summary: DispatchSummary = { sent: 0, retried: 0, failed: 0, deferred: 0, cancelled: 0 };
    await this.recoverStale(now);
    const due = await this.prisma.notification.findMany({
      where: { status: NotificationStatus.Queued, scheduledFor: { lte: now } },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
    });
    for (const row of due) {
      const claimed = await this.prisma.notification.updateMany({ where: { id: row.id, status: NotificationStatus.Queued }, data: { status: NotificationStatus.Sending } });
      if (!claimed.count) continue;
      summary[await this.deliver(row, now)]++;
    }
    return summary;
  }

  private async deliver(row: Notification, now: Date): Promise<keyof DispatchSummary> {
    if (row.appointmentId && APPOINTMENT_TYPES.includes(row.type) && !(await this.appointments.isStillValid(row.appointmentId, row.dedupeKey))) {
      await this.finish(row.id, { status: NotificationStatus.Cancelled, statusReason: 'Appointment was changed or cancelled' });
      return 'cancelled';
    }
    if (row.channel === NotificationChannel.SMS && !this.inSmsWindow(now)) {
      const next = this.nextSmsWindow(now);
      const appt = row.appointmentId ? await this.prisma.appointment.findUnique({ where: { id: row.appointmentId } }) : null;
      if (appt && next >= appt.slotStart) {
        await this.finish(row.id, { status: NotificationStatus.Cancelled, statusReason: 'Quiet hours: would arrive after the appointment' });
        return 'cancelled';
      }
      await this.finish(row.id, { status: NotificationStatus.Queued, scheduledFor: next, statusReason: 'Deferred for quiet hours' });
      return 'deferred';
    }

    const provider = row.channel === NotificationChannel.SMS ? this.providers.sms : this.providers.email;
    try {
      if (!row.recipient) throw new Error('No recipient');
      const result = await provider.send({ id: row.id, to: row.recipient, subject: row.subject, body: row.body });
      await this.finish(row.id, {
        status: NotificationStatus.Sent, sentAt: new Date(), attempts: row.attempts + 1,
        provider: result.provider, providerMessageId: result.providerMessageId, lastError: null, statusReason: null,
      });
      return 'sent';
    } catch (err) {
      const attempts = row.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      const giveUp = attempts >= MAX_DELIVERY_ATTEMPTS;
      await this.finish(row.id, {
        status: giveUp ? NotificationStatus.Failed : NotificationStatus.Queued,
        attempts, lastError: message.slice(0, 500), provider: provider.name,
        scheduledFor: giveUp ? row.scheduledFor : new Date(now.getTime() + retryDelayMs(attempts)),
      });
      this.logger.warn(`${row.channel} ${row.id} attempt ${attempts} failed: ${message}`);
      return giveUp ? 'failed' : 'retried';
    }
  }

  /** Rows left in SENDING by a crashed worker go back to the queue. */
  private async recoverStale(now: Date): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { status: NotificationStatus.Sending, updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) } },
      data: { status: NotificationStatus.Queued },
    });
  }

  private finish(id: string, data: Parameters<PrismaService['notification']['update']>[0]['data']) {
    return this.prisma.notification.update({ where: { id }, data });
  }

  private inSmsWindow(d: Date): boolean {
    const h = this.practice.hour(d);
    return h >= SMS_WINDOW.startHour && h < SMS_WINDOW.endHour;
  }

  private nextSmsWindow(from: Date): Date {
    const t = new Date(from);
    t.setUTCMinutes(Math.ceil(t.getUTCMinutes() / 15) * 15, 0, 0);
    for (let i = 0; i < 4 * 24 && !this.inSmsWindow(t); i++) t.setTime(t.getTime() + 15 * 60_000);
    return t;
  }
}