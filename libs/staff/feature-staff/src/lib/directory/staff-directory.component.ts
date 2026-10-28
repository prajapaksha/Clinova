import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { debounceTime } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Permissions } from '@clinova/auth';
import { StaffApiService } from '@clinova/staff/data-access';
import type { StaffFilters, StaffProfile, StaffSummary } from '@clinova/staff/domain';
import { AddStaffDialog } from '../dialogs/add-staff-dialog';
import { BADGE_STYLES, CREDENTIAL_STATUS, ROLE_OPTIONS, errorMessage, initials, roleLabel } from '../shared/staff-shared';

type Status = NonNullable<StaffFilters['status']>;

/** PRD §4.3 Staff directory: filter by role, status, specialty; credential badges. */
@Component({
  selector: 'clv-staff-directory',
  imports: [
    ReactiveFormsModule, RouterModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatProgressSpinnerModule, MatSelectModule,
  ],
  template: `
    <div class="sd">
      <header class="sd__header">
        <div>
          <h1 class="sd__title">Staff</h1>
          <p class="sd__sub">{{ staff().length }} {{ status() === 'inactive' ? 'inactive' : '' }} staff member{{ staff().length === 1 ? '' : 's' }}</p>
        </div>
        <div class="sd__actions">
          @if (canTrack()) {
            <a mat-stroked-button routerLink="credentials"><mat-icon>verified_user</mat-icon> Credential tracker</a>
          }
          @if (canAdd()) {
            <button mat-flat-button color="primary" type="button" (click)="add()"><mat-icon>person_add</mat-icon> Add staff member</button>
          }
        </div>
      </header>

      <div class="sd__filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="sd__search">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Search name or email</mat-label>
          <input matInput [formControl]="search" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Role</mat-label>
          <mat-select [value]="role()" (selectionChange)="role.set($event.value)">
            <mat-option value="">All roles</mat-option>
            @for (r of roles; track r.value) { <mat-option [value]="r.value">{{ r.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Specialty</mat-label>
          <mat-select [value]="specialty()" (selectionChange)="specialty.set($event.value)">
            <mat-option value="">All specialties</mat-option>
            @for (s of specialties(); track s) { <mat-option [value]="s">{{ s }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-button-toggle-group [value]="status()" (change)="status.set($event.value)" aria-label="Account status">
          <mat-button-toggle value="active">Active</mat-button-toggle>
          <mat-button-toggle value="inactive">Inactive</mat-button-toggle>
          <mat-button-toggle value="all">All</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (error()) { <p class="sd__error" role="alert">{{ error() }}</p> }

      <div class="sd__table-wrap">
        @if (loading()) { <div class="sd__loading"><mat-spinner diameter="28" /></div> }
        <table class="sd__table">
          <thead><tr><th>Name</th><th>Role</th><th>Specialties</th><th>Contact</th><th>Credentials</th></tr></thead>
          <tbody>
            @for (s of staff(); track s.id) {
              <tr tabindex="0" role="link" [attr.aria-label]="'Open profile for ' + s.displayName"
                  (click)="open(s)" (keydown.enter)="open(s)" [class.sd__row--inactive]="!s.isActive">
                <td>
                  <div class="sd__person">
                    <span class="sd__avatar" aria-hidden="true">{{ initials(s) }}</span>
                    <span><strong>{{ s.displayName }}</strong>@if (!s.isActive) { <span class="badge badge--muted">Inactive</span> }<br /><small>{{ s.email }}</small></span>
                  </div>
                </td>
                <td>{{ roleLabel(s.role) }}</td>
                <td>{{ s.specialties.join(', ') || '—' }}</td>
                <td>{{ s.phone || '—' }}@if (s.officeLocation) { <br /><small>{{ s.officeLocation }}</small> }</td>
                <td><span [class]="'badge badge--' + status_(s).tone">{{ status_(s).label }}</span></td>
              </tr>
            } @empty {
              @if (!loading()) { <tr><td colspan="5" class="sd__empty">No staff members match these filters.</td></tr> }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .sd { padding: 24px; }
    .sd__header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .sd__title { margin: 0; font-size: 1.5rem; }
    .sd__sub { margin: 4px 0 0; color: var(--clv-gray-600); font-size: 0.9rem; }
    .sd__actions { display: flex; gap: 8px; }
    .sd__filters { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 20px 0 16px; }
    .sd__filters .mat-mdc-form-field { width: 200px; }
    .sd__filters .sd__search { flex: 1; min-width: 240px; max-width: 360px; width: auto; }
    .sd__error { color: var(--clv-danger-text); }
    .sd__table-wrap { position: relative; background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; overflow: auto; }
    .sd__loading { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(255, 255, 255, 0.6); }
    .sd__table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .sd__table th { padding: 10px 16px; text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--clv-gray-600); border-bottom: 1px solid var(--clv-gray-200); }
    .sd__table td { padding: 10px 16px; border-bottom: 1px solid var(--clv-gray-100); vertical-align: middle; }
    .sd__table tbody tr { cursor: pointer; }
    .sd__table tbody tr:hover { background: var(--clv-gray-50, #f8fafc); }
    .sd__table small { color: var(--clv-gray-600); }
    .sd__row--inactive { opacity: 0.65; }
    .sd__person { display: flex; align-items: center; gap: 12px; }
    .sd__person .badge { margin-left: 8px; }
    .sd__avatar { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; background: var(--clv-primary-50); color: var(--clv-primary-700); font-weight: 600; font-size: 13px; }
    .sd__empty { text-align: center; color: var(--clv-gray-600); padding: 32px !important; }
    ${BADGE_STYLES}
  `,
})
export class StaffDirectoryComponent {
  private readonly api = inject(StaffApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly perms = inject(Permissions);

  protected readonly roles = ROLE_OPTIONS;
  protected readonly initials = initials;
  protected readonly roleLabel = roleLabel;

  protected readonly search = new FormControl('', { nonNullable: true });
  private readonly searchTerm = toSignal(this.search.valueChanges.pipe(debounceTime(250)), { initialValue: '' });
  protected readonly role = signal('');
  protected readonly specialty = signal('');
  protected readonly status = signal<Status>('active');

  protected readonly staff = signal<StaffSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly specialties = signal<string[]>([]);

  protected readonly canAdd = computed(() => this.perms.can('identity:users', 'write'));
  protected readonly canTrack = computed(() => this.perms.can('staff:profiles', 'full'));

  constructor() {
    effect(() => {
      const filters: StaffFilters = { search: this.searchTerm(), role: this.role(), specialty: this.specialty(), status: this.status() };
      untracked(() => this.load(filters));
    });
  }

  protected status_(s: StaffSummary) {
    return CREDENTIAL_STATUS[s.credentialStatus];
  }

  protected open(s: StaffSummary): void {
    this.router.navigate(['/staff', s.id]);
  }

  protected add(): void {
    this.dialog.open<AddStaffDialog, void, StaffProfile>(AddStaffDialog).afterClosed().subscribe(profile => {
      if (profile) this.router.navigate(['/staff', profile.id]);
    });
  }

  private load(filters: StaffFilters): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(filters).subscribe({
      next: rows => {
        this.staff.set(rows);
        this.loading.set(false);
        if (!filters.specialty) {
          const known = new Set([...this.specialties(), ...rows.flatMap(r => r.specialties)]);
          this.specialties.set([...known].sort());
        }
      },
      error: err => {
        this.loading.set(false);
        this.error.set(errorMessage(err, 'Staff could not be loaded.'));
      },
    });
  }
}
