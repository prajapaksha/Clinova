import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { PatientApiService, PatientStore } from '@clinova/patient/data-access';
import type { PatientId } from '@clinova/patient/domain';
import { AlertSeverity } from '@clinova/patient/domain';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { EditDemographicsDialog } from './edit-demographics-dialog';
import { AddAllergyDialog } from './add-allergy-dialog';

@Component({
  selector: 'clv-patient-profile',
  standalone: true,
  imports: [
    RouterModule, DatePipe,
    MatButtonModule, MatIconModule, MatMenuModule,
    MatTabsModule, MatProgressSpinnerModule, MatTooltipModule,
    MatDividerModule, MatDialogModule,
  ],
  template: `
    @if (store.error() && !patient()) {
      <div class="pp__error">
        <mat-icon class="pp__error-icon">person_off</mat-icon>
        <p>Patient not found or could not be loaded.</p>
        <button mat-stroked-button routerLink="/patients">Back to list</button>
      </div>
    } @else if (!patient()) {
      <div class="pp__loading"><mat-spinner diameter="48" /></div>
    } @else {

      <!-- Critical Allergy Banner -->
      @if (criticalAllergies().length) {
        <div class="pp__allergy-banner" role="alert">
          <mat-icon>warning</mat-icon>
          <strong>CRITICAL ALLERGY:</strong>
          @for (a of criticalAllergies(); track a.id) {
            <span class="pp__allergy-item">{{ a.allergen }} — {{ a.reaction }}</span>
          }
        </div>
      }

      <!-- Archive Confirmation Banner -->
      @if (confirmingArchive()) {
        <div class="pp__archive-confirm" role="alertdialog">
          <mat-icon>archive</mat-icon>
          <span>Archive this patient record? They will be hidden from active lists.</span>
          <div class="pp__archive-actions">
            <button mat-button (click)="confirmingArchive.set(false)">Cancel</button>
            <button mat-flat-button class="pp__archive-btn" [disabled]="archiving()" (click)="doArchive()">
              @if (archiving()) { <mat-spinner diameter="16" /> } @else { Archive }
            </button>
          </div>
        </div>
      }

      <!-- Profile Header -->
      <div class="pp__header">
        <div class="pp__avatar" [style.background-color]="avatarColor(patient()!.id)">
          {{ patient()!.firstName[0] }}{{ patient()!.lastName[0] }}
        </div>

        <div class="pp__identity">
          <h1 class="pp__name">
            {{ patient()!.firstName }}
            @if (patient()!.middleName) { {{ patient()!.middleName }} }
            {{ patient()!.lastName }}
            @if (patient()!.title) { <span class="pp__title-prefix">{{ patient()!.title }}</span> }
          </h1>
          <div class="pp__badges">
            @if (patient()!.preferredName) {
              <span class="pp__badge pp__badge--preferred">"{{ patient()!.preferredName }}"</span>
            }
            @if (patient()!.pronouns) {
              <span class="pp__badge pp__badge--pronouns">{{ patient()!.pronouns }}</span>
            }
            @if (patient()!.isVip) {
              <span class="pp__badge pp__badge--vip">
                <mat-icon>star</mat-icon> VIP
              </span>
            }
            @if (patient()!.isArchived) {
              <span class="pp__badge pp__badge--archived">Archived</span>
            }
          </div>
          <div class="pp__meta">
            <code class="pp__mrn">{{ patient()!.mrn }}</code>
            <span class="pp__sep">·</span>
            <span>{{ patient()!.dateOfBirth | date:'mediumDate' }}</span>
            <span class="pp__sep">·</span>
            <span>Age {{ age() }}</span>
            <span class="pp__sep">·</span>
            <span>{{ patient()!.sex }}</span>
          </div>
        </div>

        <div class="pp__actions">
          <button mat-stroked-button
                  [routerLink]="['/calendar']"
                  [queryParams]="{ patientId: patient()!.id }">
            <mat-icon>event</mat-icon>
            Book Appointment
          </button>
          <button mat-icon-button [matMenuTriggerFor]="moreMenu" matTooltip="More actions">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #moreMenu>
            <button mat-menu-item (click)="openEditDemographics()">
              <mat-icon>edit</mat-icon> Edit demographics
            </button>
            <button mat-menu-item>
              <mat-icon>merge_type</mat-icon> Merge duplicate records
            </button>
            <mat-divider />
            @if (!patient()!.isArchived) {
              <button mat-menu-item class="pp__menu-danger" (click)="confirmingArchive.set(true)">
                <mat-icon>archive</mat-icon> Archive patient
              </button>
            }
          </mat-menu>
        </div>
      </div>

      <!-- Tab Navigation -->
      <nav mat-tab-nav-bar [tabPanel]="tabPanel" color="primary" class="pp__tabs">
        <a mat-tab-link routerLink="summary" routerLinkActive #s="routerLinkActive" [active]="s.isActive">
          <mat-icon class="pp__tab-icon">person</mat-icon> Summary
        </a>
        <a mat-tab-link routerLink="medical" routerLinkActive #med="routerLinkActive" [active]="med.isActive">
          <mat-icon class="pp__tab-icon">medical_services</mat-icon> Medical
          @if (criticalAllergies().length) {
            <span class="pp__tab-badge">!</span>
          }
        </a>
        <a mat-tab-link routerLink="appointments" routerLinkActive #apt="routerLinkActive" [active]="apt.isActive">
          <mat-icon class="pp__tab-icon">calendar_today</mat-icon> Appointments
        </a>
        <a mat-tab-link routerLink="documents" routerLinkActive #doc="routerLinkActive" [active]="doc.isActive">
          <mat-icon class="pp__tab-icon">folder</mat-icon> Documents
          @if (patient()!.documents.length) {
            <span class="pp__tab-count">{{ patient()!.documents.length }}</span>
          }
        </a>
        <a mat-tab-link routerLink="billing" routerLinkActive #bil="routerLinkActive" [active]="bil.isActive">
          <mat-icon class="pp__tab-icon">receipt_long</mat-icon> Billing
        </a>
        <a mat-tab-link routerLink="notes" routerLinkActive #notes="routerLinkActive" [active]="notes.isActive">
          <mat-icon class="pp__tab-icon">clinical_notes</mat-icon> Notes
        </a>
      </nav>
      <mat-tab-nav-panel #tabPanel>
        <router-outlet />
      </mat-tab-nav-panel>

    }
  `,
  styleUrl: './patient-profile.scss',
})
export class PatientProfilePage {
  protected readonly store = inject(PatientStore);
  private readonly api = inject(PatientApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input<string>('');

  protected readonly patient = computed(() => this.store.selectedPatient());
  protected readonly confirmingArchive = signal(false);
  protected readonly archiving = signal(false);

  protected readonly age = computed(() => {
    const dob = this.patient()?.dateOfBirth;
    if (!dob) return 0;
    const today = new Date();
    const birth = new Date(dob);
    let a = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
    return a;
  });

  protected readonly criticalAllergies = computed(() =>
    this.patient()?.allergies.filter(a => a.severity === AlertSeverity.Critical) ?? []
  );

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) {
        this.store.selectPatient(id);
        this.store.loadById(id as unknown as PatientId);
      }
    });
  }

  protected openEditDemographics(): void {
    const p = this.patient();
    if (!p) return;
    this.dialog.open(EditDemographicsDialog, {
      data: p,
      maxWidth: '680px',
      width: '100%',
    });
  }

  protected doArchive(): void {
    const p = this.patient();
    if (!p) return;
    this.archiving.set(true);
    this.api.archive(p.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.router.navigate(['/patients']),
      error: () => {
        this.archiving.set(false);
        this.confirmingArchive.set(false);
      },
    });
  }

  protected avatarColor(id: string): string {
    const palette = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#7c3aed', '#0284c7'];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }
}
