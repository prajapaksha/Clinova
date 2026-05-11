import { Component, computed, inject } from '@angular/core';
import { PatientStore } from '@clinova/patient/data-access';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'clv-medical-tab',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatChipsModule, MatListModule, MatButtonModule],
  template: `
    @if (patient(); as p) {
      <div class="med">

        <!-- Vitals Strip -->
        <div class="med__vitals">
          <div class="med__vital">
            <span class="med__vital-label">Blood Type</span>
            <strong class="med__vital-value">{{ p.bloodType }}</strong>
          </div>
          @if (p.heightCm) {
            <div class="med__vital">
              <span class="med__vital-label">Height</span>
              <strong class="med__vital-value">{{ p.heightCm }} cm</strong>
            </div>
          }
          @if (p.weightKg) {
            <div class="med__vital">
              <span class="med__vital-label">Weight</span>
              <strong class="med__vital-value">{{ p.weightKg }} kg</strong>
            </div>
          }
        </div>

        <!-- Allergies -->
        <mat-card class="med__card">
          <mat-card-header>
            <mat-card-title class="med__card-title med__card-title--warn">
              <mat-icon>warning</mat-icon>Allergies
              <span class="med__count">{{ p.allergies.length }} recorded</span>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (p.allergies.length === 0) {
              <p class="med__empty">No allergies recorded.</p>
            } @else {
              <div class="med__allergy-list">
                @for (a of p.allergies; track a.id) {
                  <div class="med__allergy" [attr.data-severity]="a.severity">
                    <div class="med__allergy-top">
                      <strong>{{ a.allergen }}</strong>
                      <span class="med__severity" [attr.data-severity]="a.severity">{{ a.severity }}</span>
                    </div>
                    <div class="med__allergy-meta">
                      <span class="med__tag">{{ a.type }}</span>
                      <span>Reaction: {{ a.reaction }}</span>
                      @if (a.notes) { <span class="med__notes">{{ a.notes }}</span> }
                    </div>
                  </div>
                }
              </div>
            }
          </mat-card-content>
          <mat-card-actions>
            <button mat-button><mat-icon>add</mat-icon> Add Allergy</button>
          </mat-card-actions>
        </mat-card>

        <!-- Chronic Conditions -->
        <mat-card class="med__card">
          <mat-card-header>
            <mat-card-title class="med__card-title"><mat-icon>monitor_heart</mat-icon>Chronic Conditions</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (p.chronicConditions.length === 0) {
              <p class="med__empty">None recorded.</p>
            } @else {
              <mat-chip-set>
                @for (c of p.chronicConditions; track c) {
                  <mat-chip>{{ c }}</mat-chip>
                }
              </mat-chip-set>
            }
          </mat-card-content>
        </mat-card>

        <!-- Current Medications -->
        <mat-card class="med__card">
          <mat-card-header>
            <mat-card-title class="med__card-title"><mat-icon>medication</mat-icon>Current Medications</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (p.currentMedications.length === 0) {
              <p class="med__empty">None recorded.</p>
            } @else {
              <mat-list>
                @for (m of p.currentMedications; track m) {
                  <mat-list-item>
                    <mat-icon matListItemIcon>pill</mat-icon>
                    <span matListItemTitle>{{ m }}</span>
                  </mat-list-item>
                }
              </mat-list>
            }
          </mat-card-content>
          <mat-card-actions>
            <button mat-button><mat-icon>add</mat-icon> Add Medication</button>
          </mat-card-actions>
        </mat-card>

        <!-- Past Surgeries -->
        <mat-card class="med__card">
          <mat-card-header>
            <mat-card-title class="med__card-title"><mat-icon>healing</mat-icon>Past Surgeries</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (p.pastSurgeries.length === 0) {
              <p class="med__empty">None recorded.</p>
            } @else {
              <mat-list>
                @for (s of p.pastSurgeries; track s) {
                  <mat-list-item><span matListItemTitle>{{ s }}</span></mat-list-item>
                }
              </mat-list>
            }
          </mat-card-content>
        </mat-card>

        <!-- Family History -->
        <mat-card class="med__card">
          <mat-card-header>
            <mat-card-title class="med__card-title"><mat-icon>family_restroom</mat-icon>Family History</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (p.familyHistory.length === 0) {
              <p class="med__empty">None recorded.</p>
            } @else {
              <mat-chip-set>
                @for (f of p.familyHistory; track f) {
                  <mat-chip>{{ f }}</mat-chip>
                }
              </mat-chip-set>
            }
          </mat-card-content>
        </mat-card>

        <!-- Immunizations -->
        <mat-card class="med__card">
          <mat-card-header>
            <mat-card-title class="med__card-title"><mat-icon>vaccines</mat-icon>Immunization Log</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (p.immunizationLog.length === 0) {
              <p class="med__empty">No immunizations recorded.</p>
            } @else {
              <mat-list>
                @for (imm of p.immunizationLog; track imm) {
                  <mat-list-item>
                    <mat-icon matListItemIcon>check_circle</mat-icon>
                    <span matListItemTitle>{{ imm }}</span>
                  </mat-list-item>
                }
              </mat-list>
            }
          </mat-card-content>
        </mat-card>

      </div>
    }
  `,
  styles: [`
    .med {
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 16px;
      align-items: start;

      &__vitals {
        grid-column: 1 / -1;
        display: flex;
        gap: 32px;
        padding: 16px 20px;
        background: var(--mat-sys-surface-container, #f9fafb);
        border-radius: 8px;
        flex-wrap: wrap;
      }

      &__vital { display: flex; flex-direction: column; gap: 4px; }
      &__vital-label {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant, #6b7280);
      }
      &__vital-value { font-size: 1.5rem; font-weight: 600; }

      &__card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1rem !important;
        font-weight: 500;
        mat-icon {
          font-size: 1.125rem;
          width: 1.125rem;
          height: 1.125rem;
          color: var(--mat-sys-primary, #00796b);
        }
        &--warn mat-icon { color: #dc2626; }
      }

      &__count {
        margin-left: 4px;
        font-size: 0.75rem;
        font-weight: 400;
        color: var(--mat-sys-on-surface-variant, #6b7280);
      }

      &__allergy-list { display: flex; flex-direction: column; gap: 10px; }

      &__allergy {
        padding: 12px;
        border-radius: 6px;
        border-left: 4px solid #e5e7eb;

        &[data-severity="CRITICAL"] { border-color: #dc2626; background: rgba(220,38,38,.06); }
        &[data-severity="HIGH"]     { border-color: #d97706; background: rgba(217,119,6,.06); }
        &[data-severity="MEDIUM"]   { border-color: #eab308; background: rgba(234,179,8,.06); }
        &[data-severity="LOW"]      { border-color: #3b82f6; background: rgba(59,130,246,.06); }
      }

      &__allergy-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }

      &__severity {
        display: inline-block;
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        color: white;
        &[data-severity="CRITICAL"] { background: #dc2626; }
        &[data-severity="HIGH"]     { background: #d97706; }
        &[data-severity="MEDIUM"]   { background: #eab308; color: #713f12; }
        &[data-severity="LOW"]      { background: #3b82f6; }
      }

      &__allergy-meta {
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant, #555);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      &__tag {
        display: inline-block;
        font-size: 0.75rem;
        background: var(--mat-sys-surface-container, #f3f4f6);
        padding: 1px 6px;
        border-radius: 4px;
        width: fit-content;
      }

      &__notes { font-style: italic; }

      &__empty {
        color: var(--mat-sys-on-surface-variant, #9ca3af);
        font-style: italic;
        padding: 4px 0;
        margin: 0;
      }
    }
  `],
})
export class MedicalTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}
