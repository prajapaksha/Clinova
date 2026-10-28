import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { StaffApiService } from '@clinova/staff/data-access';
import type { ExpiringCredential } from '@clinova/staff/domain';
import { CREDENTIAL_TYPE_LABELS } from '@clinova/staff/domain';
import { BADGE_STYLES, CREDENTIAL_STATUS, errorMessage, relativeDays, roleLabel } from '../shared/staff-shared';

/** PRD §4.3 credential tracking: alerts at 90, 30 and 7 days before expiry. */
@Component({
  selector: 'clv-credential-tracker',
  imports: [DatePipe, RouterModule, MatButtonModule, MatButtonToggleModule, MatIconModule],
  template: `
    <div class="ct">
      <a mat-button routerLink=".." class="ct__back"><mat-icon>arrow_back</mat-icon> Staff directory</a>
      <header class="ct__header">
        <div>
          <h1 class="ct__title">Credential tracker</h1>
          <p class="ct__sub">Licenses, DEA registrations, certifications and insurance expiring soon across active staff.</p>
        </div>
        <mat-button-toggle-group [value]="days()" (change)="setDays($event.value)" aria-label="Window">
          <mat-button-toggle [value]="30">30 days</mat-button-toggle>
          <mat-button-toggle [value]="90">90 days</mat-button-toggle>
          <mat-button-toggle [value]="180">180 days</mat-button-toggle>
        </mat-button-toggle-group>
      </header>

      <div class="ct__kpis">
        <div class="ct__kpi ct__kpi--danger"><strong>{{ counts().expired }}</strong><span>Expired</span></div>
        <div class="ct__kpi ct__kpi--danger"><strong>{{ counts().week }}</strong><span>Within 7 days</span></div>
        <div class="ct__kpi ct__kpi--warning"><strong>{{ counts().month }}</strong><span>Within 30 days</span></div>
        <div class="ct__kpi"><strong>{{ rows().length }}</strong><span>In window</span></div>
      </div>

      @if (error()) { <p class="ct__error" role="alert">{{ error() }}</p> }

      <table class="ct__table">
        <thead><tr><th>Staff member</th><th>Credential</th><th>Number</th><th>Expires</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (c of rows(); track c.id) {
            <tr>
              <td><strong>{{ c.staffName }}</strong><br /><small>{{ roleLabel(c.staffRole) }}</small></td>
              <td>{{ typeLabel(c) }}@if (c.issuingState) { <small> · {{ c.issuingState }}</small> }</td>
              <td class="ct__mono">{{ c.number }}</td>
              <td>{{ c.expirationDate | date:'mediumDate' }}<br /><small>{{ relativeDays(c.daysUntilExpiry) }}</small></td>
              <td><span [class]="'badge badge--' + status(c).tone">{{ status(c).label }}</span></td>
              <td><a mat-button [routerLink]="['..', c.staffId]" [queryParams]="{ tab: 'credentials' }">Review</a></td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="ct__empty"><mat-icon>verified</mat-icon> No credentials expire in the next {{ days() }} days.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .ct { padding: 16px 24px 24px; }
    .ct__back { margin-left: -8px; }
    .ct__header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
    .ct__title { margin: 0; font-size: 1.5rem; }
    .ct__sub { margin: 4px 0 0; color: var(--clv-gray-600); font-size: 0.9rem; }
    .ct__kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    .ct__kpi { display: flex; flex-direction: column; padding: 14px 16px; background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; }
    .ct__kpi strong { font-size: 1.6rem; }
    .ct__kpi span { color: var(--clv-gray-600); font-size: 0.82rem; }
    .ct__kpi--danger strong { color: var(--clv-danger-text); }
    .ct__kpi--warning strong { color: var(--clv-warning-text); }
    .ct__error { color: var(--clv-danger-text); }
    .ct__table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; font-size: 0.875rem; }
    .ct__table th { padding: 10px 16px; text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--clv-gray-600); border-bottom: 1px solid var(--clv-gray-200); }
    .ct__table td { padding: 10px 16px; border-bottom: 1px solid var(--clv-gray-100); }
    .ct__table small { color: var(--clv-gray-600); }
    .ct__mono { font-family: 'Roboto Mono', ui-monospace, monospace; }
    .ct__empty { text-align: center; color: var(--clv-success-text); padding: 32px !important; }
    .ct__empty mat-icon { vertical-align: middle; }
    ${BADGE_STYLES}
  `,
})
export class CredentialTrackerComponent {
  private readonly api = inject(StaffApiService);

  protected readonly roleLabel = roleLabel;
  protected readonly relativeDays = relativeDays;
  protected readonly days = signal(90);
  protected readonly rows = signal<ExpiringCredential[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly counts = computed(() => {
    const rows = this.rows();
    return {
      expired: rows.filter(r => r.status === 'EXPIRED').length,
      week: rows.filter(r => r.status === 'DUE_7').length,
      month: rows.filter(r => r.status === 'DUE_30').length,
    };
  });

  constructor() {
    this.load();
  }

  protected setDays(days: number): void {
    this.days.set(days);
    this.load();
  }

  protected typeLabel(c: ExpiringCredential): string {
    return CREDENTIAL_TYPE_LABELS[c.type] ?? c.type;
  }

  protected status(c: ExpiringCredential) {
    return CREDENTIAL_STATUS[c.status];
  }

  private load(): void {
    this.error.set(null);
    this.api.expiringCredentials(this.days()).subscribe({
      next: rows => this.rows.set(rows),
      error: err => this.error.set(errorMessage(err, 'Credentials could not be loaded.')),
    });
  }
}
