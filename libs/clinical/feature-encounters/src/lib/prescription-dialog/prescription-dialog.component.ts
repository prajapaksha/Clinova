import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import type { DrugCatalogEntry, EncounterId, PrescriptionSafetyCheck } from '@clinova/clinical/domain';
import { ClinicalApiService } from '@clinova/clinical/data-access';
import { errorMessage } from '../error-message';

export interface PrescriptionDialogData {
  encounterId: EncounterId;
  patientId: string;
  patientName: string;
}

export const FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 4-6 hours as needed',
  'Every 8 hours',
  'At bedtime',
  'Once weekly',
  'As needed',
];

@Component({
  selector: 'clv-prescription-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatAutocompleteModule, MatButtonModule, MatCheckboxModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule,
  ],
  templateUrl: './prescription-dialog.component.html',
  styleUrl: './prescription-dialog.component.scss',
})
export class PrescriptionDialog {
  protected readonly data = inject<PrescriptionDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(ClinicalApiService);
  private readonly dialogRef = inject(MatDialogRef<PrescriptionDialog>);

  protected readonly frequencies = FREQUENCIES;
  protected readonly drugResults = signal<DrugCatalogEntry[]>([]);
  protected readonly safety = signal<PrescriptionSafetyCheck | null>(null);
  protected readonly checking = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly drugQuery = new FormControl<string | DrugCatalogEntry>('', { nonNullable: true });
  protected readonly form = new FormGroup({
    medicationName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    strength: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    form: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    route: new FormControl('Oral', { nonNullable: true, validators: [Validators.required] }),
    dosageAmount: new FormControl('1 tablet', { nonNullable: true, validators: [Validators.required] }),
    frequency: new FormControl('Once daily', { nonNullable: true, validators: [Validators.required] }),
    durationDays: new FormControl<number | null>(null, [Validators.min(1), Validators.max(365)]),
    refillsAllowed: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(11)] }),
    instructions: new FormControl('', { nonNullable: true }),
  });
  protected readonly acknowledged = new FormControl(false, { nonNullable: true });

  protected readonly hasAlerts = computed(() => {
    const s = this.safety();
    return !!s && (s.allergyAlerts.length > 0 || s.interactionAlerts.length > 0);
  });

  constructor() {
    this.drugQuery.valueChanges.pipe(
      map(q => (typeof q === 'string' ? q.trim() : '')),
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => (q.length >= 2 ? this.api.searchDrugs(q).pipe(catchError(() => of([]))) : of([]))),
      takeUntilDestroyed(),
    ).subscribe(results => this.drugResults.set(results));

    // Re-run safety checks whenever the medication name settles.
    this.form.controls.medicationName.valueChanges.pipe(
      map(name => name.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(name => {
        this.acknowledged.setValue(false);
        if (!name) return of(null);
        this.checking.set(true);
        return this.api.checkPrescription(this.data.patientId, name).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(),
    ).subscribe(result => {
      this.safety.set(result);
      this.checking.set(false);
    });
  }

  protected displayDrug(value: string | DrugCatalogEntry | null): string {
    if (!value) return '';
    return typeof value === 'string' ? value : `${value.name} ${value.strength}`;
  }

  protected selectDrug(event: MatAutocompleteSelectedEvent): void {
    const drug = event.option.value as DrugCatalogEntry;
    this.form.patchValue({
      medicationName: drug.name,
      strength: drug.strength,
      form: drug.form,
      route: drug.route,
      dosageAmount: defaultDose(drug.form),
    });
  }

  /** Lets the prescriber use a medication that is not in the catalog. */
  protected useTypedName(): void {
    const typed = this.drugQuery.value;
    if (typeof typed === 'string' && typed.trim() && !this.form.controls.medicationName.value) {
      this.form.controls.medicationName.setValue(typed.trim());
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.hasAlerts() && !this.acknowledged.value) {
      this.error.set('Review and acknowledge the safety alerts before prescribing.');
      return;
    }

    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.api.issuePrescription(this.data.encounterId, {
      drug: {
        medicationName: v.medicationName,
        strength: v.strength,
        form: v.form,
        route: v.route,
        dosageAmount: v.dosageAmount,
        frequency: v.frequency,
        durationDays: v.durationDays || null,
      },
      refillsAllowed: v.refillsAllowed,
      instructions: v.instructions.trim() || undefined,
      acknowledgeWarnings: this.acknowledged.value,
    }).subscribe({
      next: rx => this.dialogRef.close(rx),
      error: (err: unknown) => {
        this.submitting.set(false);
        if (err instanceof HttpErrorResponse && err.status === 409 && err.error?.allergyAlerts) {
          this.safety.set({ allergyAlerts: err.error.allergyAlerts, interactionAlerts: err.error.interactionAlerts });
        }
        this.error.set(errorMessage(err));
      },
    });
  }
}

function defaultDose(form: string): string {
  const f = form.toLowerCase();
  if (f.includes('inhaler')) return '2 puffs';
  if (f.includes('spray')) return '1 spray each nostril';
  if (f.includes('cream') || f.includes('ointment')) return 'Apply thin layer';
  if (f.includes('injection')) return 'As directed';
  if (f.includes('capsule')) return '1 capsule';
  return '1 tablet';
}
