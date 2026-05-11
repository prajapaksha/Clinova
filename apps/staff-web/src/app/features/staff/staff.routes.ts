import { Route } from '@angular/router';

export const STAFF_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./staff-page').then(m => m.StaffPage) },
];
