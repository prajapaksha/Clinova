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
  template: `
    <h2 mat-dialog-title>Add Allergy</h2>

    <mat-dialog-content>
      @if (saveError()) {
        <div class="aa__error">
          <mat-icon>error</mat-icon>{{ saveError() }}
        </div>
      }

      <form [formGroup]="form" class="aa__form">
        <div class="aa__row">
          <mat-form-field appearance="outline" class="aa__field">
            <mat-label>Allergen *</mat-label>
            <input matInput formControlName="allergen" placeholder="e.g. Penicillin, Peanuts" />
            @if (form.get('allergen')?.invalid && form.get('allergen')?.touched) {
              <mat-error>Allergen name is required</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="aa__field aa__field--sm">
            <mat-label>Type *</mat-label>
            <mat-select formControlName="type">
              <mat-option value="DRUG">Drug</mat-option>
              <mat-option value="FOOD">Food</mat-option>
              <mat-option value="ENVIRONMENTAL">Environmental</mat-option>
              <mat-option value="LATEX">Latex</mat-option>
              <mat-option value="OTHER">Other</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="aa__row">
          <mat-form-field appearance="outline" class="aa__field">
            <mat-label>Reaction *</mat-label>
            <input matInput formControlName="reaction" placeholder="e.g. Rash, Anaphylaxis, Hives" />
            @if (form.get('reaction')?.invalid && form.get('reaction')?.touched) {
              <mat-error>Reaction description is required</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="aa__field aa__field--sm">
            <mat-label>Severity *</mat-label>
            <mat-select formControlName="severity">
              <mat-option value="CRITICAL">Critical</mat-option>
              <mat-option value="HIGH">High</mat-option>
              <mat-option value="MEDIUM">Medium</mat-option>
              <mat-option value="LOW">Low</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="aa__row">
          <mat-form-field appearance="outline" class="aa__field aa__field--sm">
            <mat-label>Onset Date</mat-label>
            <input matInput type="date" formControlName="onsetDate" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="aa__field">
            <mat-label>Notes</mat-label>
            <textarea matInput formControlName="notes" rows="2"
                      placeholder="Additional details or context"></textarea>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false" [disabled]="saving()">Cancel</button>
      <button mat-flat-button [disabled]="form.invalid || saving()" (click)="save()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Add Allergy }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .aa {
      &__error {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; background: #fef2f2; border-radius: 6px;
        color: #dc2626; margin-bottom: 12px; font-size: 0.875rem;
      }
      &__form {
        display: flex; flex-direction: column; gap: 4px;
        padding-top: 8px; min-width: min(500px, 88vw);
      }
      &__row { display: flex; gap: 12px; flex-wrap: wrap; }
      &__field { flex: 1; min-width: 160px; }
      &__field--sm { flex: 0 0 160px; }
    }
  `],
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
