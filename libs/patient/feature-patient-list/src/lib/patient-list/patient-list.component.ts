import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PatientStore } from '@clinova/patient/data-access';
import type { PatientSearchFilters } from '@clinova/patient/domain';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

type StatusFilter = 'active' | 'archived' | 'all';

@Component({
  selector: 'clv-patient-list',
  standalone: true,
  imports: [
    RouterModule, ReactiveFormsModule, DatePipe,
    MatTableModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatChipsModule, MatTooltipModule,
  ],
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.scss',
})
export class PatientListComponent implements OnInit {
  protected readonly store = inject(PatientStore);
  private readonly router = inject(Router);

  protected readonly columns = ['mrn', 'name', 'dob', 'phone', 'insurance', 'chevron'];
  protected readonly searchCtrl = new FormControl('', { nonNullable: true });
  protected readonly statusFilter = signal<StatusFilter>('active');

  ngOnInit(): void {
    this.loadPatients();
    this.searchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(() => this.loadPatients());
  }

  protected onStatusChange(value: StatusFilter): void {
    this.statusFilter.set(value ?? 'active');
    this.loadPatients();
  }

  protected clearSearch(): void {
    this.searchCtrl.setValue('');
  }

  protected openChart(id: string): void {
    this.router.navigate(['/patients', id]);
  }

  private loadPatients(): void {
    const filters: PatientSearchFilters = {
      query: this.searchCtrl.value || undefined,
    };
    if (this.statusFilter() === 'active') filters.isArchived = false;
    else if (this.statusFilter() === 'archived') filters.isArchived = true;
    this.store.search(filters);
  }
}
