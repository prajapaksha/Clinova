import { Route } from '@angular/router';

export const PATIENTS_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./patients-page').then(m => m.PatientsPage) },
];
