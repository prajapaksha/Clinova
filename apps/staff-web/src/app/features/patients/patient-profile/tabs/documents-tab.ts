import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { PatientStore } from '@clinova/patient/data-access';
import { DocumentCategory } from '@clinova/patient/domain';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';

const CATEGORY_ICONS: Record<string, string> = {
  CONSENT_FORM: 'gavel',
  LAB_REPORT: 'biotech',
  REFERRAL: 'outgoing_mail',
  IMAGING: 'radiology',
  PRIOR_RECORD: 'history_edu',
  INSURANCE: 'health_and_safety',
  OTHER: 'attach_file',
};

@Component({
  selector: 'clv-documents-tab',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, MatButtonModule, MatIconModule, MatChipsModule, MatCardModule, MatTooltipModule],
  template: `
    @if (patient(); as p) {
      <div class="doc">

        <div class="doc__header">
          <div>
            <h2 class="doc__title">Documents</h2>
            <p class="doc__subtitle">{{ p.documents.length }} file(s)</p>
          </div>
          <button mat-flat-button (click)="fileInput.click()">
            <mat-icon>upload</mat-icon> Upload
          </button>
          <input #fileInput type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png"
                 (change)="onFileSelected($event, p.id)" />
        </div>

        <!-- Category Filter -->
        @if (p.documents.length > 0) {
          <mat-chip-listbox [value]="categoryFilter()" (change)="categoryFilter.set($event.value)" class="doc__filter">
            <mat-chip-option value="">All</mat-chip-option>
            @for (cat of availableCategories(); track cat) {
              <mat-chip-option [value]="cat">{{ cat | titlecase }}</mat-chip-option>
            }
          </mat-chip-listbox>
        }

        <!-- Document Grid -->
        @if (filteredDocs().length === 0) {
          <div class="doc__empty">
            <mat-icon class="doc__empty-icon">folder_open</mat-icon>
            <p>No documents uploaded yet.</p>
            <p class="doc__hint">Supported formats: PDF, JPG, PNG.</p>
            <button mat-stroked-button (click)="fileInput.click()">
              <mat-icon>upload</mat-icon> Upload first document
            </button>
          </div>
        } @else {
          <div class="doc__grid">
            @for (d of filteredDocs(); track d.id) {
              <div class="doc__card mat-elevation-z1">
                <div class="doc__card-icon">
                  <mat-icon>{{ iconFor(d.category) }}</mat-icon>
                </div>
                <div class="doc__card-body">
                  <div class="doc__card-name" [matTooltip]="d.name">{{ d.name }}</div>
                  <div class="doc__card-meta">
                    <span class="doc__tag">{{ d.category }}</span>
                    <span>{{ formatSize(d.sizeBytes) }}</span>
                    <span>{{ d.uploadedAt | date:'mediumDate' }}</span>
                  </div>
                </div>
                <button mat-icon-button class="doc__card-more" [matTooltip]="'Options'">
                  <mat-icon>more_vert</mat-icon>
                </button>
              </div>
            }
          </div>
        }

      </div>
    }
  `,
  styles: [`
    .doc {
      padding: 24px;

      &__header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 20px;
        & > div { flex: 1; }
      }

      &__title { font-size: 1rem; font-weight: 600; margin: 0 0 4px; }
      &__subtitle { font-size: 0.875rem; color: var(--mat-sys-on-surface-variant, #666); margin: 0; }

      &__filter { margin-bottom: 20px; }

      &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
      }

      &__card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        background: white;
        transition: box-shadow 0.15s;
        &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
      }

      &__card-icon {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: var(--mat-sys-primary-container, #e8f5e9);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--mat-sys-primary, #00796b);
      }

      &__card-body { flex: 1; min-width: 0; }

      &__card-name {
        font-weight: 500;
        font-size: 0.875rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &__card-meta {
        display: flex;
        gap: 6px;
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant, #9ca3af);
        margin-top: 2px;
        flex-wrap: wrap;
        align-items: center;
      }

      &__tag {
        background: var(--mat-sys-surface-container, #f3f4f6);
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 0.6875rem;
        text-transform: uppercase;
      }

      &__card-more { flex-shrink: 0; }

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

      &__hint { font-size: 0.875rem; }
    }
  `],
})
export class DocumentsTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
  protected readonly categoryFilter = signal('');

  protected readonly availableCategories = computed(() => {
    const cats = new Set(this.patient()?.documents.map(d => d.category) ?? []);
    return [...cats];
  });

  protected readonly filteredDocs = computed(() => {
    const docs = this.patient()?.documents ?? [];
    const f = this.categoryFilter();
    return f ? docs.filter(d => d.category === f) : docs;
  });

  protected iconFor(category: string): string {
    return CATEGORY_ICONS[category] ?? 'attach_file';
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected onFileSelected(event: Event, patientId: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    // File upload wiring — store.uploadDocument() will be called here
    // once the upload category selection dialog is implemented
    console.info('Files selected for patient', patientId, Array.from(input.files ?? []));
    input.value = '';
  }
}
