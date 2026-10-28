import { inject } from '@angular/core';
import { Route } from '@angular/router';
import { Permissions, requirePermission } from '@clinova/auth';
import { SettingsShellComponent } from './settings-shell.component';

export const SETTINGS_ROUTES: Route[] = [
  {
    path: '',
    component: SettingsShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => (inject(Permissions).can('identity:auditLogs') ? 'audit-log' : 'permissions'),
      },
      {
        path: 'audit-log',
        canActivate: [requirePermission({ capability: 'identity:auditLogs', access: 'read' })],
        loadComponent: () => import('./audit-log/audit-log.component').then(m => m.AuditLogComponent),
      },
      {
        path: 'permissions',
        loadComponent: () => import('./permissions-matrix/permissions-matrix.component').then(m => m.PermissionsMatrixComponent),
      },
    ],
  },
];