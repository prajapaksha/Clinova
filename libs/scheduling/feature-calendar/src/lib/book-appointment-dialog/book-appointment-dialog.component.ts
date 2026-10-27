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
  templateUrl: './book-appointment-dialog.component.html',
  styleUrl: './book-appointment-dialog.component.scss',
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
