import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, startWith, switchMap, catchError, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { IdleTimeout } from '@clinova/auth';
import { PortalApiService, PortalSession } from '@clinova/portal/data-access';
import { PATIENT_IDLE_TIMEOUT_MINUTES } from '@clinova/portal/domain';
import { PortalNotificationsMenu } from './portal-notifications';

interface NavLink {
  label: string;
  short: string;
  icon: string;
  route: string;
  exact?: boolean;
}

const NAV: NavLink[] = [
  { label: 'Home', short: 'Home', icon: 'home', route: '/', exact: true },
  { label: 'Appointments', short: 'Visits', icon: 'event', route: '/appointments' },
  { label: 'Health records', short: 'Records', icon: 'folder_shared', route: '/records' },
  { label: 'Billing', short: 'Billing', icon: 'receipt_long', route: '/billing' },
  { label: 'Messages', short: 'Messages', icon: 'chat_bubble_outline', route: '/messages' },
];

@Component({
  selector: 'clv-portal-shell',
  imports: [RouterModule, MatButtonModule, MatIconModule, MatMenuModule, PortalNotificationsMenu],
  templateUrl: './portal-shell.html',
  styleUrl: './portal-shell.scss',
})
export class PortalShell {
  protected readonly session = inject(PortalSession);
  protected readonly idle = inject(IdleTimeout);
  private readonly api = inject(PortalApiService);

  protected readonly nav = NAV;
  protected readonly user = this.session.user;
  protected readonly initials = computed(() => {
    const u = this.user();
    return u ? `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase() : '';
  });
  protected readonly unread = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.idle.start(destroyRef, {
      timeoutMs: PATIENT_IDLE_TIMEOUT_MINUTES * 60_000,
      onTimeout: () => this.session.signOut('idle'),
    });
    inject(Router).events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null),
      switchMap(() => this.api.threads().pipe(catchError(() => of([])))),
      takeUntilDestroyed(destroyRef),
    ).subscribe(threads => this.unread.set(threads.filter(t => t.unread).length));
  }
}
