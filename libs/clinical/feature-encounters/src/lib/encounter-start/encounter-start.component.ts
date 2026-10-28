import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import type { EncounterTemplate, TemplateId } from '@clinova/clinical/domain';
import { ClinicalApiService } from '@clinova/clinical/data-access';
import type { Patient, PatientId } from '@clinova/patient/domain';
import { PatientApiService } from '@clinova/patient/data-access';
import { Permissions } from '@clinova/auth';
import { errorMessage } from '../error-message';

/**
 * `/encounters/new?appointmentId=…&patientId=…` — begins the encounter for a checked-in
 * appointment immediately. Walk-ins (no appointment) pick the patient if needed, then the
 * provider and an optional template.
 */
@Component({
  selector: 'clv-encounter-start',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterModule, MatAutocompleteModule, MatButtonModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule,
  ],
  template: `
    <div class="start">
      @if (error()) {
        <div class="start__card start__card--error" role="alert">
          <mat-icon>error_outline</mat-icon>
          <h1>Couldn't begin the encounter</h1>
          <p>{{ error() }}</p>
          <a mat-stroked-button [routerLink]="backLink()">Go back</a>
        </div>
      } @else if (appointmentId() || starting()) {
        <div class="start__card start__card--center">
          <mat-spinner diameter="36" />
          <p>Opening encounter…</p>
        </div>
      } @else if (patientId() && !patient()) {
        <div class="start__card start__card--center"><mat-spinner diameter="36" /></div>
      } @else {
        <div class="start__card">
          <h1>New encounter</h1>

          @if (patient(); as p) {
            <p class="start__patient">
              {{ p.firstName }} {{ p.lastName }} · {{ p.mrn }}
              @if (!patientId()) {
                <button mat-button type="button" (click)="patient.set(null)">Change</button>
              }
            </p>
          } @else {
            <mat-form-field appearance="outline">
              <mat-label>Patient</mat-label>
              <mat-icon matPrefix>search</mat-icon>
              <input matInput [formControl]="patientQuery" [matAutocomplete]="patientAuto"
                     placeholder="Name, MRN, or date of birth" />
              <mat-autocomplete #patientAuto="matAutocomplete" [displayWith]="displayPatient"
                                (optionSelected)="selectPatient($event)">
                @for (p of patientResults(); track p.id) {
                  <mat-option [value]="p">{{ p.firstName }} {{ p.lastName }} · {{ p.mrn }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          }

          @if (!isPhysician()) {
            <mat-form-field appearance="outline">
              <mat-label>Provider</mat-label>
              <mat-select [formControl]="providerId" required>
                @for (pr of providers(); track pr.id) {
                  <mat-option [value]="pr.id">Dr. {{ pr.firstName }} {{ pr.lastName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }

          <mat-form-field appearance="outline">
            <mat-label>Template (optional)</mat-label>
            <mat-select [formControl]="templateId">
              <mat-option [value]="null">Blank note</mat-option>
              @for (t of templates(); track t.id) {
                <mat-option [value]="t.id">{{ t.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="start__actions">
            <a mat-button [routerLink]="backLink()">Cancel</a>
            <button mat-flat-button color="primary" type="button" (click)="begin()"
                    [disabled]="!patient() || (!isPhysician() && !providerId.value)">
              <mat-icon>play_arrow</mat-icon> Begin encounter
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .start { display: flex; justify-content: center; padding: 48px 24px; }
    .start__card {
      display: flex; flex-direction: column; align-items: stretch; gap: 12px;
      width: min(480px, 100%); padding: 32px; background: #fff;
      border: 1px solid var(--clv-gray-200); border-radius: 12px;
    }
    .start__card--center { align-items: center; }
    .start__card--error { align-items: center; text-align: center; }
    .start__card--error mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--clv-danger-text); }
    h1 { margin: 0; font-size: 1.25rem; }
    .start__patient { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; color: var(--clv-gray-700); }
    .start__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `,
})
export class EncounterStartComponent {
  private readonly api = inject(ClinicalApiService);
  private readonly patientApi = inject(PatientApiService);
  private readonly perms = inject(Permissions);
  private readonly router = inject(Router);

  readonly appointmentId = input<string>();
  readonly patientId = input<string>();

  protected readonly patient = signal<Patient | null>(null);
  protected readonly patientResults = signal<Patient[]>([]);
  protected readonly templates = signal<EncounterTemplate[]>([]);
  protected readonly providers = signal<Array<{ id: string; firstName: string; lastName: string }>>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly starting = signal(false);

  protected readonly patientQuery = new FormControl<string | Patient>('', { nonNullable: true });
  protected readonly providerId = new FormControl<string | null>(null);
  protected readonly templateId = new FormControl<TemplateId | null>(null);

  protected readonly isPhysician = this.perms.isProvider;
  protected readonly backLink = computed(() =>
    this.patientId() ? ['/patients', this.patientId(), 'notes'] : ['/encounters']);

  constructor() {
    effect(() => {
      const patientId = this.patientId();
      const appointmentId = this.appointmentId();
      untracked(() => {
        if (appointmentId && patientId) {
          this.start({ patientId, appointmentId });
        } else if (appointmentId) {
          this.error.set('The appointment link is missing the patient.');
        } else if (patientId) {
          this.patientApi.findById(patientId as PatientId).subscribe({
            next: p => this.patient.set(p),
            error: err => this.error.set(errorMessage(err, 'Patient not found.')),
          });
        }
      });
    });

    effect(() => {
      if (this.appointmentId()) return;
      untracked(() => {
        this.api.getTemplates().pipe(catchError(() => of([]))).subscribe(t => this.templates.set(t));
        if (!this.isPhysician()) {
          this.api.getProviders().pipe(catchError(() => of([]))).subscribe(p => this.providers.set(p));
        }
      });
    });

    this.patientQuery.valueChanges.pipe(
      map(q => (typeof q === 'string' ? q.trim() : '')),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => (q.length >= 2
        ? this.patientApi.search({ query: q, limit: 10 }).pipe(map(r => r.patients), catchError(() => of([])))
        : of([]))),
      takeUntilDestroyed(),
    ).subscribe(results => this.patientResults.set(results));
  }

  protected displayPatient(p: Patient | string | null): string {
    return !p ? '' : typeof p === 'string' ? p : `${p.firstName} ${p.lastName}`;
  }

  protected selectPatient(event: MatAutocompleteSelectedEvent): void {
    this.patient.set(event.option.value as Patient);
    this.patientQuery.setValue('');
  }

  protected begin(): void {
    const patient = this.patient();
    if (!patient) return;
    this.start({
      patientId: patient.id,
      providerId: this.providerId.value ?? undefined,
      templateId: this.templateId.value ?? undefined,
    });
  }

  private start(dto: { patientId: string; appointmentId?: string; providerId?: string; templateId?: TemplateId }): void {
    this.starting.set(true);
    this.api.start(dto).subscribe({
      next: enc => this.router.navigate(['/encounters', enc.id], { replaceUrl: true }),
      error: err => {
        this.starting.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
