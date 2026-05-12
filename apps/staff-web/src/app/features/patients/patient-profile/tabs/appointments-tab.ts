import { Component, computed, DestroyRef, effect, inject } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PatientStore } from '@clinova/patient/data-access';
import { SchedulingStore } from '@clinova/scheduling/data-access';
import type { Appointment } from '@clinova/scheduling/domain';
import { BookAppointmentDialog } from '../../calendar/book-appointment-dialog';

@Component({
  selector: 'clv-appointments-tab',
  standalone: true,
  imports: [
    DatePipe, TitleCasePipe, RouterModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    @if (patient(); as p) {
      <div class="apt">

        <div class="apt__header">
          <h2 class="apt__section-title">Appointments</h2>
          <button mat-stroked-button (click)="openBookDialog()">
            <mat-icon>add</mat-icon> Book Appointment
          </button>
        </div>

        @if (store.loading()) {
          <div class="apt__loading"><mat-spinner diameter="28" /></div>
        }

        <!-- Upcoming -->
        <h3 class="apt__group-title">Upcoming</h3>
        @if (upcoming().length === 0 && !store.loading()) {
          <div class="apt__empty">
            <mat-icon class="apt__empty-icon">calendar_today</mat-icon>
            <p>No upcoming appointments.</p>
          </div>
        } @else {
          @for (appt of upcoming(); track appt.id) {
            <div class="apt__card" [attr.data-status]="appt.status">
              <div class="apt__card-left">
                <div class="apt__date">
                  <span class="apt__day">{{ appt.slot.start | date:'d' }}</span>
                  <span class="apt__month">{{ appt.slot.start | date:'MMM' }}</span>
                </div>
              </div>
              <div class="apt__card-body">
                <div class="apt__card-top">
                  <strong>{{ appt.typeName }}</strong>
                  <span class="apt__status" [attr.data-status]="appt.status">
                    {{ appt.status | titlecase }}
                  </span>
                </div>
                <div class="apt__card-meta">
                  <mat-icon>schedule</mat-icon>
                  {{ appt.slot.start | date:'h:mm a' }} – {{ appt.slot.end | date:'h:mm a' }}
                </div>
                <div class="apt__card-meta">
                  <mat-icon>badge</mat-icon>
                  {{ appt.providerName }}
                </div>
                @if (appt.reasonForVisit) {
                  <div class="apt__card-meta apt__card-reason">{{ appt.reasonForVisit }}</div>
                }
              </div>
            </div>
          }
        }

        <!-- Past -->
        <h3 class="apt__group-title apt__group-title--past">Past</h3>
        @if (past().length === 0 && !store.loading()) {
          <div class="apt__empty">
            <mat-icon class="apt__empty-icon">history</mat-icon>
            <p>No past appointments.</p>
          </div>
        } @else {
          @for (appt of past(); track appt.id) {
            <div class="apt__card apt__card--past" [attr.data-status]="appt.status">
              <div class="apt__card-left">
                <div class="apt__date">
                  <span class="apt__day">{{ appt.slot.start | date:'d' }}</span>
                  <span class="apt__month">{{ appt.slot.start | date:'MMM' }}</span>
                </div>
              </div>
              <div class="apt__card-body">
                <div class="apt__card-top">
                  <strong>{{ appt.typeName }}</strong>
                  <span class="apt__status" [attr.data-status]="appt.status">
                    {{ appt.status | titlecase }}
                  </span>
                </div>
                <div class="apt__card-meta">
                  <mat-icon>schedule</mat-icon>
                  {{ appt.slot.start | date:'h:mm a' }}
                </div>
                <div class="apt__card-meta">
                  <mat-icon>badge</mat-icon>
                  {{ appt.providerName }}
                </div>
              </div>
            </div>
          }
        }

      </div>
    }
  `,
  styles: [`
    .apt {
      padding: 24px;

      &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }

      &__section-title { font-size: 1.125rem; font-weight: 600; margin: 0; }

      &__loading {
        display: flex; justify-content: center; padding: 24px;
      }

      &__group-title {
        font-size: 0.875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .05em;
        color: var(--mat-sys-on-surface-variant, #6b7280);
        margin: 0 0 12px;

        &--past { margin-top: 32px; }
      }

      &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 32px 16px;
        border: 1px dashed var(--mat-sys-outline, #d1d5db);
        border-radius: 8px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant, #9ca3af);
        margin-bottom: 16px;
        font-size: .875rem;
      }

      &__empty-icon {
        font-size: 36px !important;
        width: 36px; height: 36px;
        opacity: 0.3;
      }

      &__card {
        display: flex;
        gap: 16px;
        padding: 12px 16px;
        border-radius: 8px;
        background: white;
        border: 1px solid var(--mat-sys-outline-variant, #e5e7eb);
        margin-bottom: 8px;
        border-left: 4px solid var(--mat-sys-primary, #00796b);
        transition: box-shadow .15s;

        &:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }

        &--past { border-left-color: #d1d5db; opacity: .8; }

        &[data-status="CANCELLED"] { border-left-color: #9ca3af; }
        &[data-status="NO_SHOW"]   { border-left-color: #ef4444; }
        &[data-status="COMPLETED"] { border-left-color: #10b981; }
        &[data-status="CHECKED_IN"]{ border-left-color: #f59e0b; }
      }

      &__card-left { flex-shrink: 0; }

      &__date {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 40px;
        background: var(--mat-sys-surface-container, #f3f4f6);
        border-radius: 6px;
        padding: 4px;
      }

      &__day { font-size: 1.25rem; font-weight: 700; line-height: 1; }
      &__month { font-size: .625rem; text-transform: uppercase; color: var(--mat-sys-on-surface-variant, #6b7280); }

      &__card-body { flex: 1; min-width: 0; }

      &__card-top {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
        strong { flex: 1; font-size: .9375rem; }
      }

      &__status {
        font-size: .6875rem;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        background: #e5e7eb; color: #374151;

        &[data-status="CONFIRMED"]  { background: #dbeafe; color: #1e40af; }
        &[data-status="CHECKED_IN"] { background: #fef3c7; color: #92400e; }
        &[data-status="IN_PROGRESS"]{ background: #ede9fe; color: #5b21b6; }
        &[data-status="COMPLETED"]  { background: #d1fae5; color: #065f46; }
        &[data-status="CANCELLED"]  { background: #f3f4f6; color: #6b7280; }
        &[data-status="NO_SHOW"]    { background: #fee2e2; color: #991b1b; }
      }

      &__card-meta {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: .8125rem;
        color: var(--mat-sys-on-surface-variant, #6b7280);
        margin-top: 2px;

        mat-icon { font-size: .875rem; width: .875rem; height: .875rem; }
      }

      &__card-reason { font-style: italic; }
    }
  `],
})
export class AppointmentsTab {
  protected readonly patientStore = inject(PatientStore);
  protected readonly store = inject(SchedulingStore);
  private readonly dialog = inject(MatDialog);

  protected readonly patient = computed(() => this.patientStore.selectedPatient());

  protected readonly upcoming = computed(() => {
    const now = new Date();
    return this.store.entities()
      .filter(a => new Date(a.slot.start) >= now
        && a.status !== 'CANCELLED'
        && a.status !== 'NO_SHOW')
      .sort((a, b) => new Date(a.slot.start).getTime() - new Date(b.slot.start).getTime());
  });

  protected readonly past = computed(() => {
    const now = new Date();
    return this.store.entities()
      .filter(a => new Date(a.slot.start) < now
        || a.status === 'CANCELLED'
        || a.status === 'NO_SHOW'
        || a.status === 'COMPLETED')
      .sort((a, b) => new Date(b.slot.start).getTime() - new Date(a.slot.start).getTime())
      .slice(0, 10);
  });

  constructor() {
    effect(() => {
      const p = this.patient();
      if (p) {
        this.store.loadAppointments({ patientId: p.id });
        this.store.loadAppointmentTypes();
        this.store.loadProviders();
      }
    });
  }

  protected openBookDialog(): void {
    const p = this.patient();
    this.dialog.open(BookAppointmentDialog, {
      data: { prefilledPatient: p },
      width: '540px',
    });
  }
}
