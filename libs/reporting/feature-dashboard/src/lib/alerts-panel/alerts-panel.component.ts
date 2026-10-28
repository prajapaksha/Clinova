import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { DashboardAlert, DashboardAlertKind } from '@clinova/reporting/domain';

const KIND_ICONS: Record<DashboardAlertKind, string> = {
  PATIENT_ALERT: 'notification_important',
  LONG_WAIT: 'hourglass_bottom',
  UNSIGNED_NOTES: 'edit_note',
  NO_SHOW: 'person_off',
  CREDENTIAL_EXPIRING: 'verified_user',
};

@Component({
  selector: 'clv-alerts-panel',
  standalone: true,
  imports: [RouterModule, MatIconModule],
  template: `
    <section class="panel" aria-labelledby="alerts-title">
      <header class="panel__header">
        <mat-icon class="panel__icon">warning</mat-icon>
        <h2 id="alerts-title" class="panel__title">Urgent alerts</h2>
        @if (alerts().length) { <span class="panel__count">{{ alerts().length }}</span> }
      </header>
      <ul class="alerts" aria-live="polite">
        @for (a of alerts(); track a.id) {
          <li class="alert" [attr.data-severity]="a.severity">
            <mat-icon class="alert__icon" aria-hidden="true">{{ icon(a.kind) }}</mat-icon>
            <div class="alert__body">
              <p class="alert__title">{{ a.title }}</p>
              <p class="alert__detail">{{ a.detail }}</p>
              <a class="alert__link" [routerLink]="a.link" [queryParams]="a.queryParams ?? null">{{ a.actionLabel }}</a>
            </div>
          </li>
        } @empty {
          <li class="alerts__empty"><mat-icon>check_circle</mat-icon> Nothing needs attention right now.</li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host { display: block; }
    .panel { background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; overflow: hidden; }
    .panel__header { display: flex; align-items: center; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--clv-gray-200); }
    .panel__icon { color: var(--clv-danger-text); }
    .panel__title { margin: 0; font-size: 1rem; font-weight: 600; flex: 1; }
    .panel__count { padding: 1px 8px; border-radius: 999px; background: var(--clv-danger-bg); color: var(--clv-danger-text); font-size: 0.75rem; font-weight: 600; }
    .alerts { list-style: none; margin: 0; padding: 12px; display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow: auto; }
    .alert { display: flex; gap: 10px; padding: 12px; border-radius: 8px; border-left: 4px solid var(--clv-info-text); background: var(--clv-info-bg); }
    .alert[data-severity='CRITICAL'] { border-color: var(--clv-danger-text); background: var(--clv-danger-bg); }
    .alert[data-severity='WARNING'] { border-color: var(--clv-warning-text); background: var(--clv-warning-bg); }
    .alert__icon { flex-shrink: 0; color: var(--clv-gray-700); }
    .alert[data-severity='CRITICAL'] .alert__icon { color: var(--clv-danger-text); }
    .alert__body { min-width: 0; }
    .alert__title { margin: 0; font-weight: 600; font-size: 0.875rem; }
    .alert__detail { margin: 2px 0 6px; font-size: 0.8rem; color: var(--clv-gray-700); }
    .alert__link { font-size: 0.8rem; font-weight: 600; color: var(--clv-primary-700); }
    .alerts__empty { display: flex; align-items: center; gap: 8px; padding: 12px; color: var(--clv-success-text); font-size: 0.875rem; }
    @media print { .alert__link { display: none; } .alerts { max-height: none; } }
  `,
})
export class AlertsPanelComponent {
  readonly alerts = input.required<ReadonlyArray<DashboardAlert>>();

  protected icon(kind: DashboardAlertKind): string {
    return KIND_ICONS[kind];
  }
}
