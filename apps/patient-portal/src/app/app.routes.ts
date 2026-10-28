import { Route } from '@angular/router';
import { PORTAL_AUTH_ROUTES, PORTAL_ROUTES } from '@clinova/portal/feature-portal';
import { signedIn, signedOut } from './core/portal.guards';

export const appRoutes: Route[] = [
  ...PORTAL_AUTH_ROUTES.map(route => ({ ...route, canActivate: [signedOut] })),
  {
    path: '',
    canActivate: [signedIn],
    loadComponent: () => import('./layout/portal-shell').then(m => m.PortalShell),
    children: PORTAL_ROUTES,
  },
  { path: '**', redirectTo: '' },
];