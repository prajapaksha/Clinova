import { Route } from '@angular/router';

export const SETTINGS_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./settings-page').then(m => m.SettingsPage) },
];
