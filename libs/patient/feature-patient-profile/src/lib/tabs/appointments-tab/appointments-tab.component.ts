import { Component, computed, effect, inject } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PatientStore } from '@clinova/patient/data-access';
import { SchedulingStore } from '@clinova/scheduling/data-access';
import { BookAppointmentDialog } from '@clinova/scheduling/feature-calendar';

@Component({
  selector: 'clv-appointments-tab',
  standalone: true,
  imports: [
    DatePipe, TitleCasePipe, RouterModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './appointments-tab.component.html',
  styleUrl: './appointments-tab.component.scss',
})
export class AppointmentsTab {
  protected readonly patientStore = inject(PatientStore);
  protected readonly store = inject(SchedulingStore);
  private readonly dialog = inject(MatDialog);

  protected readonly patient = computed(() => this.patientStore.selectedPatient());

  protected readonly upcoming = computed(() => {
    const now = new Date();
    return this.store.entities()
      .filter(a => new Date(a.slot.start) >= now
        && a.status !== 'CANCELLED'
        && a.status !== 'NO_SHOW')
      .sort((a, b) => new Date(a.slot.start).getTime() - new Date(b.slot.start).getTime());
  });

  protected readonly past = computed(() => {
    const now = new Date();
    return this.store.entities()
      .filter(a => new Date(a.slot.start) < now
        || a.status === 'CANCELLED'
        || a.status === 'NO_SHOW'
        || a.status === 'COMPLETED')
      .sort((a, b) => new Date(b.slot.start).getTime() - new Date(a.slot.start).getTime())
      .slice(0, 10);
  });

  constructor() {
    effect(() => {
      const p = this.patient();
      if (p) {
        this.store.loadAppointments({ patientId: p.id });
        this.store.loadAppointmentTypes();
        this.store.loadProviders();
      }
    });
  }

  protected openBookDialog(): void {
    const p = this.patient();
    this.dialog.open(BookAppointmentDialog, {
      data: { prefilledPatient: p },
      width: '540px',
    });
  }
}
