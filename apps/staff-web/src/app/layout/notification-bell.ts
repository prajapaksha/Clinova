import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NotificationsApiService } from '@clinova/notifications/data-access';
import type { StaffNotificationItem } from '@clinova/notifications/domain';

const KIND_ICON: Record<string, string> = { PATIENT_MESSAGE: 'forum', REFILL_REQUEST: 'medication', PROFILE_UPDATE: 'manage_accounts' };

/** In-app notification center (PRD §4.6: bell icon with unread count). */
@Component({
  selector: 'clv-notification-bell',
  imports: [DatePipe, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" (menuOpened)="refresh()" [attr.aria-label]="'Notifications, ' + unread() + ' unread'"
            [matBadge]="unread() || null" matBadgeColor="warn" matBadgeSize="small">
      <mat-icon>notifications</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before" class="nb-menu">
      <div class="nb__head" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="presentation">
        <strong>Notifications</strong>
        @if (unread()) { <button mat-button type="button" (click)="markAll()">Mark all read</button> }
      </div>
      @for (n of items(); track n.id) {
        <button mat-menu-item class="nb__item" [class.nb__item--unread]="!n.read" (click)="open(n)">
          <mat-icon>{{ icon(n.kind) }}</mat-icon>
          <span class="nb__text">
            <span class="nb__title">{{ n.title }}</span>
            <span class="nb__body">{{ n.body }}</span>
            <span class="nb__time">{{ n.createdAt | date:'MMM d, h:mm a' }}</span>
          </span>
        </button>
      } @empty {
        <p class="nb__empty">You're all caught up.</p>
      }
    </mat-menu>
  `,
  styles: `
    .nb__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 4px 12px 4px 16px; min-width: 320px; }
    .nb__item { height: auto !important; min-height: 56px; padding-top: 8px !important; padding-bottom: 8px !important; }
    .nb__item--unread { background: var(--clv-primary-50); }
    .nb__text { display: flex; flex-direction: column; line-height: 1.3; white-space: normal; max-width: 300px; }
    .nb__title { font-weight: 500; font-size: 13px; }
    .nb__body { font-size: 12px; color: var(--clv-gray-600); }
    .nb__time { font-size: 11px; color: var(--clv-gray-500); }
    .nb__empty { padding: 12px 16px; margin: 0; color: var(--clv-gray-600); font-size: 13px; }
  `,
})
export class NotificationBell {
  private readonly api = inject(NotificationsApiService);
  private readonly router = inject(Router);

  protected readonly items = signal<StaffNotificationItem[]>([]);
  protected readonly unread = signal(0);

  constructor() {
    timer(0, 60_000).pipe(
      switchMap(() => this.api.mine().pipe(catchError(() => of(null)))),
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(r => this.apply(r));
  }

  protected refresh(): void {
    this.api.mine().subscribe(r => this.apply(r));
  }

  protected icon(kind: string): string {
    return KIND_ICON[kind] ?? 'notifications';
  }

  protected open(n: StaffNotificationItem): void {
    if (!n.read) this.api.markRead(n.id).subscribe(() => this.refresh());
    if (n.link) this.router.navigateByUrl(n.link);
  }

  protected markAll(): void {
    this.api.markRead().subscribe(() => this.refresh());
  }

  private apply(r: { items: StaffNotificationItem[]; unread: number } | null): void {
    if (!r) return;
    this.items.set(r.items);
    this.unread.set(r.unread);
  }
}
