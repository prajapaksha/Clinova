import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import type { FeeScheduleLine } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import type { Patient, PatientId } from '@clinova/patient/domain';
import { PatientApiService } from '@clinova/patient/data-access';
import { CentsPipe } from '../shared/cents.pipe';
import { errorMessage } from '../shared/billing-shared';

const line = () => new FormGroup({
  serviceCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
});

/** Manual draft invoice (services not tied to an encounter). */
@Component({
  selector: 'clv-invoice-new',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterModule, MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSelectModule, CentsPipe,
  ],
  template: `
    <div class="ni">
      <a routerLink="/billing/invoices" class="ni__back"><mat-icon>arrow_back</mat-icon> Invoices</a>
      <h1 class="ni__title">New invoice</h1>
      <form class="ni__card" [formGroup]="form" (ngSubmit)="create()">
        @if (patient(); as p) {
          <p class="ni__patient"><mat-icon>person</mat-icon> {{ p.firstName }} {{ p.lastName }} · {{ p.mrn }}
            @if (!patientId()) { <button mat-button type="button" (click)="patient.set(null)">Change</button> }</p>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>Patient</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input matInput [formControl]="patientQuery" [matAutocomplete]="auto" placeholder="Name or MRN" />
            <mat-autocomplete #auto="matAutocomplete" [displayWith]="display" (optionSelected)="pick($event)">
              @for (p of patientResults(); track p.id) { <mat-option [value]="p">{{ p.firstName }} {{ p.lastName }} · {{ p.mrn }}</mat-option> }
            </mat-autocomplete>
          </mat-form-field>
        }
        <div class="ni__row">
          <mat-form-field appearance="outline">
            <mat-label>Provider</mat-label>
            <mat-select formControlName="providerId">
              @for (pr of providers(); track pr.id) { <mat-option [value]="pr.id">Dr. {{ pr.firstName }} {{ pr.lastName }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Service date</mat-label>
            <input matInput type="date" formControlName="serviceDate" />
          </mat-form-field>
        </div>

        <h2 class="ni__heading">Services</h2>
        @for (g of lines.controls; track g; let i = $index) {
          <div class="ni__line" [formGroup]="g">
            <mat-form-field appearance="outline" class="ni__code">
              <mat-label>Service</mat-label>
              <mat-select formControlName="serviceCode">
                @for (f of feeLines(); track f.cptCode) { <mat-option [value]="f.cptCode">{{ f.cptCode }} — {{ f.description }} ({{ f.priceCents | cents }})</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="ni__qty">
              <mat-label>Qty</mat-label>
              <input matInput type="number" min="1" formControlName="quantity" />
            </mat-form-field>
            <span class="ni__total">{{ lineTotal(i) | cents }}</span>
            <button mat-icon-button type="button" (click)="lines.removeAt(i)" [disabled]="lines.length === 1" [attr.aria-label]="'Remove service ' + (i + 1)"><mat-icon>delete_outline</mat-icon></button>
          </div>
        }
        <button mat-button type="button" (click)="lines.push(newLine())"><mat-icon>add</mat-icon> Add service</button>

        <mat-form-field appearance="outline" class="ni__notes">
          <mat-label>Notes (optional)</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>

        @if (error()) { <p class="ni__error" role="alert">{{ error() }}</p> }
        <div class="ni__actions">
          <span class="ni__sum">Total {{ total() | cents }}</span>
          <a mat-button routerLink="/billing/invoices">Cancel</a>
          <button mat-flat-button color="primary" type="submit" [disabled]="!patient() || busy()">Create draft</button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .ni { padding: 24px; max-width: 820px; }
    .ni__back { display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; color: var(--clv-primary-700); text-decoration: none; }
    .ni__title { margin: 6px 0 16px; font-size: 1.5rem; }
    .ni__card { display: flex; flex-direction: column; padding: 24px; background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; }
    .ni__patient { display: flex; align-items: center; gap: 6px; margin: 0 0 16px; font-weight: 600; }
    .ni__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .ni__heading { margin: 8px 0 12px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--clv-gray-600); }
    .ni__line { display: flex; align-items: center; gap: 12px; }
    .ni__code { flex: 1; }
    .ni__qty { width: 90px; }
    .ni__total { width: 90px; text-align: right; font-weight: 600; padding-bottom: 20px; }
    .ni__notes { margin-top: 16px; }
    .ni__error { color: var(--clv-danger-text); margin: 0 0 8px; }
    .ni__actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .ni__sum { margin-right: auto; font-weight: 700; }
  `,
})
export class InvoiceNewComponent {
  private readonly api = inject(BillingApiService);
  private readonly patients = inject(PatientApiService);
  private readonly router = inject(Router);

  /** Optional `?patientId=` to preselect the patient. */
  readonly patientId = input<string>();

  protected readonly patient = signal<Patient | null>(null);
  protected readonly patientResults = signal<Patient[]>([]);
  protected readonly providers = signal<Array<{ id: string; firstName: string; lastName: string }>>([]);
  protected readonly feeLines = signal<FeeScheduleLine[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly patientQuery = new FormControl<string | Patient>('', { nonNullable: true });
  protected readonly lines = new FormArray([line()]);
  protected readonly form = new FormGroup({
    providerId: new FormControl<string | null>(null, Validators.required),
    serviceDate: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    lines: this.lines,
  });
  protected readonly newLine = line;

  constructor() {
    this.api.getProviders().subscribe(p => {
      this.providers.set(p);
      if (!this.form.controls.providerId.value && p.length) this.form.controls.providerId.setValue(p[0].id);
    });
    this.api.getFeeSchedules().subscribe(s => this.feeLines.set((s.find(x => x.isDefault) ?? s[0])?.lines.slice() ?? []));

    effect(() => {
      const id = this.patientId();
      if (id) untracked(() => this.patients.findById(id as PatientId).subscribe(p => this.patient.set(p)));
    });

    this.patientQuery.valueChanges.pipe(
      map(q => (typeof q === 'string' ? q.trim() : '')),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => (q.length >= 2 ? this.patients.search({ query: q, limit: 10 }).pipe(map(r => r.patients), catchError(() => of([]))) : of([]))),
      takeUntilDestroyed(),
    ).subscribe(r => this.patientResults.set(r));
  }

  protected display(p: Patient | string | null): string {
    return !p ? '' : typeof p === 'string' ? p : `${p.firstName} ${p.lastName}`;
  }

  protected pick(e: MatAutocompleteSelectedEvent): void {
    this.patient.set(e.option.value as Patient);
  }

  protected lineTotal(i: number): number {
    const v = this.lines.at(i).getRawValue();
    return (this.feeLines().find(f => f.cptCode === v.serviceCode)?.priceCents ?? 0) * (v.quantity || 0);
  }

  protected total(): number {
    return this.lines.controls.reduce((sum, _, i) => sum + this.lineTotal(i), 0);
  }

  protected create(): void {
    const patient = this.patient();
    if (!patient || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.api.create({
      patientId: patient.id,
      providerId: v.providerId ?? undefined,
      serviceDate: new Date(`${v.serviceDate}T12:00:00`).toISOString(),
      lines: v.lines.map(l => ({ serviceCode: l.serviceCode, quantity: l.quantity })),
      notes: v.notes.trim() || undefined,
    }).subscribe({
      next: inv => this.router.navigate(['/billing/invoices', inv.id], { replaceUrl: true }),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
