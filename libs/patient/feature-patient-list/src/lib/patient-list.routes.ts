import { Route } from '@angular/router';
import { PatientListComponent } from './patient-list/patient-list.component';

export const PATIENT_LIST_ROUTES: Route[] = [
  { path: '', component: PatientListComponent },
];
