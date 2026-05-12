import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { PatientApiService } from '@clinova/patient/data-access';
import type { Patient } from '@clinova/patient/domain';
import { SchedulingStore } from '@clinova/scheduling/data-access';
import type { BookAppointmentDto } from '@clinova/scheduling/data-access';
import type { AppointmentType, AppointmentTypeId, Provider } from '@clinova/scheduling/domain';

export interface BookDialogData {
  prefilledPatient?: Patient;
  prefilledDate?: Date;
  prefilledHour?: number;
  prefilledMinute?: number;
}

const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMin = 7 * 60 + i * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h;
  return { label: `${displayH}:${m.toString().padStart(2, '0')} ${period}`, hour: h, minute: m };
});

@Component({
  selector: 'clv-book-appointment-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatAutocompleteModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Book Appointment</h2>

    <mat-dialog-content>
      <!-- Patient Search -->
      <mat-form-field class="bad__field">
        <mat-label>Patient</mat-label>
        <input matInput
               [value]="patientSearch()"
               (input)="onPatientInput($event)"
               [matAutocomplete]="patientAuto"
               placeholder="Search by name or MRN…" />
        <mat-autocomplete #patientAuto (optionSelected)="onPatientSelected($any($event.option.value))">
          @if (searchingPatients()) {
            <mat-option disabled>
              <mat-spinner diameter="16" style="display:inline-block;margin-right:8px" />
              Searching…
            </mat-option>
          }
          @for (p of patientResults(); track p.id) {
            <mat-option [value]="p">
              {{ p.firstName }} {{ p.lastName }}
              <span style="color:#9ca3af;font-size:.75rem;margin-left:8px">{{ p.mrn }}</span>
            </mat-option>
          }
        </mat-autocomplete>
        @if (selectedPatient()) {
          <mat-icon matSuffix style="color:#388e3c">check_circle</mat-icon>
        }
      </mat-form-field>

      <!-- Provider -->
      <mat-form-field class="bad__field">
        <mat-label>Provider</mat-label>
        <mat-select [(ngModel)]="selectedProviderId">
          @for (p of providers(); track p.id) {
            <mat-option [value]="p.id">Dr. {{ p.firstName }} {{ p.lastName }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <!-- Appointment Type -->
      <mat-form-field class="bad__field">
        <mat-label>Type</mat-label>
        <mat-select [(ngModel)]="selectedTypeId" (ngModelChange)="onTypeChange($event)">
          @for (t of appointmentTypes(); track t.id) {
            <mat-option [value]="t.id">{{ t.name }} ({{ t.defaultDurationMinutes }} min)</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <!-- Date + Time row -->
      <div class="bad__row">
        <mat-form-field class="bad__field bad__field--date">
          <mat-label>Date</mat-label>
          <input matInput type="date" [(ngModel)]="selectedDate" />
        </mat-form-field>

        <mat-form-field class="bad__field bad__field--time">
          <mat-label>Start Time</mat-label>
          <mat-select [(ngModel)]="selectedTimeSlot">
            @for (s of timeSlots; track s.label) {
              <mat-option [value]="s">{{ s.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="bad__field bad__field--dur">
          <mat-label>Duration (min)</mat-label>
          <input matInput type="number" [(ngModel)]="duration" min="5" max="240" step="5" />
        </mat-form-field>
      </div>

      <!-- End time preview -->
      <p class="bad__end-time">
        End time: <strong>{{ endTimeLabel() }}</strong>
      </p>

      <!-- Reason -->
      <mat-form-field class="bad__field">
        <mat-label>Reason for visit</mat-label>
        <textarea matInput [(ngModel)]="reasonForVisit" rows="2" placeholder="Optional…"></textarea>
      </mat-form-field>

      @if (error()) {
        <div class="bad__error"><mat-icon>error_outline</mat-icon> {{ error() }}</div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Cancel</button>
      <button mat-flat-button [disabled]="!canBook() || saving()" (click)="book()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Book }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .bad__field { width: 100%; margin-bottom: 4px; }
    .bad__row { display: flex; gap: 12px; align-items: flex-start; }
    .bad__field--date { flex: 2; }
    .bad__field--time { flex: 2; }
    .bad__field--dur  { flex: 1; }
    .bad__end-time { font-size: .8125rem; color: var(--mat-sys-on-surface-variant,#6b7280); margin: -8px 0 12px; }
    .bad__error {
      display: flex; align-items: center; gap: 6px;
      background: #fef2f2; color: #dc2626; border-radius: 6px;
      padding: 8px 12px; font-size: .875rem; margin-top: 4px;
    }
  `],
})
export class BookAppointmentDialog {
  private readonly dialogRef = inject(MatDialogRef<BookAppointmentDialog>);
  private readonly data = inject<BookDialogData>(MAT_DIALOG_DATA);
  protected readonly store = inject(SchedulingStore);
  private readonly patientApi = inject(PatientApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly timeSlots = TIME_SLOTS;
  protected readonly providers = computed<Provider[]>(() => this.store.providers());
  protected readonly appointmentTypes = computed<AppointmentType[]>(() => this.store.appointmentTypes());

  protected readonly patientSearch = signal('');
  protected readonly patientResults = signal<Patient[]>([]);
  protected readonly searchingPatients = signal(false);
  protected readonly selectedPatient = signal<Patient | null>(null);

  protected selectedProviderId = '';
  protected selectedTypeId = '';
  protected duration = 30;
  protected reasonForVisit = '';
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  private readonly searchSubject = new Subject<string>();

  protected readonly selectedDate: string;
  protected selectedTimeSlot = TIME_SLOTS[4]; // 9:00 AM default

  protected readonly endTimeLabel = computed(() => {
    if (!this.selectedTimeSlot) return '—';
    const totalMin = this.selectedTimeSlot.hour * 60 + this.selectedTimeSlot.minute + this.duration;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const normalizedH = h === 0 ? 12 : h;
    const displayH = h > 12 ? h - 12 : normalizedH;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  });

  protected readonly canBook = computed(() =>
    !!this.selectedPatient() && !!this.selectedProviderId && !!this.selectedTypeId && !!this.selectedDate
  );

  constructor() {
    const d = this.data?.prefilledDate ?? new Date();
    this.selectedDate = d.toISOString().slice(0, 10);

    const h = this.data?.prefilledHour ?? 9;
    const m = this.data?.prefilledMinute ?? 0;
    this.selectedTimeSlot = TIME_SLOTS.find(s => s.hour === h && s.minute === m) ?? TIME_SLOTS[4];

    if (this.data?.prefilledPatient) {
      const p = this.data.prefilledPatient;
      this.selectedPatient.set(p);
      this.patientSearch.set(`${p.firstName} ${p.lastName}`);
    }

    // Auto-fill first provider and type
    const providers = this.providers();
    if (providers.length) this.selectedProviderId = providers[0].id;
    const types = this.appointmentTypes();
    if (types.length) {
      this.selectedTypeId = types[0].id;
      this.duration = types[0].defaultDurationMinutes;
    }

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.searchingPatients.set(true);
        return this.patientApi.search({ query: q, limit: 8 });
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: result => {
        this.patientResults.set(result.patients);
        this.searchingPatients.set(false);
      },
      error: () => this.searchingPatients.set(false),
    });
  }

  protected onPatientInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.patientSearch.set(val);
    if (val.length >= 2) {
      this.searchSubject.next(val);
    } else {
      this.patientResults.set([]);
    }
    if (this.selectedPatient()) this.selectedPatient.set(null);
  }

  protected onPatientSelected(patient: Patient): void {
    this.selectedPatient.set(patient);
    this.patientSearch.set(`${patient.firstName} ${patient.lastName}`);
    this.patientResults.set([]);
  }

  protected onTypeChange(typeId: string): void {
    const type = this.store.appointmentTypes().find(t => t.id === typeId);
    if (type) this.duration = type.defaultDurationMinutes;
  }

  protected book(): void {
    const patient = this.selectedPatient();
    if (!patient || !this.selectedProviderId || !this.selectedTypeId || !this.selectedDate) return;

    const [year, month, day] = this.selectedDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, this.selectedTimeSlot.hour, this.selectedTimeSlot.minute);
    const endDate = new Date(startDate.getTime() + this.duration * 60000);

    const dto: BookAppointmentDto = {
      patientId: patient.id,
      providerId: this.selectedProviderId,
      appointmentTypeId: this.selectedTypeId as unknown as AppointmentTypeId,
      slotStart: startDate.toISOString(),
      slotEnd: endDate.toISOString(),
      reasonForVisit: this.reasonForVisit || undefined,
    };

    this.saving.set(true);
    this.error.set(null);
    this.store.book(dto);

    // Close after a short delay (store handles the actual booking)
    // Listen to store loading state to detect completion
    const checkDone = setInterval(() => {
      if (!this.store.loading()) {
        clearInterval(checkDone);
        this.saving.set(false);
        if (this.store.error()) {
          this.error.set(this.store.error());
        } else {
          this.dialogRef.close(true);
        }
      }
    }, 100);
  }
}
