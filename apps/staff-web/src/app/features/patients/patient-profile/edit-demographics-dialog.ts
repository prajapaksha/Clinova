import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { PatientApiService, PatientStore } from '@clinova/patient/data-access';
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
  template: `
    <h2 mat-dialog-title>Edit Demographics</h2>

    <mat-dialog-content>
      @if (saveError()) {
        <div class="ed__error">
          <mat-icon>error</mat-icon>{{ saveError() }}
        </div>
      }

      <form [formGroup]="form" class="ed__form">
        <div class="ed__row">
          <mat-form-field appearance="outline" class="ed__field ed__field--xs">
            <mat-label>Title</mat-label>
            <mat-select formControlName="title">
              <mat-option value="">—</mat-option>
              @for (t of titles; track t) {
                <mat-option [value]="t">{{ t }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>First Name *</mat-label>
            <input matInput formControlName="firstName" />
            @if (form.get('firstName')?.invalid && form.get('firstName')?.touched) {
              <mat-error>Required</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field ed__field--xs">
            <mat-label>Middle Name</mat-label>
            <input matInput formControlName="middleName" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Last Name *</mat-label>
            <input matInput formControlName="lastName" />
            @if (form.get('lastName')?.invalid && form.get('lastName')?.touched) {
              <mat-error>Required</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="ed__row">
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Preferred Name / Nickname</mat-label>
            <input matInput formControlName="preferredName" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field ed__field--sm">
            <mat-label>Pronouns</mat-label>
            <input matInput formControlName="pronouns" placeholder="e.g. she/her" />
          </mat-form-field>
        </div>

        <div class="ed__row">
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Date of Birth *</mat-label>
            <input matInput type="date" formControlName="dateOfBirth" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Sex Assigned at Birth *</mat-label>
            <mat-select formControlName="sex">
              <mat-option value="MALE">Male</mat-option>
              <mat-option value="FEMALE">Female</mat-option>
              <mat-option value="INTERSEX">Intersex</mat-option>
              <mat-option value="UNKNOWN">Unknown</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Gender Identity</mat-label>
            <mat-select formControlName="genderIdentity">
              <mat-option value="">Prefer not to say</mat-option>
              <mat-option value="MAN">Man</mat-option>
              <mat-option value="WOMAN">Woman</mat-option>
              <mat-option value="NON_BINARY">Non-binary</mat-option>
              <mat-option value="TRANSGENDER_MAN">Transgender man</mat-option>
              <mat-option value="TRANSGENDER_WOMAN">Transgender woman</mat-option>
              <mat-option value="GENDER_FLUID">Gender fluid</mat-option>
              <mat-option value="OTHER">Other</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="ed__row">
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Marital Status</mat-label>
            <mat-select formControlName="maritalStatus">
              <mat-option value="">—</mat-option>
              <mat-option value="SINGLE">Single</mat-option>
              <mat-option value="MARRIED">Married</mat-option>
              <mat-option value="DIVORCED">Divorced</mat-option>
              <mat-option value="WIDOWED">Widowed</mat-option>
              <mat-option value="SEPARATED">Separated</mat-option>
              <mat-option value="DOMESTIC_PARTNER">Domestic Partner</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Preferred Language</mat-label>
            <input matInput formControlName="preferredLanguage" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Occupation</mat-label>
            <input matInput formControlName="occupation" />
          </mat-form-field>
        </div>

        <div class="ed__row">
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Ethnicity</mat-label>
            <input matInput formControlName="ethnicity" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="ed__field">
            <mat-label>Blood Type</mat-label>
            <mat-select formControlName="bloodType">
              <mat-option value="UNKNOWN">Unknown</mat-option>
              <mat-option value="A_POSITIVE">A+</mat-option>
              <mat-option value="A_NEGATIVE">A−</mat-option>
              <mat-option value="B_POSITIVE">B+</mat-option>
              <mat-option value="B_NEGATIVE">B−</mat-option>
              <mat-option value="AB_POSITIVE">AB+</mat-option>
              <mat-option value="AB_NEGATIVE">AB−</mat-option>
              <mat-option value="O_POSITIVE">O+</mat-option>
              <mat-option value="O_NEGATIVE">O−</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false" [disabled]="saving()">Cancel</button>
      <button mat-flat-button [disabled]="form.invalid || saving()" (click)="save()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Save Changes }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .ed {
      &__error {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; background: #fef2f2; border-radius: 6px;
        color: #dc2626; margin-bottom: 12px; font-size: 0.875rem;
      }
      &__form {
        display: flex; flex-direction: column; gap: 4px;
        padding-top: 8px; min-width: min(600px, 88vw);
      }
      &__row { display: flex; gap: 12px; flex-wrap: wrap; }
      &__field { flex: 1; min-width: 140px; }
      &__field--sm { flex: 0 0 140px; }
      &__field--xs { flex: 0 0 100px; }
    }
  `],
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
    bloodType:         new FormControl(this.patient.bloodType as string ?? 'UNKNOWN'),
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
