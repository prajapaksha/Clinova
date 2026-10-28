import { Component, computed, inject } from '@angular/core';
import { PatientStore } from '@clinova/patient/data-access';
import { NotificationLog } from '@clinova/notifications/feature-messages';

/** Emails, texts and portal notices sent to the patient (PRD §4.6). */
@Component({
  selector: 'clv-communications-tab',
  imports: [NotificationLog],
  template: `
    @if (patient(); as p) {
      <section class="ct">
        <header>
          <h2>Communications</h2>
          <p>Appointment reminders, bills, receipts and portal notices sent to {{ p.firstName }}. Messages that were not sent show why
            (for example, no email on file or the patient turned that topic off).</p>
        </header>
        <clv-notification-log [patientId]="p.id" />
      </section>
    }
  `,
  styles: `
    .ct { padding: 24px; }
    .ct h2 { margin: 0; font-size: 1.1rem; }
    .ct p { margin: 4px 0 16px; color: var(--clv-gray-600); font-size: 13px; max-width: 760px; }
  `,
})
export class CommunicationsTab {
  private readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}