import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PortalApiService } from '@clinova/portal/data-access';
import type { AvailabilityDay, BookableType, PortalAppointment, PortalProvider, TimeWindow } from '@clinova/portal/domain';
import { MAX_ADVANCE_BOOKING_DAYS } from '@clinova/portal/domain';
import { addDays, errorMessage, localDateKey } from '../shared/portal-shared';

type Step = 'type' | 'provider' | 'time' | 'confirm' | 'done';

/** Book: visit type → provider → date & time → reason & confirm (PRD §4.8). Also handles reschedule. */
@Component({
  selector: 'clv-portal-book',
  imports: [DatePipe, FormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './book.page.html',
  styleUrl: './book.page.scss',
})
export class PortalBookPage implements OnInit {
  private readonly api = inject(PortalApiService);

  /** Appointment id when rescheduling. */
  readonly id = input<string>();

  protected readonly step = signal<Step>('type');
  protected readonly types = signal<BookableType[]>([]);
  protected readonly providers = signal<PortalProvider[]>([]);
  protected readonly type = signal<BookableType | null>(null);
  protected readonly provider = signal<PortalProvider | null>(null);
  protected readonly existing = signal<PortalAppointment | null>(null);

  protected readonly weekStart = signal(localDateKey());
  protected readonly days = signal<AvailabilityDay[]>([]);
  protected readonly day = signal<string | null>(null);
  protected readonly slot = signal<TimeWindow | null>(null);
  protected readonly loadingSlots = signal(false);
  protected reason = '';

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<PortalAppointment | null>(null);

  protected readonly isReschedule = computed(() => !!this.id());
  protected readonly slotsForDay = computed(() => this.days().find(d => d.date === this.day())?.slots ?? []);
  protected readonly canGoBack = computed(() => this.weekStart() > localDateKey());
  protected readonly canGoForward = computed(() => addDays(this.weekStart(), 7) <= addDays(localDateKey(), MAX_ADVANCE_BOOKING_DAYS));
  protected readonly stepIndex = computed(() => ['type', 'provider', 'time', 'confirm'].indexOf(this.step()));

  ngOnInit(): void {
    this.api.bookableTypes().subscribe(t => this.types.set(t));
    this.api.providers().subscribe(p => this.providers.set(p));
    const id = this.id();
    if (id) {
      this.api.appointments().subscribe(list => {
        const appt = list.find(a => a.id === id);
        if (!appt) {
          this.error.set('Appointment not found.');
          return;
        }
        this.existing.set(appt);
        this.type.set({ id: appt.typeId, name: appt.typeName, description: null, durationMinutes: 0 });
        this.provider.set({ id: appt.providerId, displayName: appt.providerName, title: null, specialties: [], bio: null, officeLocation: appt.location, isMyProvider: true });
        this.goToTime();
      });
    }
  }

  protected chooseType(t: BookableType): void {
    this.type.set(t);
    this.step.set('provider');
  }

  protected chooseProvider(p: PortalProvider): void {
    this.provider.set(p);
    this.goToTime();
  }

  protected shiftWeek(days: number): void {
    const next = addDays(this.weekStart(), days);
    this.weekStart.set(next < localDateKey() ? localDateKey() : next);
    this.loadSlots();
  }

  protected chooseSlot(s: TimeWindow): void {
    this.slot.set(s);
    this.step.set('confirm');
  }

  protected back(): void {
    const order: Step[] = this.isReschedule() ? ['time', 'confirm'] : ['type', 'provider', 'time', 'confirm'];
    const i = order.indexOf(this.step());
    if (i > 0) this.step.set(order[i - 1]);
  }

  protected confirm(): void {
    const slot = this.slot();
    const start = slot ? new Date(slot.start).toISOString() : '';
    this.busy.set(true);
    this.error.set(null);
    const existing = this.existing();
    const request = existing
      ? this.api.reschedule(existing.id, start)
      : this.api.book({ providerId: this.provider()?.id ?? '', appointmentTypeId: this.type()?.id ?? '', start, reasonForVisit: this.reason.trim() || undefined });
    request.subscribe({
      next: appt => {
        this.busy.set(false);
        this.result.set(appt);
        this.step.set('done');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
        if (err?.status === 409) {
          this.step.set('time');
          this.loadSlots();
        }
      },
    });
  }

  protected dayLabel(date: string): Date {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private goToTime(): void {
    this.step.set('time');
    this.weekStart.set(localDateKey());
    this.loadSlots();
  }

  private loadSlots(): void {
    const type = this.type();
    const provider = this.provider();
    if (!type || !provider) return;
    this.loadingSlots.set(true);
    this.slot.set(null);
    this.api.availability({
      providerId: provider.id, appointmentTypeId: type.id, from: this.weekStart(), days: 7, excludeAppointmentId: this.existing()?.id,
    }).subscribe({
      next: days => {
        this.loadingSlots.set(false);
        this.days.set(days);
        this.day.set(days.find(d => d.slots.length)?.date ?? days[0]?.date ?? null);
      },
      error: err => {
        this.loadingSlots.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
