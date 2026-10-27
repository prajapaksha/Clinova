import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import type { Encounter } from '@clinova/clinical/domain';
import { EncounterStatus } from '@clinova/clinical/domain';
import { ClinicalStore } from '@clinova/clinical/data-access';
import { AuthService } from '@clinova/auth';

type StatusFilter = 'unsigned' | 'signed' | 'all';

const STATUS_FILTERS: Record<StatusFilter, EncounterStatus[] | undefined> = {
  unsigned: [EncounterStatus.Draft, EncounterStatus.InProgress],
  signed: [EncounterStatus.Signed, EncounterStatus.Amended],
  all: undefined,
};

@Component({
  selector: 'clv-encounters-page',
  standalone: true,
  imports: [
    DatePipe, RouterModule, MatButtonToggleModule, MatIconModule, MatPaginatorModule,
    MatProgressSpinnerModule, MatSlideToggleModule, MatTableModule,
  ],
  templateUrl: './encounters-page.component.html',
  styleUrl: './encounters-page.component.scss',
})
export class EncountersPage {
  protected readonly store = inject(ClinicalStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly columns = ['date', 'patient', 'provider', 'complaint', 'diagnosis', 'status'];
  protected readonly statusFilter = signal<StatusFilter>('unsigned');
  protected readonly onlyMine = signal(this.auth.currentUser()?.role === 'PHYSICIAN');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);

  protected readonly isPhysician = computed(() => this.auth.currentUser()?.role === 'PHYSICIAN');

  constructor() {
    effect(() => {
      const userId = this.auth.currentUser()?.id;
      this.store.loadEncounters({
        status: STATUS_FILTERS[this.statusFilter()],
        providerId: this.onlyMine() && userId ? userId : undefined,
        limit: this.pageSize(),
        offset: this.pageIndex() * this.pageSize(),
      });
    });
  }

  protected setStatus(filter: StatusFilter): void {
    this.statusFilter.set(filter);
    this.pageIndex.set(0);
  }

  protected setOnlyMine(value: boolean): void {
    this.onlyMine.set(value);
    this.pageIndex.set(0);
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected open(enc: Encounter): void {
    this.router.navigate(['/encounters', enc.id]);
  }

  protected primaryDiagnosis(enc: Encounter): string {
    const dx = enc.note.assessment.diagnoses.find(d => d.isPrimary) ?? enc.note.assessment.diagnoses[0];
    return dx ? `${dx.code.code} · ${dx.code.description}` : '—';
  }

  protected statusLabel(status: EncounterStatus): string {
    return status === EncounterStatus.InProgress ? 'In progress' : status.charAt(0) + status.slice(1).toLowerCase();
  }
}
