import { Component, computed, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Permissions } from '@clinova/auth';
import { InboxCounts } from '@clinova/portal/data-access';
import { Conversations } from './conversations';
import { RefillRequests } from './refill-requests';
import { ProfileChanges } from './profile-changes';

type Tab = 'conversations' | 'refills' | 'updates';

/** Staff Messages: patient conversations, refill requests and profile updates from the portal. */
@Component({
  selector: 'clv-inbox-page',
  imports: [RouterModule, MatIconModule, MatTabsModule, Conversations, RefillRequests, ProfileChanges],
  template: `
    <div class="ib">
      <header class="ib__head">
        <h1>Messages</h1>
        <p>Secure messages and requests from the patient portal.</p>
      </header>
      <nav mat-tab-nav-bar [tabPanel]="panel" mat-stretch-tabs="false" class="ib__tabs" aria-label="Inbox sections">
        @for (t of tabs(); track t.key) {
          <a mat-tab-link [active]="active() === t.key" [routerLink]="[]" [queryParams]="{ tab: t.key === 'conversations' ? null : t.key, thread: null }">
            {{ t.label }}@if (t.count) { <span class="ib__count">{{ t.count }}</span> }
          </a>
        }
      </nav>
      <mat-tab-nav-panel #panel>
        @switch (active()) {
          @case ('refills') { <clv-refill-requests (changed)="counts.refresh()" /> }
          @case ('updates') { <clv-profile-changes (changed)="counts.refresh()" /> }
          @default { <clv-conversations [threadId]="thread()" (changed)="counts.refresh()" /> }
        }
      </mat-tab-nav-panel>
    </div>
  `,
  styles: `
    .ib { padding: 24px; }
    .ib__head h1 { margin: 0; font-size: 1.5rem; }
    .ib__head p { margin: 4px 0 12px; color: var(--clv-gray-600); }
    .ib__tabs { margin-bottom: 16px; }
    .ib__count { margin-left: 6px; min-width: 20px; padding: 0 6px; border-radius: 999px; background: var(--clv-primary-700); color: #fff; font-size: 11px; line-height: 18px; text-align: center; }
  `,
})
export class InboxPage {
  private readonly perms = inject(Permissions);
  protected readonly counts = inject(InboxCounts);

  readonly tab = input<string>();
  readonly thread = input<string>();

  protected readonly tabs = computed(() => {
    const c = this.counts.counts();
    return [
      { key: 'conversations' as Tab, label: 'Conversations', count: c.unreadThreads },
      ...(this.perms.can('clinical:prescriptions') ? [{ key: 'refills' as Tab, label: 'Refill requests', count: c.pendingRefills }] : []),
      ...(this.perms.can('patient:profiles', 'write') ? [{ key: 'updates' as Tab, label: 'Profile updates', count: c.pendingChanges }] : []),
    ];
  });
  protected readonly active = computed<Tab>(() => this.tabs().find(t => t.key === this.tab())?.key ?? 'conversations');

  constructor() {
    this.counts.refresh();
  }

}