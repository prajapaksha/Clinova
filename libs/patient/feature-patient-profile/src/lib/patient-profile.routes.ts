import { Route } from '@angular/router';
import { PatientProfileComponent } from './patient-profile/patient-profile.component';

export const PATIENT_PROFILE_ROUTES: Route[] = [
  {
    path: '',
    component: PatientProfileComponent,
    children: [
      { path: '', redirectTo: 'summary', pathMatch: 'full' },
      {
        path: 'summary',
        loadComponent: () => import('./tabs/summary-tab/summary-tab.component').then(m => m.SummaryTab),
      },
      {
        path: 'medical',
        loadComponent: () => import('./tabs/medical-tab/medical-tab.component').then(m => m.MedicalTab),
      },
      {
        path: 'appointments',
        loadComponent: () => import('./tabs/appointments-tab/appointments-tab.component').then(m => m.AppointmentsTab),
      },
      {
        path: 'documents',
        loadComponent: () => import('./tabs/documents-tab/documents-tab.component').then(m => m.DocumentsTab),
      },
      {
        path: 'billing',
        loadComponent: () => import('./tabs/billing-tab/billing-tab.component').then(m => m.BillingTab),
      },
      {
        path: 'notes',
        loadComponent: () => import('./tabs/notes-tab/notes-tab.component').then(m => m.NotesTab),
      },
    ],
  },
];
