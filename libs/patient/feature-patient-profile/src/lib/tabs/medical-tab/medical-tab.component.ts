import { Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { PatientApiService, PatientStore } from '@clinova/patient/data-access';
import type { AllergyId, PatientId } from '@clinova/patient/domain';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AddAllergyDialog } from '../../dialogs/add-allergy-dialog/add-allergy-dialog.component';

@Component({
  selector: 'clv-medical-tab',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatChipsModule, MatListModule, MatButtonModule, MatTooltipModule],
  templateUrl: './medical-tab.component.html',
  styleUrl: './medical-tab.component.scss',
})
export class MedicalTab {
  protected readonly store = inject(PatientStore);
  private readonly api = inject(PatientApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly patient = computed(() => this.store.selectedPatient());

  protected openAddAllergy(patientId: string): void {
    this.dialog.open(AddAllergyDialog, {
      data: patientId as PatientId,
      maxWidth: '560px',
      width: '100%',
    });
  }

  protected removeAllergy(patientId: string, allergyId: string): void {
    this.api.removeAllergy(patientId as PatientId, allergyId as AllergyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.store.loadById(patientId as PatientId),
      });
  }
}
