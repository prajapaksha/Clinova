import { Component, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StaffApiService } from '@clinova/staff/data-access';
import type { StaffCredential, StaffProfile } from '@clinova/staff/domain';
import { CREDENTIAL_TYPE_LABELS } from '@clinova/staff/domain';
import { CredentialDialog, CredentialDialogData } from '../dialogs/credential-dialog';
import { BADGE_STYLES, CREDENTIAL_STATUS, errorMessage, relativeDays } from '../shared/staff-shared';

@Component({
  selector: 'clv-staff-credentials',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="cr__head">
      <p class="cr__hint">Alerts are sent 90, 30 and 7 days before a credential expires.</p>
      @if (canEdit()) {
        <button mat-stroked-button type="button" (click)="edit()"><mat-icon>add</mat-icon> Add credential</button>
      }
    </div>
    @if (error()) { <p class="cr__error" role="alert">{{ error() }}</p> }
    <table class="cr__table">
      <thead><tr><th>Credential</th><th>Number</th><th>Issued by</th><th>Expires</th><th>Status</th><th></th></tr></thead>
      <tbody>
        @for (c of profile().credentials; track c.id) {
          <tr>
            <td>
              <strong>{{ typeLabel(c) }}</strong>
              @if (c.isVerified) {
                <mat-icon class="cr__verified" matTooltip="Verified against the primary source" aria-label="Verified">verified</mat-icon>
              }
            </td>
            <td class="cr__mono">{{ c.number }}</td>
            <td>{{ issuer(c) }}</td>
            <td>
              @if (c.expirationDate) { {{ c.expirationDate | date:'mediumDate' }}<br /><small>{{ relativeDays(c.daysUntilExpiry) }}</small> } @else { — }
            </td>
            <td><span [class]="'badge badge--' + status(c).tone">{{ status(c).label }}</span></td>
            <td class="cr__actions">
              @if (canEdit()) {
                <button mat-icon-button type="button" (click)="edit(c)" [attr.aria-label]="'Edit ' + typeLabel(c)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button type="button" (click)="remove(c)" [attr.aria-label]="'Remove ' + typeLabel(c)"><mat-icon>delete_outline</mat-icon></button>
              }
            </td>
          </tr>
        } @empty {
          <tr><td colspan="6" class="cr__empty">No credentials on file.</td></tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .cr__head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 12px; }
    .cr__hint { margin: 0; color: var(--clv-gray-600); font-size: 0.875rem; }
    .cr__error { color: var(--clv-danger-text); }
    .cr__table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .cr__table th { padding: 8px 12px; text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--clv-gray-600); border-bottom: 1px solid var(--clv-gray-200); }
    .cr__table td { padding: 8px 12px; border-bottom: 1px solid var(--clv-gray-100); vertical-align: middle; }
    .cr__table small { color: var(--clv-gray-600); }
    .cr__mono { font-family: 'Roboto Mono', ui-monospace, monospace; }
    .cr__verified { color: var(--clv-success-text); font-size: 16px; width: 16px; height: 16px; vertical-align: text-bottom; margin-left: 4px; }
    .cr__actions { text-align: right; white-space: nowrap; }
    .cr__empty { text-align: center; color: var(--clv-gray-600); padding: 24px !important; }
    ${BADGE_STYLES}
  `,
})
export class StaffCredentialsComponent {
  private readonly api = inject(StaffApiService);
  private readonly dialog = inject(MatDialog);

  readonly profile = input.required<StaffProfile>();
  readonly canEdit = input(false);
  readonly canVerify = input(false);
  /** Emitted after any change so the parent reloads the profile. */
  readonly changed = output<void>();

  protected readonly relativeDays = relativeDays;
  protected readonly error = signal<string | null>(null);

  protected typeLabel(c: StaffCredential): string {
    return CREDENTIAL_TYPE_LABELS[c.type] ?? c.type;
  }

  protected issuer(c: StaffCredential): string {
    return [c.issuingAuthority, c.issuingState].filter(Boolean).join(' · ') || '—';
  }

  protected status(c: StaffCredential) {
    return CREDENTIAL_STATUS[c.status];
  }

  protected edit(credential?: StaffCredential): void {
    this.dialog
      .open<CredentialDialog, CredentialDialogData, StaffCredential>(CredentialDialog, {
        data: { staffId: this.profile().id, credential, canVerify: this.canVerify() },
      })
      .afterClosed()
      .subscribe(saved => {
        if (saved) this.changed.emit();
      });
  }

  protected remove(c: StaffCredential): void {
    if (!confirm(`Remove ${this.typeLabel(c)} ${c.number}?`)) return;
    this.error.set(null);
    this.api.removeCredential(this.profile().id, c.id).subscribe({
      next: () => this.changed.emit(),
      error: err => this.error.set(errorMessage(err)),
    });
  }
}
