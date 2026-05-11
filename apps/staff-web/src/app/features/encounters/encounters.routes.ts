import { Route } from '@angular/router';

export const ENCOUNTERS_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./encounters-page').then(m => m.EncountersPage) },
];
