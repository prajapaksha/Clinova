import { Route } from '@angular/router';

export const MESSAGES_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./inbox/inbox.page').then(m => m.InboxPage) },
];