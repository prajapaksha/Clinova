import { Route } from '@angular/router';

export const AUTH_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./auth-page').then(m => m.AuthPage) },
];
