import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import type { Patient } from '@clinova/patient/domain';
import { PatientApiService } from '@clinova/patient/data-access';

export interface PatientPickerData {
  title: string;
  action: string;
}

/** Search-and-pick a patient; closes with the selected Patient. */
@Component({
  selector: 'clv-patient-picker-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Patient</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [formControl]="query" [matAutocomplete]="auto" placeholder="Name or MRN" cdkFocusInitial />
        <mat-autocomplete #auto="matAutocomplete" [displayWith]="display" (optionSelected)="pick($event)">
          @for (p of results(); track p.id) {
            <mat-option [value]="p">{{ p.firstName }} {{ p.lastName }} · {{ p.mrn }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="!selected()" (click)="confirm()">{{ data.action }}</button>
    </mat-dialog-actions>
  `,
  styles: `.full { width: 100%; }`,
})
export class PatientPickerDialog {
  protected readonly data = inject<PatientPickerData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PatientPickerDialog, Patient>);
  private readonly patients = inject(PatientApiService);

  protected readonly query = new FormControl<string | Patient>('', { nonNullable: true });
  protected readonly results = signal<Patient[]>([]);
  protected readonly selected = signal<Patient | null>(null);

  constructor() {
    this.query.valueChanges.pipe(
      map(q => (typeof q === 'string' ? q.trim() : '')),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => (q.length >= 2 ? this.patients.search({ query: q, limit: 10 }).pipe(map(r => r.patients), catchError(() => of([]))) : of([]))),
      takeUntilDestroyed(),
    ).subscribe(r => this.results.set(r));
  }

  protected display(p: Patient | string | null): string {
    return !p ? '' : typeof p === 'string' ? p : `${p.firstName} ${p.lastName}`;
  }

  protected pick(e: MatAutocompleteSelectedEvent): void {
    this.selected.set(e.option.value as Patient);
  }

  protected confirm(): void {
    this.ref.close(this.selected() ?? undefined);
  }
}
