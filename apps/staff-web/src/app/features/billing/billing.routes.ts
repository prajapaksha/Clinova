import { Route } from '@angular/router';

export const BILLING_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./billing-page').then(m => m.BillingPage) },
];
