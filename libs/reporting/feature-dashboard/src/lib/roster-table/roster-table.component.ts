import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { RosterEntry } from '@clinova/reporting/domain';

export type RosterAction = 'check-in' | 'no-show';

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
};

/** Today's roster with quick actions (check in, begin encounter, no-show). */
@Component({
  selector: 'clv-roster-table',
  standalone: true,
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './roster-table.component.html',
  styleUrl: './roster-table.component.scss',
})
export class RosterTableComponent {
  readonly entries = input.required<ReadonlyArray<RosterEntry>>();
  readonly isClinical = input(false);
  readonly showProvider = input(true);
  readonly action = output<{ action: RosterAction; entry: RosterEntry }>();

  protected statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  protected canCheckIn(e: RosterEntry): boolean {
    return e.status === 'SCHEDULED' || e.status === 'CONFIRMED';
  }

  /** No-show only makes sense once the appointment time has passed. */
  protected canMarkNoShow(e: RosterEntry): boolean {
    return this.canCheckIn(e) && new Date(e.start).getTime() < Date.now();
  }

  protected emit(action: RosterAction, entry: RosterEntry): void {
    this.action.emit({ action, entry });
  }
}
