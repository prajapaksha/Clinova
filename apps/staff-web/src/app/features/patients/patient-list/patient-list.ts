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
  template: `
    <div class="pl">

      <div class="pl__header">
        <div>
          <h1 class="pl__title">Patients</h1>
          <p class="pl__subtitle">{{ store.total() }} patients</p>
        </div>
        <button mat-flat-button routerLink="new">
          <mat-icon>person_add</mat-icon>
          New Patient
        </button>
      </div>

      <div class="pl__toolbar">
        <mat-form-field appearance="outline" class="pl__search">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput placeholder="Search by name, MRN, DOB or phone…" [formControl]="searchCtrl" />
          @if (searchCtrl.value) {
            <button matSuffix mat-icon-button aria-label="Clear" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>

        <mat-chip-listbox [value]="statusFilter()" (change)="onStatusChange($event.value)" aria-label="Patient status">
          <mat-chip-option value="active">Active</mat-chip-option>
          <mat-chip-option value="archived">Archived</mat-chip-option>
          <mat-chip-option value="all">All</mat-chip-option>
        </mat-chip-listbox>
      </div>

      @if (store.error()) {
        <div class="pl__banner pl__banner--error">
          <mat-icon>error_outline</mat-icon>
          <span>{{ store.error() }}</span>
        </div>
      }

      @if (store.loading()) {
        <div class="pl__center"><mat-spinner diameter="40" /></div>
      } @else if (store.entities().length === 0) {
        <div class="pl__empty">
          <mat-icon class="pl__empty-icon">person_search</mat-icon>
          @if (searchCtrl.value) {
            <p>No patients match <strong>{{ searchCtrl.value }}</strong>.</p>
            <button mat-stroked-button (click)="clearSearch()">Clear search</button>
          } @else {
            <p>No patients yet.</p>
            <button mat-flat-button routerLink="new">Register first patient</button>
          }
        </div>
      } @else {
        <table mat-table [dataSource]="store.entities()" class="pl__table mat-elevation-z1">

          <ng-container matColumnDef="mrn">
            <th mat-header-cell *matHeaderCellDef>MRN</th>
            <td mat-cell *matCellDef="let p"><code class="pl__mrn">{{ p.mrn }}</code></td>
          </ng-container>

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Patient</th>
            <td mat-cell *matCellDef="let p">
              <div class="pl__name-cell">
                <span class="pl__name">{{ p.firstName }} {{ p.lastName }}</span>
                @if (p.preferredName) {
                  <span class="pl__preferred">"{{ p.preferredName }}"</span>
                }
                @if (p.isVip) {
                  <mat-icon class="pl__vip" matTooltip="VIP patient">star</mat-icon>
                }
                @if (p.alerts?.length) {
                  <mat-icon class="pl__alert-icon" [matTooltip]="p.alerts.length + ' active alert(s)'">warning</mat-icon>
                }
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="dob">
            <th mat-header-cell *matHeaderCellDef>Date of Birth</th>
            <td mat-cell *matCellDef="let p">{{ p.dateOfBirth | date:'mediumDate' }}</td>
          </ng-container>

          <ng-container matColumnDef="phone">
            <th mat-header-cell *matHeaderCellDef>Phone</th>
            <td mat-cell *matCellDef="let p">{{ p.contact?.primaryPhone ?? '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="insurance">
            <th mat-header-cell *matHeaderCellDef>Insurance</th>
            <td mat-cell *matCellDef="let p">{{ p.insurancePolicies?.[0]?.provider ?? '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="chevron">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let p">
              <mat-icon class="pl__chevron">chevron_right</mat-icon>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let p; columns: columns;"
              class="pl__row"
              [class.pl__row--archived]="p.isArchived"
              (click)="openChart(p.id)"></tr>
        </table>
      }

    </div>
  `,
  styleUrl: './patient-list.scss',
})
export class PatientListPage implements OnInit {
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
