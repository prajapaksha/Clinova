import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Patient, PatientId, MRN,
  Allergy, AllergyId, PatientDocument, DocumentId,
  PatientSearchFilters,
} from '@clinova/patient/domain';

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  contact: {
    primaryPhone: string;
    email?: string;
    mailingAddress: { street1: string; city: string; state: string; postalCode: string; country: string };
  };
}

export interface UpdatePatientDto {
  title?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  preferredName?: string | null;
  pronouns?: string | null;
  dateOfBirth?: string;
  sex?: string;
  genderIdentity?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  preferredLanguage?: string;
  ethnicity?: string | null;
  bloodType?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  isVip?: boolean;
  contact?: Partial<Patient['contact']>;
  emergencyContacts?: Array<{ name: string; relationship: string; phone: string }>;
  chronicConditions?: string[];
  currentMedications?: string[];
}

function toHttpParams(filters: PatientSearchFilters): HttpParams {
  let p = new HttpParams();
  if (filters.query) p = p.set('query', filters.query);
  if (filters.isArchived != null) p = p.set('isArchived', String(filters.isArchived));
  if (filters.providerId) p = p.set('providerId', filters.providerId);
  if (filters.limit) p = p.set('limit', String(filters.limit));
  if (filters.offset) p = p.set('offset', String(filters.offset));
  return p;
}

@Injectable({ providedIn: 'root' })
export class PatientApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/patients';

  search(filters: PatientSearchFilters = {}): Observable<{ patients: Patient[]; total: number }> {
    return this.http.get<{ patients: Patient[]; total: number }>(this.base, { params: toHttpParams(filters) });
  }

  findById(id: PatientId): Observable<Patient> {
    return this.http.get<Patient>(`${this.base}/${id}`);
  }

  findByMrn(mrn: MRN): Observable<Patient> {
    return this.http.get<Patient>(`${this.base}/mrn/${mrn}`);
  }

  create(dto: CreatePatientDto): Observable<Patient> {
    return this.http.post<Patient>(this.base, dto);
  }

  update(id: PatientId, dto: UpdatePatientDto): Observable<Patient> {
    return this.http.patch<Patient>(`${this.base}/${id}`, dto);
  }

  archive(id: PatientId): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addAllergy(id: PatientId, allergy: Omit<Allergy, 'id'>): Observable<Allergy> {
    return this.http.post<Allergy>(`${this.base}/${id}/allergies`, allergy);
  }

  removeAllergy(id: PatientId, allergyId: AllergyId): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/allergies/${allergyId}`);
  }

  uploadDocument(id: PatientId, file: File, category: string): Observable<PatientDocument> {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    return this.http.post<PatientDocument>(`${this.base}/${id}/documents`, form);
  }

  removeDocument(id: PatientId, documentId: DocumentId): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/documents/${documentId}`);
  }
}
