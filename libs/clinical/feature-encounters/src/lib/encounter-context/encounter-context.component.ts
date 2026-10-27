import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Encounter } from '@clinova/clinical/domain';
import { VitalType, formatBloodPressure, vitalsToRecord } from '@clinova/clinical/domain';
import type { Patient } from '@clinova/patient/domain';
import { AlertSeverity } from '@clinova/patient/domain';

/** Read-only patient context shown beside the note: allergies, medications, last vitals. */
@Component({
  selector: 'clv-encounter-context',
  standalone: true,
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './encounter-context.component.html',
  styleUrl: './encounter-context.component.scss',
})
export class EncounterContextComponent {
  readonly patient = input.required<Patient>();
  /** Recent encounters for the patient, newest first. */
  readonly history = input<Encounter[]>([]);
  readonly currentEncounterId = input<string | null>(null);

  protected readonly criticalAllergies = computed(() =>
    this.patient().allergies.filter(a => a.severity === AlertSeverity.Critical));
  protected readonly otherAllergies = computed(() =>
    this.patient().allergies.filter(a => a.severity !== AlertSeverity.Critical));

  protected readonly ageYears = computed(() => {
    const birth = new Date(this.patient().dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
    return age;
  });

  /** Most recent vitals recorded in an earlier encounter. */
  protected readonly lastVitals = computed(() => {
    const prior = this.history().find(e => e.id !== this.currentEncounterId() && e.vitals.length > 0);
    if (!prior) return null;
    const record = vitalsToRecord(prior.vitals);
    return {
      date: prior.vitals[0].recordedAt ?? prior.createdAt,
      bp: formatBloodPressure(record),
      hr: record[VitalType.HeartRate] ?? null,
      temp: record[VitalType.Temperature] ?? null,
      spo2: record[VitalType.OxygenSaturation] ?? null,
    };
  });
}
