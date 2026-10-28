import { Route } from '@angular/router';
import { requirePermission } from '@clinova/auth';
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
        canActivate: [requirePermission({ capability: 'scheduling:appointments', access: 'read' })],
        loadChildren: () => import('@clinova/scheduling/feature-calendar').then(m => m.CALENDAR_ROUTES),
      },
      {
        path: 'patients',
        canActivate: [requirePermission({ capability: 'patient:profiles', access: 'read' })],
        children: [
          {
            path: '',
            loadComponent: () => import('@clinova/patient/feature-patient-list').then(m => m.PatientListComponent),
          },
          {
            path: 'new',
            canActivate: [requirePermission({ capability: 'patient:profiles', access: 'write' })],
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
        canActivate: [requirePermission({ capability: 'clinical:notes', access: 'read' })],
        loadChildren: () => import('@clinova/clinical/feature-encounters').then(m => m.ENCOUNTERS_ROUTES),
      },
      {
        path: 'billing',
        canActivate: [requirePermission({ capability: 'billing:invoices', access: 'read' })],
        loadChildren: () => import('@clinova/billing/feature-billing').then(m => m.BILLING_ROUTES),
      },
      {
        path: 'reports',
        canActivate: [requirePermission({ capability: 'reporting:reports', access: 'read' })],
        loadChildren: () => import('@clinova/reporting/feature-reports').then(m => m.REPORTS_ROUTES),
      },
      {
        path: 'staff',
        canActivate: [requirePermission({ capability: 'staff:profiles', access: 'read' })],
        loadChildren: () => import('@clinova/staff/feature-staff').then(m => m.STAFF_ROUTES),
      },
      {
        path: 'messages',
        loadChildren: () => import('@clinova/notifications/feature-messages').then(m => m.MESSAGES_ROUTES),
      },
      {
        path: 'settings',
        canActivate: [requirePermission({ capability: 'system:settings', access: 'read' }, { capability: 'identity:auditLogs', access: 'read' })],
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
