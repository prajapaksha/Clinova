import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Permissions } from '@clinova/auth';

@Component({
  selector: 'clv-settings-shell',
  imports: [RouterModule, MatIconModule],
  template: `
    <div class="ss">
      <header>
        <h1 class="ss__title">Settings</h1>
        <p class="ss__sub">Practice administration, security and compliance.</p>
      </header>
      <div class="ss__layout">
        <nav class="ss__nav" aria-label="Settings sections">
          @for (item of items(); track item.route) {
            <a [routerLink]="item.route" routerLinkActive="ss__link--active" class="ss__link">
              <mat-icon>{{ item.icon }}</mat-icon>{{ item.label }}
            </a>
          }
        </nav>
        <section class="ss__content"><router-outlet /></section>
      </div>
    </div>
  `,
  styles: `
    .ss { padding: 24px; }
    .ss__title { margin: 0; font-size: 1.5rem; }
    .ss__sub { margin: 4px 0 0; color: var(--clv-gray-600); font-size: 0.9rem; }
    .ss__layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 20px; margin-top: 20px; align-items: start; }
    .ss__nav { display: flex; flex-direction: column; gap: 4px; }
    .ss__link { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; color: var(--clv-gray-700); text-decoration: none; font-size: 0.9rem; }
    .ss__link:hover { background: var(--clv-gray-100); }
    .ss__link mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .ss__link--active { background: var(--clv-primary-50); color: var(--clv-primary-700); font-weight: 500; }
    .ss__content { min-width: 0; }
  `,
})
export class SettingsShellComponent {
  private readonly perms = inject(Permissions);

  protected readonly items = computed(() => [
    ...(this.perms.can('identity:auditLogs') ? [{ label: 'Audit log', icon: 'policy', route: 'audit-log' }] : []),
    ...(this.perms.can('system:settings') ? [{ label: 'Notification templates', icon: 'edit_notifications', route: 'notifications' }] : []),
    { label: 'Message log', icon: 'outgoing_mail', route: 'message-log' },
    { label: 'Roles & permissions', icon: 'admin_panel_settings', route: 'permissions' },
    ...(this.perms.can('billing:invoices') ? [{ label: 'Fee schedules', icon: 'price_change', route: '/billing/fee-schedules' }] : []),
  ]);
}
