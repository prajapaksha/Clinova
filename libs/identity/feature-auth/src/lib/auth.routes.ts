import { Route } from '@angular/router';
import { LoginPage } from './login-page/login-page.component';

export const AUTH_ROUTES: Route[] = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPage },
];
