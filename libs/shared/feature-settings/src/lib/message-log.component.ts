import { Component } from '@angular/core';
import { NotificationLog } from '@clinova/notifications/feature-messages';

/** Practice-wide delivery log: spot failed or suppressed messages. */
@Component({
  selector: 'clv-message-log',
  imports: [NotificationLog],
  template: `
    <section class="ml">
      <h2>Message log</h2>
      <p>Every email, text and portal notice the practice has sent or scheduled. Failed messages can be sent again.</p>
      <clv-notification-log [showPatient]="true" />
    </section>
  `,
  styles: `
    .ml h2 { margin: 0; font-size: 1.15rem; }
    .ml p { margin: 4px 0 16px; color: var(--clv-gray-600); font-size: 0.875rem; }
  `,
})
export class MessageLogComponent {}