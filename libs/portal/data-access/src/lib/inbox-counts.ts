import { inject, Injectable, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import type { InboxSummary } from './care-team.api';
import { CareTeamApiService } from './care-team.api';

/** Care-team inbox counts, shared by the staff nav badge and the Messages page. */
@Injectable({ providedIn: 'root' })
export class InboxCounts {
  private readonly api = inject(CareTeamApiService);
  readonly counts = signal<InboxSummary>({ unreadThreads: 0, pendingRefills: 0, pendingChanges: 0 });

  refresh(): void {
    this.api.summary().pipe(catchError(() => of(null))).subscribe(c => {
      if (c) this.counts.set(c);
    });
  }

  total(): number {
    const c = this.counts();
    return c.unreadThreads + c.pendingRefills + c.pendingChanges;
  }
}