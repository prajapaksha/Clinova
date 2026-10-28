import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Permissions } from '@clinova/auth';
import { NotificationsApiService } from '@clinova/notifications/data-access';
import type { NotificationLogEntry } from '@clinova/notifications/domain';
import { NotificationStatus } from '@clinova/notifications/domain';

const CHANNEL_ICON: Record<string, string> = { EMAIL: 'mail', SMS: 'sms', PORTAL: 'web' };
const STATUS_LABEL: Record<string, string> = {
  QUEUED: 'Scheduled', SENDING: 'Sending', SENT: 'Sent', FAILED: 'Failed', SUPPRESSED: 'Not sent', CANCELLED: 'Cancelled',
};

/** Outbound message log (PRD §4.6: notifications are logged in the patient record and on the appointment). */
@Component({
  selector: 'clv-notification-log',
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, MatPaginatorModule, MatSelectModule, MatTooltipModule],
  templateUrl: './notification-log.html',
  styleUrl: './notification-log.scss',
})
export class NotificationLog {
  private readonly api = inject(NotificationsApiService);
  private readonly perms = inject(Permissions);

  readonly patientId = input<string>();
  readonly appointmentId = input<string>();
  /** Tight list without filters (appointment panel). */
  readonly compact = input(false);
  readonly showPatient = input(false);

  protected readonly icons = CHANNEL_ICON;
  protected readonly labels = STATUS_LABEL;
  protected readonly status = signal('');
  protected readonly channel = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);
  protected readonly entries = signal<NotificationLogEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly expanded = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly canManage = computed(() => this.perms.can('patient:profiles', 'write'));

  constructor() {
    effect(() => {
      const filters = {
        patientId: this.patientId(), appointmentId: this.appointmentId(), status: this.status(), channel: this.channel(),
        limit: this.compact() ? 50 : this.pageSize(), offset: this.compact() ? 0 : this.pageIndex() * this.pageSize(),
      };
      untracked(() => this.load(filters));
    });
  }

  protected toggle(e: NotificationLogEntry): void {
    this.expanded.set(this.expanded() === e.id ? null : e.id);
  }

  protected canRetry(e: NotificationLogEntry): boolean {
    return this.canManage() && e.channel !== 'PORTAL' && (e.status === NotificationStatus.Failed || e.status === NotificationStatus.Cancelled);
  }

  protected canCancel(e: NotificationLogEntry): boolean {
    return this.canManage() && e.status === NotificationStatus.Queued;
  }

  protected retry(e: NotificationLogEntry, event: Event): void {
    event.stopPropagation();
    this.api.retry(e.id).subscribe({ next: u => this.replace(u), error: err => this.fail(err) });
  }

  protected cancel(e: NotificationLogEntry, event: Event): void {
    event.stopPropagation();
    this.api.cancel(e.id).subscribe({ next: u => this.replace(u), error: err => this.fail(err) });
  }

  protected onPage(e: PageEvent): void {
    this.pageSize.set(e.pageSize);
    this.pageIndex.set(e.pageIndex);
  }

  protected when(e: NotificationLogEntry): Date {
    return e.sentAt ?? e.scheduledFor;
  }

  private replace(updated: NotificationLogEntry): void {
    this.entries.update(list => list.map(e => (e.id === updated.id ? { ...e, ...updated, patientName: e.patientName } : e)));
  }

  private load(filters: Record<string, unknown>): void {
    this.error.set(null);
    this.api.log(filters).subscribe({
      next: r => {
        this.entries.set(r.entries);
        this.total.set(r.total);
      },
      error: err => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    const msg = err instanceof HttpErrorResponse ? err.error?.message : null;
    this.error.set(typeof msg === 'string' ? msg : 'Messages could not be loaded.');
  }
}
