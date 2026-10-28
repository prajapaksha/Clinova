import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { ChangePasswordDialog, Permissions } from '@clinova/auth';
import { StaffApiService } from '@clinova/staff/data-access';
import type { StaffProfile } from '@clinova/staff/domain';
import { canManageAccount, PASSWORD_MAX_AGE_DAYS } from '@clinova/identity/domain';
import { TemporaryPasswordDialog, TemporaryPasswordData } from '../dialogs/temporary-password-dialog';
import { BADGE_STYLES, ROLE_OPTIONS, errorMessage } from '../shared/staff-shared';

/** Sign-in status and account administration (PRD §5.1 / §3.2 user management). */
@Component({
  selector: 'clv-staff-security',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule],
  template: `
    @if (profile().security; as sec) {
      <dl class="se__grid">
        <div><dt>Last sign-in</dt><dd>{{ sec.lastLoginAt ? (sec.lastLoginAt | date:'medium') : 'Never' }}</dd></div>
        <div><dt>Password</dt>
          <dd>
            @if (sec.passwordExpired) { <span class="badge badge--warning">Change required</span> }
            @else { Changed {{ sec.passwordChangedAt | date:'mediumDate' }} <small>(rotates every {{ maxAge }} days)</small> }
          </dd>
        </div>
        <div><dt>Sign-in status</dt>
          <dd>
            @if (sec.lockedUntil) { <span class="badge badge--danger"><mat-icon>lock</mat-icon> Locked until {{ sec.lockedUntil | date:'shortTime' }}</span> }
            @else if (sec.failedLoginAttempts) { {{ sec.failedLoginAttempts }} recent failed attempt{{ sec.failedLoginAttempts === 1 ? '' : 's' }} }
            @else { <span class="badge badge--ok">OK</span> }
          </dd>
        </div>
        <div><dt>Two-factor authentication</dt><dd>{{ sec.mfaEnabled ? 'Enabled' : 'Not enabled' }} <small>(coming soon)</small></dd></div>
      </dl>
    }

    <div class="se__actions">
      @if (isSelf()) {
        <button mat-stroked-button type="button" (click)="changeOwnPassword()"><mat-icon>key</mat-icon> Change password</button>
      }
      @if (canManage()) {
        <button mat-stroked-button type="button" [disabled]="busy()" (click)="resetPassword()"><mat-icon>lock_reset</mat-icon> Reset password</button>
        @if (profile().security?.lockedUntil) {
          <button mat-stroked-button type="button" [disabled]="busy()" (click)="unlock()"><mat-icon>lock_open</mat-icon> Unlock account</button>
        }
      }
    </div>

    @if (canManage()) {
      <section class="se__admin" aria-labelledby="se-admin">
        <h3 id="se-admin">Account administration</h3>
        <div class="se__row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Role</mat-label>
            <mat-select [ngModel]="role()" (ngModelChange)="role.set($event)" [disabled]="busy()">
              @for (r of roles(); track r.value) { <mat-option [value]="r.value">{{ r.label }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" type="button" [disabled]="busy() || role() === profile().role" (click)="saveRole()">Change role</button>
          <span class="se__spacer"></span>
          @if (profile().isActive) {
            <button mat-stroked-button type="button" class="se__danger" [disabled]="busy()" (click)="setActive(false)"><mat-icon>person_off</mat-icon> Deactivate account</button>
          } @else {
            <button mat-stroked-button type="button" [disabled]="busy()" (click)="setActive(true)"><mat-icon>person</mat-icon> Reactivate account</button>
          }
        </div>
      </section>
    }
    @if (error()) { <p class="se__error" role="alert">{{ error() }}</p> }
  `,
  styles: `
    .se__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 24px; margin: 0 0 20px; }
    .se__grid dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--clv-gray-600); margin-bottom: 4px; }
    .se__grid dd { margin: 0; }
    .se__grid small { color: var(--clv-gray-600); }
    .se__actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .se__admin { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--clv-gray-200); }
    .se__admin h3 { margin: 0 0 12px; font-size: 1rem; }
    .se__row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .se__spacer { flex: 1; }
    .se__danger { color: var(--clv-danger-text); }
    .se__error { color: var(--clv-danger-text); }
    ${BADGE_STYLES}
  `,
})
export class StaffSecurityComponent {
  private readonly api = inject(StaffApiService);
  private readonly dialog = inject(MatDialog);
  private readonly perms = inject(Permissions);

  readonly profile = input.required<StaffProfile>();
  readonly isSelf = input(false);
  readonly changed = output<StaffProfile | void>();

  protected readonly maxAge = PASSWORD_MAX_AGE_DAYS;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly role = linkedSignal(() => this.profile().role);

  /** Account admins, never for their own account (no self role change / deactivation). */
  protected readonly canManage = computed(() =>
    !this.isSelf() && this.perms.can('identity:users', 'write') && canManageAccount(this.perms.role(), this.profile().role));
  protected readonly roles = computed(() => ROLE_OPTIONS.filter(r => canManageAccount(this.perms.role(), this.profile().role, r.value)));

  protected changeOwnPassword(): void {
    this.dialog.open(ChangePasswordDialog, { data: {} }).afterClosed().subscribe(ok => {
      if (ok) this.changed.emit();
    });
  }

  protected resetPassword(): void {
    const p = this.profile();
    if (!confirm(`Reset the password for ${p.displayName}? Their current password will stop working immediately.`)) return;
    this.run(this.api.resetPassword(p.id), ({ temporaryPassword }) => {
      this.dialog.open<TemporaryPasswordDialog, TemporaryPasswordData>(TemporaryPasswordDialog, {
        data: { name: p.displayName, email: p.email, password: temporaryPassword },
      });
      this.changed.emit();
    });
  }

  protected unlock(): void {
    this.run(this.api.unlock(this.profile().id), profile => this.changed.emit(profile));
  }

  protected saveRole(): void {
    this.run(this.api.updateAccount(this.profile().id, { role: this.role() }), profile => this.changed.emit(profile));
  }

  protected setActive(isActive: boolean): void {
    const p = this.profile();
    if (!isActive && !confirm(`Deactivate ${p.displayName}? They will be signed out and unable to sign in.`)) return;
    this.run(this.api.updateAccount(p.id, { isActive }), profile => this.changed.emit(profile));
  }

  private run<T>(request: Observable<T>, done: (value: T) => void): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: value => {
        this.busy.set(false);
        done(value);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
