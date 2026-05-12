import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { SchedulingStore } from '@clinova/scheduling/data-access';
import type { Appointment, AppointmentStatus } from '@clinova/scheduling/domain';
import { APPOINTMENT_STATUS_COLOR } from '@clinova/scheduling/domain';
import { BookAppointmentDialog } from './book-appointment-dialog';

interface DayInfo {
  date: Date;
  dayName: string;
  dayNum: number;
  monthLabel: string;
  isToday: boolean;
  isoDate: string;
}

const START_HOUR = 7;
const END_HOUR = 19;
const HOUR_PX = 64;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function getMonday(ref: Date): Date {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h;
  return `${display} ${period}`;
}

@Component({
  selector: 'clv-calendar-page',
  standalone: true,
  imports: [
    DatePipe, TitleCasePipe, FormsModule, RouterModule,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatProgressSpinnerModule, MatTooltipModule, MatChipsModule,
  ],
  template: `
    <div class="cal">

      <!-- Toolbar -->
      <div class="cal__toolbar">
        <div class="cal__nav">
          <button mat-icon-button matTooltip="Previous week" (click)="prevWeek()">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <button mat-button (click)="goToToday()">Today</button>
          <button mat-icon-button matTooltip="Next week" (click)="nextWeek()">
            <mat-icon>chevron_right</mat-icon>
          </button>
          <span class="cal__week-label">{{ weekLabel() }}</span>
        </div>

        <div class="cal__toolbar-right">
          <mat-select [(ngModel)]="selectedProviderIdValue"
                      class="cal__provider-select"
                      placeholder="All providers">
            <mat-option value="">All Providers</mat-option>
            @for (p of store.providers(); track p.id) {
              <mat-option [value]="p.id">Dr. {{ p.firstName }} {{ p.lastName }}</mat-option>
            }
          </mat-select>

          <button mat-flat-button (click)="openBookDialog()">
            <mat-icon>add</mat-icon> Book
          </button>
        </div>
      </div>

      <!-- Main layout -->
      <div class="cal__layout">

        <!-- Calendar grid -->
        <div class="cal__grid-area">

          <!-- Day headers -->
          <div class="cal__header-row">
            <div class="cal__gutter"></div>
            @for (day of weekDays(); track day.isoDate) {
              <div class="cal__day-header" [class.cal__day-header--today]="day.isToday">
                <span class="cal__dow">{{ day.dayName }}</span>
                <span class="cal__dom" [class.cal__dom--today]="day.isToday">
                  {{ day.dayNum }}
                </span>
                @if (day.isToday) { <span class="cal__today-dot"></span> }
              </div>
            }
          </div>

          <!-- Scrollable grid body -->
          <div class="cal__grid-scroll">
            @if (store.loading()) {
              <div class="cal__loader"><mat-spinner diameter="28" /></div>
            }

            <div class="cal__grid">
              <!-- Time labels column -->
              <div class="cal__gutter-col">
                @for (h of hours; track h) {
                  <div class="cal__hour-label">{{ formatHour(h) }}</div>
                }
              </div>

              <!-- Day columns -->
              @for (day of weekDays(); track day.isoDate) {
                <div class="cal__day-col"
                     [class.cal__day-col--today]="day.isToday"
                     (click)="onDayColClick(day.date, $event)">

                  <!-- Hour + half-hour grid lines -->
                  @for (h of hours; track h) {
                    <div class="cal__hour-line"
                         [style.top.px]="(h - startHour) * hourPx"></div>
                    <div class="cal__half-line"
                         [style.top.px]="(h - startHour) * hourPx + hourPx / 2"></div>
                  }

                  <!-- "Now" indicator -->
                  @if (day.isToday && nowTop() >= 0) {
                    <div class="cal__now-line" [style.top.px]="nowTop()">
                      <div class="cal__now-dot"></div>
                    </div>
                  }

                  <!-- Appointments -->
                  @for (appt of appointmentsForDay(day.date); track appt.id) {
                    <div class="cal__appt"
                         [class.cal__appt--selected]="selectedAppt()?.id === appt.id"
                         [style.top.px]="apptTop(appt)"
                         [style.height.px]="apptHeight(appt)"
                         [style.border-left-color]="apptColor(appt)"
                         [matTooltip]="appt.patientName + ' · ' + appt.typeName"
                         (click)="$event.stopPropagation(); selectAppt(appt)">
                      <div class="cal__appt-name">{{ appt.patientName }}</div>
                      @if (apptHeight(appt) > 32) {
                        <div class="cal__appt-type">{{ appt.typeName }}</div>
                      }
                      @if (apptHeight(appt) > 48) {
                        <div class="cal__appt-time">
                          {{ appt.slot.start | date:'h:mm a' }}
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>

        </div>

        <!-- Detail panel -->
        @if (selectedAppt(); as appt) {
          <div class="cal__detail">
            <div class="cal__detail-head">
              <span class="cal__detail-title">Appointment</span>
              <button mat-icon-button (click)="clearSelection()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="cal__detail-status" [attr.data-status]="appt.status">
              {{ appt.status | titlecase }}
            </div>

            <div class="cal__detail-row">
              <mat-icon>person</mat-icon>
              <div>
                <strong>{{ appt.patientName }}</strong>
                <div class="cal__detail-sub">{{ appt.patientMrn }}</div>
              </div>
              <a mat-icon-button [routerLink]="['/patients', appt.patientId, 'appointments']"
                 matTooltip="Open patient profile">
                <mat-icon>open_in_new</mat-icon>
              </a>
            </div>

            <div class="cal__detail-row">
              <mat-icon>schedule</mat-icon>
              <div>
                <div>{{ appt.slot.start | date:'EEEE, MMMM d' }}</div>
                <div class="cal__detail-sub">
                  {{ appt.slot.start | date:'h:mm a' }} – {{ appt.slot.end | date:'h:mm a' }}
                </div>
              </div>
            </div>

            <div class="cal__detail-row">
              <mat-icon>medical_services</mat-icon>
              <div>{{ appt.typeName }}</div>
            </div>

            <div class="cal__detail-row">
              <mat-icon>badge</mat-icon>
              <div>{{ appt.providerName }}</div>
            </div>

            @if (appt.reasonForVisit) {
              <div class="cal__detail-row">
                <mat-icon>notes</mat-icon>
                <div>{{ appt.reasonForVisit }}</div>
              </div>
            }

            @if (appt.checkedInAt) {
              <div class="cal__detail-row">
                <mat-icon>how_to_reg</mat-icon>
                <div class="cal__detail-sub">Checked in {{ appt.checkedInAt | date:'h:mm a' }}</div>
              </div>
            }

            <!-- Actions -->
            <div class="cal__detail-actions">
              @if (appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') {
                <button mat-flat-button (click)="checkIn(appt.id)">
                  <mat-icon>how_to_reg</mat-icon> Check In
                </button>
                <button mat-stroked-button (click)="markNoShow(appt.id)">
                  <mat-icon>person_off</mat-icon> No Show
                </button>
                <button mat-button class="cal__btn-danger" (click)="cancelAppt(appt.id)">
                  <mat-icon>cancel</mat-icon> Cancel
                </button>
              }
              @if (appt.status === 'CHECKED_IN') {
                <button mat-flat-button (click)="startAppt(appt.id)">
                  <mat-icon>play_arrow</mat-icon> Start
                </button>
                <button mat-button class="cal__btn-danger" (click)="cancelAppt(appt.id)">
                  <mat-icon>cancel</mat-icon> Cancel
                </button>
              }
              @if (appt.status === 'IN_PROGRESS') {
                <button mat-flat-button (click)="completeAppt(appt.id)">
                  <mat-icon>check_circle</mat-icon> Complete
                </button>
              }
            </div>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

    .cal {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--mat-sys-surface, #fafafa);

      // ── Toolbar ────────────────────────────────────────────────────────────
      &__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        background: white;
        border-bottom: 1px solid var(--mat-sys-outline-variant, #e5e7eb);
        flex-shrink: 0;
        gap: 12px;
      }

      &__nav {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      &__week-label {
        font-size: 1rem;
        font-weight: 500;
        margin-left: 8px;
        white-space: nowrap;
      }

      &__toolbar-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      &__provider-select {
        width: 200px;
      }

      // ── Layout ─────────────────────────────────────────────────────────────
      &__layout {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      &__grid-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      // ── Day headers ────────────────────────────────────────────────────────
      &__header-row {
        display: grid;
        grid-template-columns: 56px repeat(7, 1fr);
        border-bottom: 1px solid var(--mat-sys-outline-variant, #e5e7eb);
        background: white;
        flex-shrink: 0;
      }

      &__gutter { /* empty left cell */ }

      &__day-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 4px;
        gap: 2px;

        &--today { background: var(--mat-sys-primary-container, #e0f2f1); }
      }

      &__dow {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .04em;
        color: var(--mat-sys-on-surface-variant, #6b7280);
      }

      &__dom {
        font-size: 1.125rem;
        font-weight: 400;
        line-height: 1;

        &--today {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: var(--mat-sys-primary, #00796b);
          color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 600;
        }
      }

      &__today-dot {
        width: 4px; height: 4px;
        border-radius: 50%;
        background: var(--mat-sys-primary, #00796b);
      }

      // ── Grid scroll ────────────────────────────────────────────────────────
      &__grid-scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
      }

      &__loader {
        position: absolute;
        top: 16px; left: 50%;
        transform: translateX(-50%);
        z-index: 10;
      }

      &__grid {
        display: grid;
        grid-template-columns: 56px repeat(7, 1fr);
        min-height: #{(END_HOUR - START_HOUR) * HOUR_PX}px;
      }

      // ── Gutter (time labels) ───────────────────────────────────────────────
      &__gutter-col {
        border-right: 1px solid var(--mat-sys-outline-variant, #e5e7eb);
        background: white;
        position: sticky;
        left: 0;
        z-index: 2;
      }

      &__hour-label {
        height: 64px;
        padding: 4px 6px 0;
        font-size: 0.6875rem;
        color: var(--mat-sys-on-surface-variant, #9ca3af);
        text-align: right;
        border-top: 1px solid var(--mat-sys-outline-variant, #e5e7eb);
        line-height: 1;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
      }

      // ── Day columns ────────────────────────────────────────────────────────
      &__day-col {
        position: relative;
        height: #{(END_HOUR - START_HOUR) * HOUR_PX}px;
        border-right: 1px solid var(--mat-sys-outline-variant, #e5e7eb);
        cursor: pointer;

        &--today {
          background: rgba(0, 121, 107, 0.03);
        }

        &:hover { background: rgba(0,0,0,.02); }
      }

      &__hour-line {
        position: absolute;
        left: 0; right: 0;
        height: 1px;
        background: var(--mat-sys-outline-variant, #e5e7eb);
        pointer-events: none;
      }

      &__half-line {
        position: absolute;
        left: 0; right: 0;
        height: 1px;
        background: var(--mat-sys-outline-variant, #f3f4f6);
        border-top: 1px dashed var(--mat-sys-outline-variant, #e5e7eb);
        pointer-events: none;
      }

      // ── Now indicator ──────────────────────────────────────────────────────
      &__now-line {
        position: absolute;
        left: 0; right: 0;
        height: 2px;
        background: #ef4444;
        pointer-events: none;
        z-index: 3;
      }

      &__now-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #ef4444;
        position: absolute;
        left: -4px;
        top: -3px;
      }

      // ── Appointment cards ──────────────────────────────────────────────────
      &__appt {
        position: absolute;
        left: 2px; right: 2px;
        border-radius: 4px;
        background: white;
        border-left: 3px solid var(--mat-sys-primary, #00796b);
        box-shadow: 0 1px 3px rgba(0,0,0,.12);
        padding: 2px 4px;
        cursor: pointer;
        overflow: hidden;
        z-index: 1;
        transition: box-shadow .15s;

        &:hover { box-shadow: 0 2px 8px rgba(0,0,0,.18); }

        &--selected {
          box-shadow: 0 0 0 2px var(--mat-sys-primary, #00796b), 0 2px 8px rgba(0,0,0,.18);
        }
      }

      &__appt-name {
        font-size: .75rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
      }

      &__appt-type {
        font-size: .6875rem;
        color: var(--mat-sys-on-surface-variant, #6b7280);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &__appt-time {
        font-size: .6875rem;
        color: var(--mat-sys-on-surface-variant, #9ca3af);
      }

      // ── Detail panel ───────────────────────────────────────────────────────
      &__detail {
        width: 300px;
        flex-shrink: 0;
        border-left: 1px solid var(--mat-sys-outline-variant, #e5e7eb);
        background: white;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }

      &__detail-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px 8px;
        border-bottom: 1px solid var(--mat-sys-outline-variant, #e5e7eb);
      }

      &__detail-title {
        font-weight: 600;
        font-size: 1rem;
      }

      &__detail-status {
        margin: 12px 16px;
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: .75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .04em;
        background: #e5e7eb;
        color: #374151;

        &[data-status="CONFIRMED"]  { background: #dbeafe; color: #1e40af; }
        &[data-status="CHECKED_IN"] { background: #fef3c7; color: #92400e; }
        &[data-status="IN_PROGRESS"]{ background: #ede9fe; color: #5b21b6; }
        &[data-status="COMPLETED"]  { background: #d1fae5; color: #065f46; }
        &[data-status="CANCELLED"]  { background: #f3f4f6; color: #6b7280; }
        &[data-status="NO_SHOW"]    { background: #fee2e2; color: #991b1b; }
        &[data-status="RESCHEDULED"]{ background: #ffedd5; color: #9a3412; }
      }

      &__detail-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 8px 16px;
        font-size: .875rem;

        mat-icon {
          font-size: 1.125rem;
          width: 1.125rem;
          height: 1.125rem;
          color: var(--mat-sys-on-surface-variant, #6b7280);
          flex-shrink: 0;
          margin-top: 1px;
        }

        > div { flex: 1; }

        a[mat-icon-button] {
          flex-shrink: 0;
          width: 28px; height: 28px;
          line-height: 28px;
          mat-icon { font-size: .875rem; width: .875rem; height: .875rem; }
        }
      }

      &__detail-sub {
        font-size: .75rem;
        color: var(--mat-sys-on-surface-variant, #6b7280);
        margin-top: 1px;
      }

      &__detail-actions {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: auto;
        border-top: 1px solid var(--mat-sys-outline-variant, #e5e7eb);

        button { justify-content: flex-start; }
      }

      &__btn-danger { color: var(--mat-sys-error, #dc2626) !important; }
    }
  `],
})
export class CalendarPage {
  protected readonly store = inject(SchedulingStore);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly startHour = START_HOUR;
  protected readonly endHour = END_HOUR;
  protected readonly hourPx = HOUR_PX;
  protected readonly hours = HOURS;
  protected readonly formatHour = formatHour;

  protected selectedProviderIdValue = '';
  protected readonly selectedAppt = signal<Appointment | null>(null);

  protected readonly viewDate = signal(new Date());

  protected readonly weekDays = computed<DayInfo[]>(() => {
    const monday = getMonday(this.viewDate());
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return {
        date: d,
        dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        dayNum: d.getDate(),
        monthLabel: d.toLocaleDateString('en', { month: 'short' }),
        isToday: d.toDateString() === today.toDateString(),
        isoDate: d.toISOString().slice(0, 10),
      };
    });
  });

  protected readonly weekLabel = computed(() => {
    const days = this.weekDays();
    const first = days[0];
    const last = days[6];
    const sameMonth = first.date.getMonth() === last.date.getMonth();
    const firstLabel = first.date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    const lastLabel = last.date.toLocaleDateString('en', { month: sameMonth ? undefined : 'short', day: 'numeric' });
    return `${firstLabel} – ${lastLabel}, ${last.date.getFullYear()}`;
  });

  protected readonly nowTop = computed(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < START_HOUR || h >= END_HOUR) return -1;
    return (h - START_HOUR + m / 60) * HOUR_PX;
  });

  protected readonly filteredAppointments = computed(() => {
    const appts = this.store.entities();
    const pid = this.selectedProviderIdValue;
    return pid ? appts.filter(a => a.providerId === pid) : appts;
  });

  constructor() {
    this.store.loadAppointmentTypes();
    this.store.loadProviders();

    effect(() => {
      const days = this.weekDays();
      const from = days[0].date;
      const to = new Date(days[6].date);
      to.setHours(23, 59, 59, 999);
      this.store.loadAppointments({ dateRange: { from, to } });
    });
  }

  protected appointmentsForDay(date: Date): Appointment[] {
    const dayStr = date.toDateString();
    return this.filteredAppointments().filter(a => {
      const start = new Date(a.slot.start);
      return start.toDateString() === dayStr;
    });
  }

  protected apptTop(appt: Appointment): number {
    const s = new Date(appt.slot.start);
    return (s.getHours() - START_HOUR + s.getMinutes() / 60) * HOUR_PX;
  }

  protected apptHeight(appt: Appointment): number {
    const s = new Date(appt.slot.start);
    const e = new Date(appt.slot.end);
    const min = (e.getTime() - s.getTime()) / 60000;
    return Math.max((min / 60) * HOUR_PX, 22);
  }

  protected apptColor(appt: Appointment): string {
    return appt.typeColor
      ?? APPOINTMENT_STATUS_COLOR[appt.status as AppointmentStatus]
      ?? '#9E9E9E';
  }

  protected prevWeek(): void {
    const d = new Date(this.viewDate());
    d.setDate(d.getDate() - 7);
    this.viewDate.set(d);
  }

  protected nextWeek(): void {
    const d = new Date(this.viewDate());
    d.setDate(d.getDate() + 7);
    this.viewDate.set(d);
  }

  protected goToToday(): void {
    this.viewDate.set(new Date());
  }

  protected selectAppt(appt: Appointment): void {
    this.selectedAppt.set(appt);
  }

  protected clearSelection(): void {
    this.selectedAppt.set(null);
  }

  protected onDayColClick(date: Date, event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const hour = Math.min(END_HOUR - 1, Math.floor(y / HOUR_PX) + START_HOUR);
    const minute = y % HOUR_PX >= HOUR_PX / 2 ? 30 : 0;
    this.openBookDialog(date, hour, minute);
  }

  protected openBookDialog(date?: Date, hour?: number, minute?: number): void {
    const ref = this.dialog.open(BookAppointmentDialog, {
      data: {
        prefilledDate: date ?? new Date(),
        prefilledHour: hour ?? 9,
        prefilledMinute: minute ?? 0,
      },
      width: '540px',
    });
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        const days = this.weekDays();
        const from = days[0].date;
        const to = new Date(days[6].date);
        to.setHours(23, 59, 59, 999);
        this.store.loadAppointments({ dateRange: { from, to } });
      }
    });
  }

  protected checkIn(id: string): void {
    this.store.checkIn(id as any);
    this.clearSelection();
  }

  protected markNoShow(id: string): void {
    this.store.markNoShow(id as any);
    this.clearSelection();
  }

  protected cancelAppt(id: string): void {
    this.store.cancel({ id: id as any, reason: 'PATIENT_REQUEST' as any });
    this.clearSelection();
  }

  protected startAppt(id: string): void {
    // update status to IN_PROGRESS via API update
    this.store.checkIn(id as any); // re-use for now, proper impl needs update endpoint
    this.clearSelection();
  }

  protected completeAppt(id: string): void {
    this.clearSelection();
  }
}
