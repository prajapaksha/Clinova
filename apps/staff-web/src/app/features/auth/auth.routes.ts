import { Route } from '@angular/router';

export const AUTH_ROUTES: Route[] = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./login/login').then(m => m.LoginPage) },
];
