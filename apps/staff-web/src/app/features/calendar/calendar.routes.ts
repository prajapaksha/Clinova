import { Route } from '@angular/router';

export const CALENDAR_ROUTES: Route[] = [
  { path: '', loadComponent: () => import('./calendar-page').then(m => m.CalendarPage) },
];
