import { Route } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./layout/shell').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('@clinova/reporting/feature-dashboard').then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'calendar',
        loadChildren: () => import('@clinova/scheduling/feature-calendar').then(m => m.CALENDAR_ROUTES),
      },
      {
        path: 'patients',
        children: [
          {
            path: '',
            loadComponent: () => import('@clinova/patient/feature-patient-list').then(m => m.PatientListComponent),
          },
          {
            path: 'new',
            loadComponent: () => import('@clinova/patient/feature-patient-new').then(m => m.PatientNewComponent),
          },
          {
            path: ':id',
            loadChildren: () => import('@clinova/patient/feature-patient-profile').then(m => m.PATIENT_PROFILE_ROUTES),
          },
        ],
      },
      {
        path: 'encounters',
        loadChildren: () => import('@clinova/clinical/feature-encounters').then(m => m.ENCOUNTERS_ROUTES),
      },
      {
        path: 'billing',
        loadChildren: () => import('@clinova/billing/feature-billing').then(m => m.BILLING_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () => import('@clinova/reporting/feature-reports').then(m => m.REPORTS_ROUTES),
      },
      {
        path: 'staff',
        loadChildren: () => import('@clinova/staff/feature-staff').then(m => m.STAFF_ROUTES),
      },
      {
        path: 'messages',
        loadChildren: () => import('@clinova/notifications/feature-messages').then(m => m.MESSAGES_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('@clinova/shared/feature-settings').then(m => m.SETTINGS_ROUTES),
      },
    ],
  },
  {
    path: 'auth',
    loadChildren: () => import('@clinova/identity/feature-auth').then(m => m.AUTH_ROUTES),
  },
  { path: '**', redirectTo: 'dashboard' },
];
