import { Route } from '@angular/router';
import { MessagesPage } from './messages-page/messages-page.component';

export const MESSAGES_ROUTES: Route[] = [
  { path: '', component: MessagesPage },
];
