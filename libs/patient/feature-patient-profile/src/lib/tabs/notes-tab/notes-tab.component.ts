import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PatientStore } from '@clinova/patient/data-access';
import { ClinicalApiService } from '@clinova/clinical/data-access';
import type { Encounter } from '@clinova/clinical/domain';
import { isEncounterEditable } from '@clinova/clinical/domain';

/** Chronological encounter timeline for the selected patient (PRD §4.4 "Note History"). */
@Component({
  selector: 'clv-notes-tab',
  standalone: true,
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './notes-tab.component.html',
  styleUrl: './notes-tab.component.scss',
})
export class NotesTab {
  protected readonly store = inject(PatientStore);
  private readonly clinicalApi = inject(ClinicalApiService);

  protected readonly patient = computed(() => this.store.selectedPatient());
  protected readonly encounters = signal<Encounter[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly isEditable = isEncounterEditable;

  constructor() {
    effect(() => {
      const p = this.patient();
      if (!p) return;
      this.loading.set(true);
      this.error.set(false);
      this.clinicalApi.getEncounters({ patientId: p.id, limit: 100 }).subscribe({
        next: r => {
          this.encounters.set(r.encounters);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
    });
  }

  protected primaryDiagnosis(enc: Encounter): string | null {
    const dx = enc.note.assessment.diagnoses.find(d => d.isPrimary) ?? enc.note.assessment.diagnoses[0];
    return dx ? `${dx.code.code} · ${dx.code.description}` : null;
  }
}