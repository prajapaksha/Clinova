import { Injectable } from '@nestjs/common';
import type { Appointment } from '@prisma/client';
import { PrismaService } from '@clinova/api/shared';
import { NotificationType, reminderSchedule } from '@clinova/notifications/domain';
import { displayName } from '@clinova/staff/domain';
import { MergeValues, NotificationOutbox } from './notification-outbox';
import { PracticeSettings } from './practice-settings';

const REMINDER_TYPES = [NotificationType.AppointmentReminder48h, NotificationType.AppointmentReminder2h];
const ACTIVE = ['SCHEDULED', 'CONFIRMED'];

/** Appointment confirmations, change notices and 48h/2h reminders (PRD §4.6). */
@Injectable()
export class AppointmentNotices {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: NotificationOutbox,
    private readonly practice: PracticeSettings,
  ) {}

  async booked(appointmentId: string, now = new Date()): Promise<void> {
    const appt = await this.load(appointmentId);
    if (!appt || !ACTIVE.includes(appt.status)) return;
    await this.send(appt, NotificationType.AppointmentConfirmation, `confirm:${appt.id}:${appt.slotStart.toISOString()}`);
    await this.scheduleReminders(appt, now);
  }

  async rescheduled(appointmentId: string, now = new Date()): Promise<void> {
    const appt = await this.load(appointmentId);
    if (!appt) return;
    await this.outbox.cancelQueued({ appointmentId: appt.id, types: REMINDER_TYPES }, 'Appointment was rescheduled');
    if (!ACTIVE.includes(appt.status)) return;
    await this.send(appt, NotificationType.AppointmentRescheduled, `reschedule:${appt.id}:${appt.slotStart.toISOString()}`);
    await this.scheduleReminders(appt, now);
  }

  async cancelled(appointmentId: string): Promise<void> {
    const appt = await this.load(appointmentId);
    if (!appt) return;
    await this.outbox.cancelQueued({ appointmentId: appt.id, types: [...REMINDER_TYPES, NotificationType.AppointmentConfirmation] }, 'Appointment was cancelled');
    await this.send(appt, NotificationType.AppointmentCancelled, `cancel:${appt.id}`);
  }

  async noShow(appointmentId: string): Promise<void> {
    const appt = await this.load(appointmentId);
    if (!appt) return;
    await this.outbox.cancelQueued({ appointmentId: appt.id, types: REMINDER_TYPES }, 'Patient did not attend');
    await this.send(appt, NotificationType.NoShowFollowUp, `noshow:${appt.id}`);
  }

  /** Queues the reminders that are still in the future; safe to call repeatedly. */
  async scheduleReminders(appt: Appointment, now = new Date()): Promise<number> {
    let created = 0;
    for (const r of reminderSchedule(appt.slotStart, now)) {
      created += await this.send(appt, r.type, `${r.type}:${appt.id}:${appt.slotStart.toISOString()}`, r.sendAt);
    }
    return created;
  }

  /** Reminders and confirmations go out only if the visit is still on and at the same time. */
  async isStillValid(appointmentId: string, dedupeKey: string): Promise<boolean> {
    const appt = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    return !!appt && ACTIVE.includes(appt.status) && dedupeKey.includes(appt.slotStart.toISOString());
  }

  private async send(appt: Appointment, type: NotificationType, dedupeKey: string, scheduledFor?: Date): Promise<number> {
    return this.outbox.notifyPatient({
      type,
      patientId: appt.patientId,
      appointmentId: appt.id,
      relatedType: 'Appointment',
      relatedId: appt.id,
      dedupeKey,
      scheduledFor,
      values: await this.values(appt),
      link: '/appointments',
    });
  }

  private async values(appt: Appointment): Promise<MergeValues> {
    const [provider, type] = await Promise.all([
      this.prisma.staff.findUnique({ where: { id: appt.providerId } }),
      this.prisma.appointmentType.findUnique({ where: { id: appt.appointmentTypeId } }),
    ]);
    return {
      appointment_date: this.practice.date(appt.slotStart),
      appointment_time: this.practice.time(appt.slotStart),
      appointment_type: type?.name ?? 'appointment',
      provider_name: provider ? displayName(provider) : 'your provider',
      location: provider?.officeLocation ?? this.practice.name,
    };
  }

  private load(id: string): Promise<Appointment | null> {
    return this.prisma.appointment.findUnique({ where: { id } });
  }
}
