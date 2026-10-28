import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PortalApiService } from '@clinova/portal/data-access';
import type { HealthSummary, PortalDocument, PortalMedication, RefillRequest, VisitSummaryListItem } from '@clinova/portal/domain';
import { errorMessage, openBlob } from '../shared/portal-shared';

type Tab = 'visits' | 'documents' | 'medications';

@Component({
  selector: 'clv-portal-records',
  imports: [DatePipe, FormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './records.page.html',
  styleUrl: './records.page.scss',
})
export class PortalRecordsPage {
  private readonly api = inject(PortalApiService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  readonly tab = input<string>();
  protected readonly active = computed<Tab>(() => (['visits', 'documents', 'medications'].includes(this.tab() ?? '') ? this.tab() as Tab : 'visits'));

  protected readonly visits = signal<VisitSummaryListItem[] | null>(null);
  protected readonly documents = signal<PortalDocument[] | null>(null);
  protected readonly health = signal<HealthSummary | null>(null);
  protected readonly refills = signal<RefillRequest[]>([]);
  protected readonly error = signal<string | null>(null);

  protected readonly results = computed(() => (this.documents() ?? []).filter(d => d.isResult));
  protected readonly otherDocs = computed(() => (this.documents() ?? []).filter(d => !d.isResult));

  protected readonly refillFor = signal<PortalMedication | null>(null);
  protected pharmacy = '';
  protected refillNote = '';
  protected readonly busy = signal(false);

  constructor() {
    this.api.visits().subscribe({ next: v => this.visits.set(v), error: err => this.error.set(errorMessage(err)) });
    this.api.documents().subscribe({ next: d => this.documents.set(d), error: err => this.error.set(errorMessage(err)) });
    this.loadHealth();
  }

  protected setTab(tab: Tab): void {
    this.router.navigate([], { queryParams: { tab: tab === 'visits' ? null : tab }, replaceUrl: true });
  }

  protected open(doc: PortalDocument, download = false): void {
    this.api.documentFile(doc.id).subscribe({
      next: blob => {
        openBlob(blob, doc.name, download);
        this.documents.update(list => list?.map(d => (d.id === doc.id ? { ...d, isNew: false } : d)) ?? null);
      },
      error: err => this.snack.open(errorMessage(err, 'This document could not be opened.'), 'OK', { duration: 5000 }),
    });
  }

  protected refillStatus(m: PortalMedication): RefillRequest | undefined {
    return this.refills().find(r => r.prescriptionId === m.prescriptionId);
  }

  protected startRefill(m: PortalMedication): void {
    this.refillFor.set(m);
    this.pharmacy = this.refills()[0]?.pharmacy ?? '';
    this.refillNote = '';
  }

  protected sendRefill(): void {
    const m = this.refillFor();
    if (!m?.prescriptionId) return;
    this.busy.set(true);
    this.api.requestRefill({ prescriptionId: m.prescriptionId, pharmacy: this.pharmacy.trim() || undefined, note: this.refillNote.trim() || undefined }).subscribe({
      next: () => {
        this.busy.set(false);
        this.refillFor.set(null);
        this.snack.open('Refill request sent. Your doctor will review it, usually within 2 business days.', 'OK', { duration: 6000 });
        this.loadHealth();
      },
      error: err => {
        this.busy.set(false);
        this.snack.open(errorMessage(err), 'OK', { duration: 5000 });
      },
    });
  }

  protected fileSize(bytes: number): string {
    return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  private loadHealth(): void {
    this.api.health().subscribe({ next: h => this.health.set(h), error: err => this.error.set(errorMessage(err)) });
    this.api.refills().subscribe({ next: r => this.refills.set(r) });
  }
}
