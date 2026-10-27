import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { PatientApiService, PatientStore } from '@clinova/patient/data-access';
import type { PatientId } from '@clinova/patient/domain';
import { AllergyType, AlertSeverity } from '@clinova/patient/domain';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'clv-add-allergy-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
    MatProgressSpinnerModule, MatIconModule,
  ],
  templateUrl: './add-allergy-dialog.component.html',
  styleUrl: './add-allergy-dialog.component.scss',
})
export class AddAllergyDialog {
  private readonly api = inject(PatientApiService);
  private readonly store = inject(PatientStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<AddAllergyDialog>);
  private readonly patientId = inject<PatientId>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    allergen:  new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type:      new FormControl(AllergyType.Drug, { nonNullable: true }),
    reaction:  new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    severity:  new FormControl(AlertSeverity.Medium, { nonNullable: true }),
    onsetDate: new FormControl(''),
    notes:     new FormControl(''),
  });

  protected save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.saveError.set(null);

    this.api.addAllergy(this.patientId, {
      type: v.type as AllergyType,
      allergen: v.allergen,
      reaction: v.reaction,
      severity: v.severity as AlertSeverity,
      onsetDate: v.onsetDate ? new Date(v.onsetDate) : null,
      notes: v.notes || null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.store.loadById(this.patientId);
        this.dialogRef.close(true);
      },
      error: (e: Error) => {
        this.saveError.set(e.message ?? 'Failed to add allergy. Please try again.');
        this.saving.set(false);
      },
    });
  }
}
