import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PatientStore } from '@clinova/patient/data-access';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-appointments-tab',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    @if (patient(); as p) {
      <div class="apt">
        <div class="apt__header">
          <h2 class="apt__section-title">Upcoming</h2>
          <button mat-stroked-button
                  [routerLink]="['/calendar']"
                  [queryParams]="{ patientId: p.id }">
            <mat-icon>event</mat-icon> Book Appointment
          </button>
        </div>

        <div class="apt__empty">
          <mat-icon class="apt__empty-icon">calendar_today</mat-icon>
          <p>No upcoming appointments.</p>
          <p class="apt__hint">Appointment data will appear once the scheduling module is connected to this patient's chart.</p>
        </div>

        <h2 class="apt__section-title apt__section-title--past">Past</h2>

        <div class="apt__empty">
          <mat-icon class="apt__empty-icon">history</mat-icon>
          <p>No past appointments.</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .apt {
      padding: 24px;

      &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      &__section-title {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
        color: var(--mat-sys-on-surface-variant, #374151);

        &--past { margin: 32px 0 16px; }
      }

      &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 40px 24px;
        border: 1px dashed var(--mat-sys-outline, #d1d5db);
        border-radius: 8px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant, #9ca3af);
      }

      &__empty-icon {
        font-size: 40px !important;
        width: 40px;
        height: 40px;
        opacity: 0.35;
      }

      &__hint {
        font-size: 0.875rem;
        max-width: 360px;
      }
    }
  `],
})
export class AppointmentsTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}
