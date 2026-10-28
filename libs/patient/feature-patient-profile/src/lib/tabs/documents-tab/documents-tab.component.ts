import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { PatientApiService, PatientStore } from '@clinova/patient/data-access';
import { Permissions } from '@clinova/auth';
import type { PatientId, DocumentId } from '@clinova/patient/domain';
import { DocumentCategory } from '@clinova/patient/domain';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { DocCategoryDialog } from '../../dialogs/doc-category-dialog/doc-category-dialog.component';

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
  templateUrl: './documents-tab.component.html',
  styleUrl: './documents-tab.component.scss',
})
export class DocumentsTab {
  protected readonly store = inject(PatientStore);
  private readonly api = inject(PatientApiService);
  protected readonly perms = inject(Permissions);
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

  protected onFileSelected(event: Event): void {
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
      switchMap((category: DocumentCategory | undefined | null) => {
        if (!category) return EMPTY;
        const patientId = this.patient()?.id;
        if (!patientId) return EMPTY;
        this.uploading.set(true);
        this.uploadError.set(null);
        return this.api.uploadDocument(patientId as PatientId, file, category).pipe(
          catchError((e: { message?: string }) => {
            this.uploadError.set(e?.message ?? 'Upload failed. Please try again.');
            return EMPTY;
          }),
          finalize(() => {
            const pid = this.patient()?.id;
            if (pid) this.store.loadById(pid as PatientId);
            this.uploading.set(false);
          }),
        );
      }),
    ).subscribe();
  }

  protected removeDocument(patientId: string, documentId: string): void {
    this.api.removeDocument(patientId as PatientId, documentId as DocumentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.store.loadById(patientId as PatientId),
      });
  }
}
