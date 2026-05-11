import { Route } from '@angular/router';

export const PATIENTS_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () => import('./patient-list/patient-list').then(m => m.PatientListPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./patient-new/patient-new').then(m => m.PatientNewPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./patient-profile/patient-profile').then(m => m.PatientProfilePage),
    children: [
      { path: '', redirectTo: 'summary', pathMatch: 'full' },
      { path: 'summary', loadComponent: () => import('./patient-profile/tabs/summary-tab').then(m => m.SummaryTab) },
      { path: 'medical', loadComponent: () => import('./patient-profile/tabs/medical-tab').then(m => m.MedicalTab) },
      { path: 'appointments', loadComponent: () => import('./patient-profile/tabs/appointments-tab').then(m => m.AppointmentsTab) },
      { path: 'documents', loadComponent: () => import('./patient-profile/tabs/documents-tab').then(m => m.DocumentsTab) },
      { path: 'billing', loadComponent: () => import('./patient-profile/tabs/billing-tab').then(m => m.BillingTab) },
      { path: 'notes', loadComponent: () => import('./patient-profile/tabs/notes-tab').then(m => m.NotesTab) },
    ],
  },
];
