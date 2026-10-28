import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { PatientApiService, PatientStore } from '@clinova/patient/data-access';
import { Permissions } from '@clinova/auth';
import type { Patient } from '@clinova/patient/domain';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'clv-edit-demographics-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
    MatProgressSpinnerModule, MatIconModule,
  ],
  templateUrl: './edit-demographics-dialog.component.html',
  styleUrl: './edit-demographics-dialog.component.scss',
})
export class EditDemographicsDialog {
  private readonly api = inject(PatientApiService);
  protected readonly store = inject(PatientStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<EditDemographicsDialog>);
  protected readonly patient = inject<Patient>(MAT_DIALOG_DATA);

  protected readonly titles = ['Dr', 'Mr', 'Mrs', 'Ms', 'Mx', 'Prof'];
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = new FormGroup({
    title:             new FormControl(this.patient.title ?? ''),
    firstName:         new FormControl(this.patient.firstName, { nonNullable: true, validators: [Validators.required] }),
    middleName:        new FormControl(this.patient.middleName ?? ''),
    lastName:          new FormControl(this.patient.lastName, { nonNullable: true, validators: [Validators.required] }),
    preferredName:     new FormControl(this.patient.preferredName ?? ''),
    pronouns:          new FormControl(this.patient.pronouns ?? ''),
    dateOfBirth:       new FormControl(this.toDateInput(this.patient.dateOfBirth), { nonNullable: true, validators: [Validators.required] }),
    sex:               new FormControl(this.patient.sex as string, { nonNullable: true, validators: [Validators.required] }),
    genderIdentity:    new FormControl(this.patient.genderIdentity ?? ''),
    maritalStatus:     new FormControl(this.patient.maritalStatus ?? ''),
    preferredLanguage: new FormControl(this.patient.preferredLanguage ?? 'English'),
    occupation:        new FormControl(this.patient.occupation ?? ''),
    ethnicity:         new FormControl(this.patient.ethnicity ?? ''),
    // Medical field: front desk and billing (limited access) can't change it.
    bloodType:         new FormControl({ value: this.patient.bloodType as string ?? 'UNKNOWN', disabled: !inject(Permissions).can('patient:profiles', 'full') }),
  });

  private toDateInput(date: Date | string): string {
    return new Date(date).toISOString().split('T')[0];
  }

  protected save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.saveError.set(null);

    this.api.update(this.patient.id, {
      title: v.title || undefined,
      firstName: v.firstName,
      middleName: v.middleName || null,
      lastName: v.lastName,
      preferredName: v.preferredName || null,
      pronouns: v.pronouns || null,
      dateOfBirth: v.dateOfBirth,
      sex: v.sex,
      genderIdentity: v.genderIdentity || null,
      maritalStatus: v.maritalStatus || null,
      preferredLanguage: v.preferredLanguage || 'English',
      occupation: v.occupation || null,
      ethnicity: v.ethnicity || null,
      bloodType: v.bloodType || 'UNKNOWN',
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.store.loadById(this.patient.id);
        this.dialogRef.close(true);
      },
      error: (e: Error) => {
        this.saveError.set(e.message ?? 'Failed to save. Please try again.');
        this.saving.set(false);
      },
    });
  }
}
