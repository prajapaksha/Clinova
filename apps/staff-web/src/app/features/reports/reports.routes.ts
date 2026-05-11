import { Route } from '@angular/router';

export const REPORTS_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./reports-page').then(m => m.ReportsPage) },
];
