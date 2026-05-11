import { Route } from '@angular/router';

export const MESSAGES_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./messages-page').then(m => m.MessagesPage) },
];
