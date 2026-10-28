import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { BillingPermissions } from '../shared/billing-shared';

@Component({
  selector: 'clv-billing-shell',
  standalone: true,
  imports: [RouterModule, MatTabsModule],
  template: `
    <nav mat-tab-nav-bar [tabPanel]="panel" class="billing-nav" aria-label="Billing sections">
      @for (link of links(); track link.path) {
        <a mat-tab-link [routerLink]="link.path" routerLinkActive #rla="routerLinkActive" [active]="rla.isActive">{{ link.label }}</a>
      }
    </nav>
    <mat-tab-nav-panel #panel>
      <router-outlet />
    </mat-tab-nav-panel>
  `,
  styles: `
    .billing-nav { padding: 0 24px; background: #fff; border-bottom: 1px solid var(--clv-gray-200); }
    @media print { .billing-nav { display: none; } }
  `,
})
export class BillingShellComponent {
  private readonly perms = inject(BillingPermissions);

  protected links() {
    return [
      ...(this.perms.canManage() ? [{ path: 'dashboard', label: 'Dashboard' }] : []),
      { path: 'invoices', label: 'Invoices' },
      ...(this.perms.canManage() ? [{ path: 'claims', label: 'Claims' }] : []),
      ...(this.perms.canManage() ? [{ path: 'fee-schedules', label: 'Fee schedules' }] : []),
    ];
  }
}
