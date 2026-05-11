import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PatientStore } from '@clinova/patient/data-access';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'clv-notes-tab',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule],
  template: `
    @if (patient(); as p) {
      <div class="notes">
        <div class="notes__header">
          <h2 class="notes__title">Clinical Notes</h2>
          <button mat-stroked-button routerLink="/encounters/new" [queryParams]="{ patientId: p.id }">
            <mat-icon>add</mat-icon> New Encounter
          </button>
        </div>

        <div class="notes__empty">
          <mat-icon class="notes__empty-icon">clinical_notes</mat-icon>
          <p>No clinical notes on record.</p>
          <p class="notes__hint">Encounter notes written by providers will appear here once the clinical module is connected.</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .notes {
      padding: 24px;

      &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      }

      &__title { font-size: 1rem; font-weight: 600; margin: 0; }

      &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 48px 24px;
        border: 1px dashed var(--mat-sys-outline, #d1d5db);
        border-radius: 8px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant, #9ca3af);
      }

      &__empty-icon {
        font-size: 48px !important;
        width: 48px;
        height: 48px;
        opacity: 0.3;
      }

      &__hint { font-size: 0.875rem; max-width: 360px; }
    }
  `],
})
export class NotesTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}
