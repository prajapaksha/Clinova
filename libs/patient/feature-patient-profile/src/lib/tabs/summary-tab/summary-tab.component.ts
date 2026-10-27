import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { PatientStore } from '@clinova/patient/data-access';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'clv-summary-tab',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, MatCardModule, MatIconModule, MatDividerModule, MatChipsModule],
  templateUrl: './summary-tab.component.html',
  styleUrl: './summary-tab.component.scss',
})
export class SummaryTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}
