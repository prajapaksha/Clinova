import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PortalApiService } from '@clinova/portal/data-access';
import type { PortalAppointment } from '@clinova/portal/domain';
import { CANCELLATION_CUTOFF_HOURS } from '@clinova/portal/domain';
import { APPOINTMENT_STATUS, errorMessage } from '../shared/portal-shared';

const ACTIVE = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];

@Component({
  selector: 'clv-portal-appointments',
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule],
  template: `
    <header class="pp-head">
      <div>
        <h1 class="pp-title">Appointments</h1>
        <p class="pp-sub">Changes can be made online up to {{ cutoff }} hours before your visit.</p>
      </div>
      <a mat-flat-button color="primary" routerLink="book"><mat-icon>add</mat-icon> Book an appointment</a>
    </header>

    <div class="pp-tabs" role="tablist">
      <button type="button" role="tab" [class.is-active]="tab() === 'upcoming'" [attr.aria-selected]="tab() === 'upcoming'" (click)="tab.set('upcoming')">Upcoming ({{ upcoming().length }})</button>
      <button type="button" role="tab" [class.is-active]="tab() === 'past'" [attr.aria-selected]="tab() === 'past'" (click)="tab.set('past')">Past</button>
    </div>
    @if (error()) { <p class="pp-note pp-note--warn" role="alert">{{ error() }}</p> }

    <section class="pp-card">
      <ul class="pp-list">
        @for (a of shown(); track a.id) {
          <li class="ap">
            <div class="ap__date" aria-hidden="true"><span>{{ a.start | date:'MMM' }}</span><strong>{{ a.start | date:'d' }}</strong></div>
            <div class="pp-list__main">
              <div class="pp-list__title">{{ a.start | date:'EEEE, MMMM d · h:mm a' }}
                <span [class]="'pp-badge pp-badge--' + status(a).tone">{{ status(a).label }}</span></div>
              <div class="pp-list__meta">{{ a.typeName }} with {{ a.providerName }}@if (a.location) { · {{ a.location }} }</div>
              @if (a.reasonForVisit) { <div class="pp-list__meta">Reason: {{ a.reasonForVisit }}</div> }
              @if (confirming() === a.id) {
                <div class="ap__confirm" role="alertdialog" aria-label="Cancel appointment">
                  <span>Cancel this appointment?</span>
                  <button mat-button type="button" (click)="confirming.set(null)">Keep it</button>
                  <button mat-flat-button color="warn" type="button" [disabled]="busy()" (click)="cancel(a)">Yes, cancel</button>
                </div>
              }
            </div>
            <div class="ap__actions">
              @if (a.canChange && confirming() !== a.id) {
                <a mat-stroked-button [routerLink]="[a.id, 'reschedule']">Reschedule</a>
                <button mat-button type="button" (click)="confirming.set(a.id)">Cancel</button>
              } @else if (tab() === 'upcoming' && !a.canChange) {
                <span class="pp-muted ap__call">Call the office to change</span>
              }
              @if (a.visitSummaryId) {
                <a mat-stroked-button [routerLink]="['/records/visits', a.visitSummaryId]">Visit summary</a>
              }
            </div>
          </li>
        } @empty {
          <li class="pp-empty"><mat-icon>event_available</mat-icon><br />
            {{ tab() === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments yet.' }}</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .ap { align-items: flex-start !important; flex-wrap: wrap; }
    .ap__date { width: 54px; padding: 6px 0; border-radius: 12px; background: var(--clv-primary-50); color: var(--clv-primary-700); display: flex; flex-direction: column; align-items: center; font-size: 12px; text-transform: uppercase; font-weight: 600; }
    .ap__date strong { font-size: 22px; line-height: 1.1; }
    .ap .pp-badge { margin-left: 6px; vertical-align: middle; }
    .ap__actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .ap__call { font-size: 13px; }
    .ap__confirm { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; padding: 8px 12px; border-radius: 12px; background: var(--clv-warning-bg); }
    .pp-empty { display: block !important; }
  `,
})
export class PortalAppointmentsPage {
  private readonly api = inject(PortalApiService);
  private readonly snack = inject(MatSnackBar);

  protected readonly cutoff = CANCELLATION_CUTOFF_HOURS;
  protected readonly all = signal<PortalAppointment[]>([]);
  protected readonly tab = signal<'upcoming' | 'past'>('upcoming');
  protected readonly confirming = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly upcoming = computed(() => this.all()
    .filter(a => ACTIVE.includes(a.status) && new Date(a.end) > new Date())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()));
  protected readonly shown = computed(() => this.tab() === 'upcoming'
    ? this.upcoming()
    : this.all().filter(a => !this.upcoming().includes(a)));

  constructor() {
    this.load();
  }

  protected status(a: PortalAppointment) {
    return APPOINTMENT_STATUS[a.status] ?? { label: a.status, tone: '' };
  }

  protected cancel(a: PortalAppointment): void {
    this.busy.set(true);
    this.api.cancel(a.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirming.set(null);
        this.snack.open('Your appointment was cancelled.', 'OK', { duration: 4000 });
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  private load(): void {
    this.api.appointments().subscribe({ next: list => this.all.set(list), error: err => this.error.set(errorMessage(err)) });
  }
}
