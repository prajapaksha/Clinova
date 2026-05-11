import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Encounter, EncounterId, EncounterStatus, EncounterFilters,
  Prescription, PrescriptionId, EncounterTemplate, TemplateId,
  VitalMeasurement, SoapNote,
} from '@clinova/clinical/domain';

export interface StartEncounterDto {
  appointmentId: string;
  patientId: string;
  providerId: string;
  templateId?: TemplateId;
}

export interface UpdateNoteDto {
  note?: Partial<SoapNote>;
  vitals?: VitalMeasurement[];
}

export interface IssuePrescriptionDto {
  drug: {
    medicationName: string;
    strength: string;
    form: string;
    route: string;
    dosageAmount: string;
    frequency: string;
    durationDays?: number;
  };
  refillsAllowed: number;
  instructions?: string;
}

function toHttpParams(filters: EncounterFilters): HttpParams {
  let p = new HttpParams();
  if (filters.patientId) p = p.set('patientId', filters.patientId);
  if (filters.providerId) p = p.set('providerId', filters.providerId);
  if (filters.dateRange) {
    p = p.set('from', filters.dateRange.from.toISOString());
    p = p.set('to', filters.dateRange.to.toISOString());
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    statuses.forEach(s => p = p.append('status', s));
  }
  if (filters.limit) p = p.set('limit', String(filters.limit));
  if (filters.offset) p = p.set('offset', String(filters.offset));
  return p;
}

@Injectable({ providedIn: 'root' })
export class ClinicalApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/encounters';

  getEncounters(filters: EncounterFilters = {}): Observable<{ encounters: Encounter[]; total: number }> {
    return this.http.get<{ encounters: Encounter[]; total: number }>(this.base, { params: toHttpParams(filters) });
  }

  findById(id: EncounterId): Observable<Encounter> {
    return this.http.get<Encounter>(`${this.base}/${id}`);
  }

  findByAppointment(appointmentId: string): Observable<Encounter | null> {
    return this.http.get<Encounter | null>(`${this.base}/by-appointment/${appointmentId}`);
  }

  start(dto: StartEncounterDto): Observable<Encounter> {
    return this.http.post<Encounter>(this.base, dto);
  }

  updateNote(id: EncounterId, dto: UpdateNoteDto): Observable<Encounter> {
    return this.http.patch<Encounter>(`${this.base}/${id}`, dto);
  }

  sign(id: EncounterId): Observable<Encounter> {
    return this.http.post<Encounter>(`${this.base}/${id}/sign`, {});
  }

  addAddendum(id: EncounterId, content: string): Observable<Encounter> {
    return this.http.post<Encounter>(`${this.base}/${id}/addenda`, { content });
  }

  issuePrescription(encounterId: EncounterId, dto: IssuePrescriptionDto): Observable<Prescription> {
    return this.http.post<Prescription>(`${this.base}/${encounterId}/prescriptions`, dto);
  }

  updatePrescription(prescriptionId: PrescriptionId, updates: Partial<IssuePrescriptionDto>): Observable<Prescription> {
    return this.http.patch<Prescription>(`/api/prescriptions/${prescriptionId}`, updates);
  }

  getTemplates(filters?: { specialty?: string; isShared?: boolean }): Observable<EncounterTemplate[]> {
    const params: Record<string, string> = {};
    if (filters?.specialty) params['specialty'] = filters.specialty;
    if (filters?.isShared != null) params['isShared'] = String(filters.isShared);
    return this.http.get<EncounterTemplate[]>('/api/encounter-templates', { params });
  }

  saveTemplate(template: Omit<EncounterTemplate, 'id'>): Observable<EncounterTemplate> {
    return this.http.post<EncounterTemplate>('/api/encounter-templates', template);
  }

  searchIcd10(query: string): Observable<Array<{ code: string; description: string }>> {
    return this.http.get<Array<{ code: string; description: string }>>('/api/icd10/search', { params: { q: query } });
  }

  searchDrugs(query: string): Observable<Array<{ name: string; form: string; strength: string }>> {
    return this.http.get<Array<{ name: string; form: string; strength: string }>>('/api/drugs/search', { params: { q: query } });
  }
}
