import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, filter, of, startWith, switchMap } from 'rxjs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { PortalApiService } from '@clinova/portal/data-access';
import type { PortalNotification } from '@clinova/notifications/domain';

const ICONS: Record<string, string> = {
  INVOICE_ISSUED: 'receipt_long', PAYMENT_RECEIPT: 'paid', DOCUMENT_AVAILABLE: 'description', RESULTS_READY: 'science',
  REFILL_APPROVED: 'medication', REFILL_DENIED: 'medication', MESSAGE_RECEIVED: 'chat', PROFILE_UPDATE_REVIEWED: 'badge',
};

/** Patient portal inbox of notices (PRD §4.6 "patient portal inbox"). */
@Component({
  selector: 'clv-portal-notifications',
  imports: [DatePipe, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" [attr.aria-label]="'Notifications, ' + unread() + ' unread'"
            [matBadge]="unread() || null" matBadgeColor="warn" matBadgeSize="small">
      <mat-icon>notifications_none</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      <div class="pn__head" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="presentation">
        <strong>Notifications</strong>
        @if (unread()) { <button mat-button type="button" (click)="markAll()">Mark all read</button> }
      </div>
      @for (n of items(); track n.id) {
        <button mat-menu-item class="pn__item" [class.pn__item--unread]="!n.read" (click)="open(n)">
          <mat-icon>{{ icons[n.type] ?? 'notifications' }}</mat-icon>
          <span class="pn__text">
            <span class="pn__title">{{ n.title }}</span>
            @if (n.body) { <span class="pn__body">{{ n.body }}</span> }
            <span class="pn__time">{{ n.createdAt | date:'MMM d, h:mm a' }}</span>
          </span>
        </button>
      } @empty {
        <p class="pn__empty">No notifications yet.</p>
      }
    </mat-menu>
  `,
  styles: `
    .pn__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 4px 12px 4px 16px; min-width: 300px; }
    .pn__item { height: auto !important; min-height: 60px; padding-top: 10px !important; padding-bottom: 10px !important; }
    .pn__item--unread { background: var(--clv-primary-50); }
    .pn__text { display: flex; flex-direction: column; line-height: 1.35; white-space: normal; max-width: 290px; }
    .pn__title { font-weight: 600; font-size: 14px; }
    .pn__body { font-size: 13px; color: var(--clv-gray-600); }
    .pn__time { font-size: 12px; color: var(--clv-gray-500); }
    .pn__empty { margin: 0; padding: 14px 16px; color: var(--clv-gray-600); }
  `,
})
export class PortalNotificationsMenu {
  private readonly api = inject(PortalApiService);
  private readonly router = inject(Router);

  protected readonly icons = ICONS;
  protected readonly items = signal<PortalNotification[]>([]);
  protected readonly unread = signal(0);

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null),
      switchMap(() => this.api.notifications().pipe(catchError(() => of(null)))),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(r => {
      if (!r) return;
      this.items.set(r.items);
      this.unread.set(r.unread);
    });
  }

  protected open(n: PortalNotification): void {
    if (!n.read) {
      this.api.markNotificationsRead(n.id).subscribe();
      this.items.update(list => list.map(i => (i.id === n.id ? { ...i, read: true } : i)));
      this.unread.update(u => Math.max(0, u - 1));
    }
    if (n.link) this.router.navigateByUrl(n.link);
  }

  protected markAll(): void {
    this.api.markNotificationsRead().subscribe(() => {
      this.items.update(list => list.map(i => ({ ...i, read: true })));
      this.unread.set(0);
    });
  }
}
