import { inject } from '@angular/core';
import { Route } from '@angular/router';
import { BillingShellComponent } from './billing-shell/billing-shell.component';
import { requirePermission } from '@clinova/auth';
import { BillingPermissions } from './shared/billing-shared';

const manage = requirePermission({ capability: 'billing:invoices', access: 'full' });
const collect = requirePermission({ capability: 'billing:invoices', access: 'write' });

export const BILLING_ROUTES: Route[] = [
  {
    path: '',
    component: BillingShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => (inject(BillingPermissions).canManage() ? 'dashboard' : 'invoices'),
      },
      {
        path: 'dashboard',
        canActivate: [manage],
        loadComponent: () => import('./billing-dashboard/billing-dashboard.component').then(m => m.BillingDashboardComponent),
      },
      {
        path: 'invoices',
        loadComponent: () => import('./invoice-list/invoice-list.component').then(m => m.InvoiceListComponent),
      },
      {
        path: 'invoices/new',
        canActivate: [manage],
        loadComponent: () => import('./invoice-new/invoice-new.component').then(m => m.InvoiceNewComponent),
      },
      {
        path: 'invoices/:id',
        loadComponent: () => import('./invoice-detail/invoice-detail.component').then(m => m.InvoiceDetailComponent),
      },
      {
        path: 'claims',
        canActivate: [manage],
        loadComponent: () => import('./claims/claims.component').then(m => m.ClaimsComponent),
      },
      {
        path: 'fee-schedules',
        loadComponent: () => import('./fee-schedules/fee-schedules.component').then(m => m.FeeSchedulesComponent),
      },
      {
        path: 'statements/:patientId',
        canActivate: [collect],
        loadComponent: () => import('./statement/statement.component').then(m => m.StatementComponent),
      },
    ],
  },
];
