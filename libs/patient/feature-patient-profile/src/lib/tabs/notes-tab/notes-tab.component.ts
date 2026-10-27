import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PatientStore } from '@clinova/patient/data-access';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'clv-notes-tab',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './notes-tab.component.html',
  styleUrl: './notes-tab.component.scss',
})
export class NotesTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}
