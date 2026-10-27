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
import { BookAppointmentDialog } from '../book-appointment-dialog/book-appointment-dialog.component';

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
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent {
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
    this.store.checkIn(id as any);
    this.clearSelection();
  }

  protected completeAppt(_id: string): void {
    this.clearSelection();
  }
}
