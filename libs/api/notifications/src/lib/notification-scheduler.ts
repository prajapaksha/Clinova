import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@clinova/api/shared';
import { STATEMENT_REMINDERS } from '@clinova/notifications/domain';
import { AppointmentNotices } from './appointment-notices';
import { NotificationOutbox } from './notification-outbox';
import { PracticeSettings } from './practice-settings';
import { invoiceBalances } from './billing-snapshot';

const DAY_MS = 86_400_000;

/** Time-based notices the worker creates: reminder backfill and overdue balance reminders. */
@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentNotices,
    private readonly outbox: NotificationOutbox,
    private readonly practice: PracticeSettings,
  ) {}

  /**
   * Makes sure every upcoming visit has its reminders queued — covers appointments created
   * before notifications existed, imported, or booked while events were not processed.
   */
  async ensureReminders(now = new Date(), horizonHours = 49): Promise<number> {
    const upcoming = await this.prisma.appointment.findMany({
      where: { status: { in: ['SCHEDULED', 'CONFIRMED'] }, slotStart: { gt: now, lte: new Date(now.getTime() + horizonHours * 3_600_000) } },
    });
    let created = 0;
    for (const appt of upcoming) created += await this.appointments.scheduleReminders(appt, now);
    if (created) this.logger.log(`Queued ${created} reminder message(s)`);
    return created;
  }

  /**
   * PRD §4.6: balance reminders at 30 and 60 days overdue — one message per patient per
   * threshold (keyed to their oldest overdue bill), covering everything that is past due.
   */
  async statementReminders(now = new Date()): Promise<number> {
    const overdue = (await invoiceBalances(this.prisma, {}))
      .filter(i => i.balanceCents > 0 && i.dueDate && i.dueDate.getTime() + STATEMENT_REMINDERS[0].daysOverdue * DAY_MS <= now.getTime());
    const byPatient = new Map<string, typeof overdue>();
    for (const inv of overdue) byPatient.set(inv.patientId, [...(byPatient.get(inv.patientId) ?? []), inv]);

    let created = 0;
    for (const [patientId, bills] of byPatient) {
      const oldest = [...bills].sort((a, b) => (a.dueDate as Date).getTime() - (b.dueDate as Date).getTime())[0];
      const daysOverdue = Math.floor((now.getTime() - (oldest.dueDate as Date).getTime()) / DAY_MS);
      // Only the most recent threshold, so a 75-day-old bill doesn't also get the 30-day notice today.
      const step = [...STATEMENT_REMINDERS].reverse().find(r => daysOverdue >= r.daysOverdue);
      if (!step) continue;
      created += await this.outbox.notifyPatient({
        type: step.type,
        patientId,
        dedupeKey: `statement${step.daysOverdue}:${oldest.id}`,
        relatedType: 'Invoice',
        relatedId: oldest.id,
        link: `/billing/invoices/${oldest.id}`,
        values: {
          invoice_number: oldest.number,
          balance_amount: this.practice.money(bills.reduce((s, b) => s + b.balanceCents, 0)),
          due_date: this.practice.shortDate(oldest.dueDate as Date),
        },
      });
    }
    if (created) this.logger.log(`Queued ${created} balance reminder message(s)`);
    return created;
  }}
