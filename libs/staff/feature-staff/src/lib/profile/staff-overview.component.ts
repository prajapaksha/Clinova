import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { StaffApiService } from '@clinova/staff/data-access';
import type { StaffProfile } from '@clinova/staff/domain';
import { errorMessage } from '../shared/staff-shared';

@Component({
  selector: 'clv-staff-overview',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    @if (!editing()) {
      <section class="ov">
        <dl class="ov__grid">
          <div><dt>Email</dt><dd>{{ profile().email }}</dd></div>
          <div><dt>Phone</dt><dd>{{ profile().phone || '—' }}</dd></div>
          <div><dt>Office</dt><dd>{{ profile().officeLocation || '—' }}</dd></div>
          <div><dt>NPI</dt><dd>{{ profile().npi || '—' }}</dd></div>
          <div class="ov__wide"><dt>Specialties</dt>
            <dd>
              @for (s of profile().specialties; track s) { <span class="ov__chip">{{ s }}</span> } @empty { — }
            </dd>
          </div>
          <div class="ov__wide"><dt>Bio</dt><dd class="ov__bio">{{ profile().bio || 'No bio yet.' }}</dd></div>
        </dl>
        @if (canEdit()) {
          <button mat-stroked-button type="button" (click)="startEdit()"><mat-icon>edit</mat-icon> Edit profile</button>
        }
      </section>
    } @else {
      <form class="ov__form" [formGroup]="form" (ngSubmit)="save()">
        <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title" placeholder="Dr." /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>First name</mat-label><input matInput formControlName="firstName" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Last name</mat-label><input matInput formControlName="lastName" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Suffix</mat-label><input matInput formControlName="suffix" placeholder="MD" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Office location</mat-label><input matInput formControlName="officeLocation" /></mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>NPI</mat-label><input matInput formControlName="npi" inputmode="numeric" />
          @if (form.controls.npi.invalid) { <mat-error>NPI must be 10 digits</mat-error> }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Specialties</mat-label><input matInput formControlName="specialties" />
          <mat-hint>Separate with commas</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" class="ov__wide"><mat-label>Bio</mat-label><textarea matInput rows="4" formControlName="bio"></textarea></mat-form-field>
        <div class="ov__actions ov__wide">
          @if (error()) { <span class="ov__error" role="alert">{{ error() }}</span> }
          <button mat-button type="button" (click)="editing.set(false)">Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="busy() || form.invalid">Save profile</button>
        </div>
      </form>
    }
  `,
  styles: `
    .ov__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 24px; margin: 0 0 20px; }
    .ov__grid dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--clv-gray-600); margin-bottom: 4px; }
    .ov__grid dd { margin: 0; }
    .ov__wide { grid-column: 1 / -1; }
    .ov__bio { white-space: pre-line; color: var(--clv-gray-700); }
    .ov__chip { display: inline-block; padding: 2px 10px; margin: 0 6px 6px 0; border-radius: 999px; background: var(--clv-primary-50); color: var(--clv-primary-700); font-size: 0.8rem; }
    .ov__form { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 12px; }
    .ov__actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
    .ov__error { color: var(--clv-danger-text); margin-right: auto; }
  `,
})
export class StaffOverviewComponent {
  private readonly api = inject(StaffApiService);

  readonly profile = input.required<StaffProfile>();
  readonly canEdit = input(false);
  readonly changed = output<StaffProfile>();

  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    suffix: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    officeLocation: new FormControl('', { nonNullable: true }),
    npi: new FormControl('', { nonNullable: true, validators: Validators.pattern(/^\d{10}$/) }),
    specialties: new FormControl('', { nonNullable: true }),
    bio: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
  });

  constructor() {
    effect(() => {
      this.profile();
      this.editing.set(false);
    });
  }

  protected startEdit(): void {
    const p = this.profile();
    this.form.reset({
      title: p.title ?? '', firstName: p.firstName, lastName: p.lastName, suffix: p.suffix ?? '', phone: p.phone ?? '',
      officeLocation: p.officeLocation ?? '', npi: p.npi ?? '', specialties: p.specialties.join(', '), bio: p.bio ?? '',
    });
    this.error.set(null);
    this.editing.set(true);
  }

  protected save(): void {
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.api.updateProfile(this.profile().id, {
      ...v,
      npi: v.npi || null,
      specialties: v.specialties.split(',').map(s => s.trim()).filter(Boolean),
    }).subscribe({
      next: profile => {
        this.busy.set(false);
        this.changed.emit(profile);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
