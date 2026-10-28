import { Route } from '@angular/router';

/** Public pages (signed-out). */
export const PORTAL_AUTH_ROUTES: Route[] = [
  { path: 'sign-in', title: 'Sign in · Clinova', loadComponent: () => import('./auth/sign-in.page').then(m => m.SignInPage) },
  { path: 'register', title: 'Create account · Clinova', loadComponent: () => import('./auth/register.page').then(m => m.RegisterPage) },
  { path: 'forgot-password', title: 'Reset password · Clinova', loadComponent: () => import('./auth/password.pages').then(m => m.ForgotPasswordPage) },
  { path: 'reset-password', title: 'Choose a new password · Clinova', loadComponent: () => import('./auth/password.pages').then(m => m.ResetPasswordPage) },
];

/** Signed-in patient pages (rendered inside the portal shell). */
export const PORTAL_ROUTES: Route[] = [
  { path: '', pathMatch: 'full', title: 'Home · Clinova', loadComponent: () => import('./home/home.page').then(m => m.PortalHomePage) },
  { path: 'appointments', title: 'Appointments · Clinova', loadComponent: () => import('./appointments/appointments.page').then(m => m.PortalAppointmentsPage) },
  { path: 'appointments/book', title: 'Book an appointment · Clinova', loadComponent: () => import('./appointments/book.page').then(m => m.PortalBookPage) },
  { path: 'appointments/:id/reschedule', title: 'Reschedule · Clinova', loadComponent: () => import('./appointments/book.page').then(m => m.PortalBookPage) },
  { path: 'records', title: 'Health records · Clinova', loadComponent: () => import('./records/records.page').then(m => m.PortalRecordsPage) },
  { path: 'records/visits/:id', title: 'Visit summary · Clinova', loadComponent: () => import('./records/visit.page').then(m => m.PortalVisitPage) },
  { path: 'billing', title: 'Billing · Clinova', loadComponent: () => import('./billing/billing.page').then(m => m.PortalBillingPage) },
  { path: 'billing/pay', title: 'Pay your bill · Clinova', loadComponent: () => import('./billing/pay.page').then(m => m.PortalPayPage) },
  { path: 'billing/invoices/:id', title: 'Bill · Clinova', loadComponent: () => import('./billing/invoice.page').then(m => m.PortalInvoicePage) },
  { path: 'messages', title: 'Messages · Clinova', loadComponent: () => import('./messages/messages.pages').then(m => m.PortalMessagesPage) },
  { path: 'messages/new', title: 'New message · Clinova', loadComponent: () => import('./messages/messages.pages').then(m => m.PortalComposePage) },
  { path: 'messages/:id', title: 'Conversation · Clinova', loadComponent: () => import('./messages/messages.pages').then(m => m.PortalThreadPage) },
  { path: 'profile', title: 'Profile · Clinova', loadComponent: () => import('./profile/profile.page').then(m => m.PortalProfilePage) },
];