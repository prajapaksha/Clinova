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
import { EditDemographicsDialog } from '../dialogs/edit-demographics-dialog/edit-demographics-dialog.component';

@Component({
  selector: 'clv-patient-profile',
  standalone: true,
  imports: [
    RouterModule, DatePipe,
    MatButtonModule, MatIconModule, MatMenuModule,
    MatTabsModule, MatProgressSpinnerModule, MatTooltipModule,
    MatDividerModule, MatDialogModule,
  ],
  templateUrl: './patient-profile.component.html',
  styleUrl: './patient-profile.component.scss',
})
export class PatientProfileComponent {
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
