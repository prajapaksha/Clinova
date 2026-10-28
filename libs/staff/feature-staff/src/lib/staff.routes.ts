import { Route } from '@angular/router';
import { requirePermission } from '@clinova/auth';

export const STAFF_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () => import('./directory/staff-directory.component').then(m => m.StaffDirectoryComponent),
  },
  {
    path: 'credentials',
    canActivate: [requirePermission({ capability: 'staff:profiles', access: 'full' })],
    loadComponent: () => import('./credential-tracker/credential-tracker.component').then(m => m.CredentialTrackerComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./profile/staff-profile.component').then(m => m.StaffProfileComponent),
  },
];