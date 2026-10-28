import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { FeeSchedule } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import { BillingPermissions, centsFromDollars, errorMessage } from '../shared/billing-shared';

const row = (l?: { cptCode: string; description: string; priceCents: number }) => new FormGroup({
  cptCode: new FormControl(l?.cptCode ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
  description: new FormControl(l?.description ?? '', { nonNullable: true, validators: [Validators.required] }),
  price: new FormControl<number | null>(l ? l.priceCents / 100 : null, [Validators.required, Validators.min(0)]),
});

/** PRD §4.5 Fee Schedule Editor — admin only (read-only for billing staff). */
@Component({
  selector: 'clv-fee-schedules',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule],
  template: `
    <div class="fs">
      <header class="fs__header">
        <div>
          <h1 class="fs__title">Fee schedules</h1>
          <p class="fs__sub">Prices per service code. The default schedule prices new invoices.
            @if (!perms.canEditFeeSchedules()) { <strong>Read-only — only practice administrators can edit.</strong> }</p>
        </div>
        @if (perms.canEditFeeSchedules()) {
          <button mat-stroked-button type="button" (click)="startNew()"><mat-icon>add</mat-icon> New schedule</button>
        }
      </header>

      <div class="fs__layout">
        <nav class="fs__list" aria-label="Fee schedules">
          @for (s of schedules(); track s.id) {
            <button type="button" class="fs__item" [class.fs__item--active]="selectedId() === s.id" (click)="select(s)">
              <strong>{{ s.name }}</strong>
              <small>{{ s.lines.length }} codes@if (s.isDefault) { · default }@if (!s.isActive) { · inactive }</small>
            </button>
          }
          @if (selectedId() === null && editing()) { <div class="fs__item fs__item--active"><strong>New schedule</strong></div> }
        </nav>

        @if (editing()) {
          <form class="fs__editor" [formGroup]="form" (ngSubmit)="save()">
            <div class="fs__meta">
              <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput formControlName="name" /></mat-form-field>
              <mat-form-field appearance="outline" class="fs__desc"><mat-label>Description</mat-label><input matInput formControlName="description" /></mat-form-field>
              <mat-slide-toggle formControlName="isDefault">Default</mat-slide-toggle>
              <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
            </div>
            <table class="fs__table">
              <thead><tr><th>Code</th><th>Description</th><th class="num">Price</th>@if (canEdit()) { <th></th> }</tr></thead>
              <tbody>
                @for (g of lines.controls; track g; let i = $index) {
                  <tr [formGroup]="g">
                    <td><input class="cell cell--code" formControlName="cptCode" aria-label="Code" /></td>
                    <td><input class="cell" formControlName="description" aria-label="Description" /></td>
                    <td class="num">$ <input class="cell cell--num" type="number" min="0" step="0.01" formControlName="price" aria-label="Price" /></td>
                    @if (canEdit()) { <td><button mat-icon-button type="button" (click)="lines.removeAt(i)" [attr.aria-label]="'Remove ' + g.controls.cptCode.value"><mat-icon>delete_outline</mat-icon></button></td> }
                  </tr>
                }
              </tbody>
            </table>
            @if (canEdit()) {
              <div class="fs__actions">
                <button mat-button type="button" (click)="lines.push(newRow())"><mat-icon>add</mat-icon> Add code</button>
                <span class="fs__spacer"></span>
                @if (error()) { <span class="fs__error" role="alert">{{ error() }}</span> }
                <button mat-flat-button color="primary" type="submit" [disabled]="busy() || form.pristine">Save schedule</button>
              </div>
            }
          </form>
        }
      </div>
    </div>
  `,
  styles: `
    .fs { padding: 24px; }
    .fs__header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .fs__title { margin: 0; font-size: 1.5rem; }
    .fs__sub { margin: 4px 0 0; color: var(--clv-gray-600); font-size: 0.9rem; }
    .fs__layout { display: grid; grid-template-columns: 240px 1fr; gap: 16px; margin-top: 20px; align-items: start; }
    .fs__list { display: flex; flex-direction: column; gap: 6px; }
    .fs__item { display: flex; flex-direction: column; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--clv-gray-200); border-radius: 8px; background: #fff; font: inherit; cursor: pointer; text-align: left; }
    .fs__item small { color: var(--clv-gray-600); }
    .fs__item--active { border-color: var(--clv-primary-300); background: var(--clv-primary-50); }
    .fs__editor { padding: 20px; background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; }
    .fs__meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .fs__desc { flex: 1; min-width: 240px; }
    .fs__table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .fs__table th { padding: 8px; text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--clv-gray-600); border-bottom: 1px solid var(--clv-gray-200); }
    .fs__table td { padding: 4px 8px; border-bottom: 1px solid var(--clv-gray-100); }
    .num { text-align: right; white-space: nowrap; }
    .cell { width: 100%; padding: 6px 8px; border: 1px solid var(--clv-gray-300); border-radius: 6px; font: inherit; }
    .cell:disabled { border-color: transparent; background: transparent; color: inherit; }
    .cell--code { width: 90px; font-family: 'Roboto Mono', ui-monospace, monospace; }
    .cell--num { width: 90px; text-align: right; }
    .fs__actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
    .fs__spacer { flex: 1; }
    .fs__error { color: var(--clv-danger-text); font-size: 0.85rem; }
  `,
})
export class FeeSchedulesComponent {
  private readonly api = inject(BillingApiService);
  private readonly snack = inject(MatSnackBar);
  protected readonly perms = inject(BillingPermissions);

  protected readonly schedules = signal<FeeSchedule[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canEdit = computed(() => this.perms.canEditFeeSchedules());

  protected readonly lines = new FormArray<ReturnType<typeof row>>([]);
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    isDefault: new FormControl(false, { nonNullable: true }),
    isActive: new FormControl(true, { nonNullable: true }),
    lines: this.lines,
  });
  protected readonly newRow = row;

  constructor() {
    this.load();
  }

  protected select(s: FeeSchedule): void {
    this.selectedId.set(s.id);
    this.editing.set(true);
    this.error.set(null);
    this.lines.clear();
    s.lines.forEach(l => this.lines.push(row(l)));
    this.form.patchValue({ name: s.name, description: s.description ?? '', isDefault: s.isDefault, isActive: s.isActive });
    this.form.markAsPristine();
    if (this.canEdit()) this.form.enable(); else this.form.disable();
  }

  protected startNew(): void {
    this.selectedId.set(null);
    this.editing.set(true);
    this.lines.clear();
    this.lines.push(row());
    this.form.reset({ name: '', description: '', isDefault: false, isActive: true });
    this.form.enable();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Fill in every code, description, and price.');
      return;
    }
    const v = this.form.getRawValue();
    const dto = {
      name: v.name.trim(),
      description: v.description.trim() || undefined,
      isDefault: v.isDefault,
      isActive: v.isActive,
      lines: v.lines.map(l => ({ cptCode: l.cptCode.trim(), description: l.description.trim(), priceCents: centsFromDollars(l.price) })),
    };
    const id = this.selectedId();
    this.busy.set(true);
    (id ? this.api.updateFeeSchedule(id as FeeSchedule['id'], dto) : this.api.createFeeSchedule(dto)).subscribe({
      next: saved => {
        this.busy.set(false);
        this.snack.open('Fee schedule saved.', undefined, { duration: 3000 });
        this.load(saved.id);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  private load(selectId?: string): void {
    this.api.getFeeSchedules(false).subscribe(list => {
      this.schedules.set(list);
      const target = list.find(s => s.id === (selectId ?? this.selectedId())) ?? list[0];
      if (target) this.select(target);
    });
  }
}
