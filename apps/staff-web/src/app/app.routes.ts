import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./layout/shell').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'calendar',
        loadChildren: () => import('./features/calendar/calendar.routes').then(m => m.CALENDAR_ROUTES),
      },
      {
        path: 'patients',
        loadChildren: () => import('./features/patients/patients.routes').then(m => m.PATIENTS_ROUTES),
      },
      {
        path: 'encounters',
        loadChildren: () => import('./features/encounters/encounters.routes').then(m => m.ENCOUNTERS_ROUTES),
      },
      {
        path: 'billing',
        loadChildren: () => import('./features/billing/billing.routes').then(m => m.BILLING_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () => import('./features/reports/reports.routes').then(m => m.REPORTS_ROUTES),
      },
      {
        path: 'staff',
        loadChildren: () => import('./features/staff/staff.routes').then(m => m.STAFF_ROUTES),
      },
      {
        path: 'messages',
        loadChildren: () => import('./features/messages/messages.routes').then(m => m.MESSAGES_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
      },
    ],
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  { path: '**', redirectTo: 'dashboard' },
];
