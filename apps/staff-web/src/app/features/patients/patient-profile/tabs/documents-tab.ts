import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PatientApiService, PatientStore } from '@clinova/patient/data-access';
import type { PatientId, DocumentId } from '@clinova/patient/domain';
import { DocumentCategory } from '@clinova/patient/domain';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { switchMap } from 'rxjs';

// ── Category Picker Dialog ─────────────────────────────────────────────────

@Component({
  selector: 'clv-doc-category-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Select Document Category</h2>
    <mat-dialog-content>
      <p class="dcd__hint">Choose the category for <strong>{{ data.fileName }}</strong></p>
      <div class="dcd__grid">
        @for (opt of categories; track opt.value) {
          <button mat-stroked-button
                  class="dcd__cat"
                  [class.dcd__cat--active]="selected() === opt.value"
                  (click)="selected.set(opt.value)">
            <mat-icon>{{ opt.icon }}</mat-icon>
            <span>{{ opt.label }}</span>
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Cancel</button>
      <button mat-flat-button [mat-dialog-close]="selected()">Upload</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dcd__hint { margin: 0 0 16px; font-size: 0.875rem; color: var(--mat-sys-on-surface-variant, #555); }
    .dcd__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
      padding-bottom: 8px;
    }
    .dcd__cat {
      display: flex; flex-direction: column; align-items: center;
      gap: 6px; padding: 12px 8px; height: auto;
      mat-icon { font-size: 1.5rem; width: 1.5rem; height: 1.5rem; }
      span { font-size: 0.8125rem; }
    }
    .dcd__cat--active {
      background: var(--mat-sys-primary-container, #e8f5e9) !important;
      border-color: var(--mat-sys-primary, #00796b) !important;
      color: var(--mat-sys-primary, #00796b);
    }
  `],
})
class DocCategoryDialog {
  protected readonly data = inject<{ fileName: string }>(MAT_DIALOG_DATA);
  protected readonly selected = signal<DocumentCategory>(DocumentCategory.Other);
  protected readonly categories = [
    { value: DocumentCategory.ConsentForm,  label: 'Consent Form',  icon: 'gavel' },
    { value: DocumentCategory.LabReport,    label: 'Lab Report',    icon: 'biotech' },
    { value: DocumentCategory.Referral,     label: 'Referral',      icon: 'outgoing_mail' },
    { value: DocumentCategory.Imaging,      label: 'Imaging',       icon: 'radiology' },
    { value: DocumentCategory.PriorRecord,  label: 'Prior Record',  icon: 'history_edu' },
    { value: DocumentCategory.Insurance,    label: 'Insurance',     icon: 'health_and_safety' },
    { value: DocumentCategory.Other,        label: 'Other',         icon: 'attach_file' },
  ];
}

// ── Main Component ─────────────────────────────────────────────────────────

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
  imports: [
    DatePipe, TitleCasePipe,
    MatButtonModule, MatIconModule, MatChipsModule, MatCardModule,
    MatTooltipModule, MatProgressSpinnerModule, MatMenuModule,
  ],
  template: `
    <input #fileInput type="file" style="display:none" multiple accept=".pdf,.jpg,.jpeg,.png"
           (change)="onFileSelected($event)" />
    @if (patient(); as p) {
      <div class="doc">

        <div class="doc__header">
          <div>
            <h2 class="doc__title">Documents</h2>
            <p class="doc__subtitle">{{ p.documents.length }} file(s)</p>
          </div>
          <button mat-flat-button (click)="triggerUpload()" [disabled]="uploading()">
            @if (uploading()) {
              <mat-spinner diameter="18" />
            } @else {
              <ng-container><mat-icon>upload</mat-icon> Upload</ng-container>
            }
          </button>
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

        @if (uploadError()) {
          <div class="doc__error">
            <mat-icon>error_outline</mat-icon>{{ uploadError() }}
          </div>
        }

        <!-- Document Grid -->
        @if (filteredDocs().length === 0) {
          <div class="doc__empty">
            <mat-icon class="doc__empty-icon">folder_open</mat-icon>
            <p>No documents uploaded yet.</p>
            <p class="doc__hint">Supported formats: PDF, JPG, PNG.</p>
            <button mat-stroked-button (click)="triggerUpload()">
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
                <button mat-icon-button class="doc__card-more" [matMenuTriggerFor]="docMenu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #docMenu>
                  <button mat-menu-item (click)="removeDocument(p.id, d.id)">
                    <mat-icon>delete_outline</mat-icon> Remove
                  </button>
                </mat-menu>
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

      &__error {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; background: #fef2f2; border-radius: 6px;
        color: #dc2626; margin-bottom: 16px; font-size: 0.875rem;
      }

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
  private readonly fileInputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly store = inject(PatientStore);
  private readonly api = inject(PatientApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly patient = computed(() => this.store.selectedPatient());
  protected readonly categoryFilter = signal('');
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);

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

  protected triggerUpload(): void {
    this.fileInputRef().nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const patientId = this.patient()?.id;
    if (!patientId) return;

    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    const file = files[0];
    const ref = this.dialog.open(DocCategoryDialog, {
      data: { fileName: file.name },
      width: '420px',
    });

    ref.afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((category: DocumentCategory | null) => {
        if (!category) throw new Error('cancelled');
        this.uploading.set(true);
        this.uploadError.set(null);
        return this.api.uploadDocument(patientId as PatientId, file, category);
      }),
    ).subscribe({
      next: () => {
        this.store.loadById(patientId as PatientId);
        this.uploading.set(false);
      },
      error: (e: Error) => {
        if (e.message !== 'cancelled') {
          this.uploadError.set(e.message ?? 'Upload failed. Please try again.');
        }
        this.uploading.set(false);
      },
    });
  }

  protected removeDocument(patientId: string, documentId: string): void {
    this.api.removeDocument(patientId as PatientId, documentId as DocumentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.store.loadById(patientId as PatientId),
      });
  }
}
