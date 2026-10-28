import { SetMetadata } from '@nestjs/common';

export const PATIENT_ROUTE_KEY = 'patientRoute';

/** Portal route: only signed-in patients (scoped to their own record) may call it. */
export const PatientRoute = () => SetMetadata(PATIENT_ROUTE_KEY, true);