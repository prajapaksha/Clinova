import { Component, computed, inject } from '@angular/core';
import { PatientStore } from '@clinova/patient/data-access';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-billing-tab',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './billing-tab.component.html',
  styleUrl: './billing-tab.component.scss',
})
export class BillingTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}
