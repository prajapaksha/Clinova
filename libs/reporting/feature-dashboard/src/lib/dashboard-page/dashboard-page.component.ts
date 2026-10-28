import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, catchError, filter, interval, merge, of, startWith, switchMap, tap } from 'rxjs';
import type { DashboardSummary, RosterEntry } from '@clinova/reporting/domain';
import { NO_SHOW_RATE_TARGET, trendPercent } from '@clinova/reporting/domain';
import { ReportingApiService } from '@clinova/reporting/data-access';
import { SchedulingApiService } from '@clinova/scheduling/data-access';
import type { AppointmentId } from '@clinova/scheduling/domain';
import { AuthService, Permissions } from '@clinova/auth';
import { RosterTableComponent, type RosterAction } from '../roster-table/roster-table.component';
import { AlertsPanelComponent } from '../alerts-panel/alerts-panel.component';
import { WeeklyVolumeComponent } from '../weekly-volume/weekly-volume.component';

const REFRESH_MS = 60_000;
type Scope = 'mine' | 'practice';

/** Role-aware staff home (PRD §6.1): today's KPIs, roster, alerts, and weekly volume. */
@Component({
  selector: 'clv-dashboard-page',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, PercentPipe, RouterModule,
    MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule, MatTooltipModule,
    RosterTableComponent, AlertsPanelComponent, WeeklyVolumeComponent,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPage {
  private readonly api = inject(ReportingApiService);
  private readonly scheduling = inject(SchedulingApiService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);

  protected readonly user = this.auth.currentUser;
  private readonly perms = inject(Permissions);
  protected readonly isPhysician = this.perms.isProvider;
  /** May begin and open encounters from the roster. */
  protected readonly isClinical = computed(() => this.perms.can('clinical:notes', 'write'));
  protected readonly scope = signal<Scope>(this.perms.isProvider() ? 'mine' : 'practice');

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly today = signal(new Date());
  protected readonly noShowTarget = NO_SHOW_RATE_TARGET;

  private readonly refresh$ = new Subject<void>();

  protected readonly greeting = computed(() => {
    const hour = this.today().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const u = this.user();
    if (!u) return part;
    return `${part}, ${this.perms.isProvider() ? 'Dr. ' + u.lastName : u.firstName}`;
  });

  protected readonly appointmentTrend = computed(() => {
    const k = this.summary()?.kpis;
    return k ? trendPercent(k.appointmentsToday, k.appointmentsLastWeek) : null;
  });

  protected readonly checkInRate = computed(() => {
    const k = this.summary()?.kpis;
    return k && k.appointmentsToday > 0 ? k.arrived / k.appointmentsToday : null;
  });

  constructor() {
    merge(
      this.refresh$,
      interval(REFRESH_MS).pipe(filter(() => document.visibilityState === 'visible')),
    ).pipe(
      startWith(undefined),
      tap(() => { this.loading.set(true); this.today.set(new Date()); }),
      switchMap(() => {
        const providerId = this.scope() === 'mine' ? this.user()?.id : undefined;
        return this.api.getDashboard(this.today(), providerId).pipe(
          catchError(() => {
            this.error.set(true);
            return of(null);
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(summary => {
      if (summary) {
        this.summary.set(summary);
        this.error.set(false);
      }
      this.loading.set(false);
    });
  }

  protected refresh(): void {
    this.refresh$.next();
  }

  protected setScope(scope: Scope): void {
    this.scope.set(scope);
    this.refresh();
  }

  protected print(): void {
    window.print();
  }

  protected onRosterAction({ action, entry }: { action: RosterAction; entry: RosterEntry }): void {
    const id = entry.appointmentId as AppointmentId;
    const request = action === 'check-in' ? this.scheduling.checkIn(id) : this.scheduling.markNoShow(id);
    const label = action === 'check-in' ? 'checked in' : 'marked as no-show';
    request.subscribe({
      next: () => {
        this.snack.open(`${entry.patientName} ${label}.`, undefined, { duration: 3000 });
        this.refresh();
      },
      error: () => this.snack.open(`Could not update ${entry.patientName}'s appointment.`, 'Dismiss'),
    });
  }
}
