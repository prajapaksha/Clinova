import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DeliveryProviders, NotificationDispatcher, NotificationScheduler, PracticeSettings } from '@clinova/api/notifications';

interface Job {
  name: string;
  everyMs: number;
  run: () => Promise<unknown>;
}

const env = (name: string, fallback: number) => Number(process.env[name]) || fallback;

/**
 * Polls the database outbox (no Redis needed). Each job runs on its own interval and never
 * overlaps itself; shutdown waits for in-flight work to finish.
 */
@Injectable()
export class NotificationWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('NotificationWorker');
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Map<string, Promise<unknown>>();

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly scheduler: NotificationScheduler,
    private readonly providers: DeliveryProviders,
    private readonly practice: PracticeSettings,
  ) {}

  onApplicationBootstrap(): void {
    const jobs: Job[] = [
      { name: 'dispatch', everyMs: env('WORKER_POLL_MS', 5_000), run: () => this.dispatch() },
      { name: 'reminders', everyMs: env('WORKER_REMINDER_SWEEP_MS', 5 * 60_000), run: () => this.scheduler.ensureReminders() },
      { name: 'statements', everyMs: env('WORKER_STATEMENT_SWEEP_MS', 60 * 60_000), run: () => this.scheduler.statementReminders() },
    ];
    this.logger.log(`Email via ${this.providers.email.name}, SMS via ${this.providers.sms.name}; time zone ${this.practice.timeZone}`);
    for (const job of jobs) {
      void this.tick(job);
      this.timers.push(setInterval(() => void this.tick(job), job.everyMs));
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.timers.forEach(clearInterval);
    await Promise.allSettled(this.running.values());
    this.logger.log('Worker stopped');
  }

  private async dispatch(): Promise<void> {
    const s = await this.dispatcher.dispatchDue();
    const total = s.sent + s.retried + s.failed + s.deferred + s.cancelled;
    if (total) this.logger.log(`Delivered ${s.sent}, retrying ${s.retried}, failed ${s.failed}, deferred ${s.deferred}, cancelled ${s.cancelled}`);
  }

  private async tick(job: Job): Promise<void> {
    if (this.running.has(job.name)) return;
    const work = job.run()
      .catch(err => this.logger.error(`${job.name} failed: ${err instanceof Error ? err.message : err}`))
      .finally(() => this.running.delete(job.name));
    this.running.set(job.name, work);
    await work;
  }
}