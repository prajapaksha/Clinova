import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import type { PermissionRule } from '@clinova/identity/domain';
import { AuthService, ChangePasswordDialog, ChangePasswordDialogData, IdleTimeout, Permissions } from '@clinova/auth';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Shown when the user satisfies any rule; always shown when omitted. */
  rules?: PermissionRule[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',  icon: 'dashboard',      route: '/dashboard' },
  { label: 'Calendar',   icon: 'calendar_month', route: '/calendar',   rules: [{ capability: 'scheduling:appointments', access: 'read' }] },
  { label: 'Patients',   icon: 'people',         route: '/patients',   rules: [{ capability: 'patient:profiles', access: 'read' }] },
  { label: 'Encounters', icon: 'assignment',     route: '/encounters', rules: [{ capability: 'clinical:notes', access: 'read' }] },
  { label: 'Billing',    icon: 'receipt_long',   route: '/billing',    rules: [{ capability: 'billing:invoices', access: 'read' }] },
  { label: 'Reports',    icon: 'bar_chart',      route: '/reports',    rules: [{ capability: 'reporting:reports', access: 'read' }] },
  { label: 'Staff',      icon: 'badge',          route: '/staff',      rules: [{ capability: 'staff:profiles', access: 'read' }] },
  { label: 'Messages',   icon: 'forum',          route: '/messages' },
  { label: 'Settings',   icon: 'settings',       route: '/settings',   rules: [{ capability: 'system:settings', access: 'read' }, { capability: 'identity:auditLogs', access: 'read' }] },
];

const QUICK_CREATE: NavItem[] = [
  { label: 'New Patient',     icon: 'person_add', route: '/patients/new',         rules: [{ capability: 'patient:profiles', access: 'write' }] },
  { label: 'New Appointment', icon: 'event',      route: '/calendar/new',         rules: [{ capability: 'scheduling:appointments', access: 'write' }] },
  { label: 'New Invoice',     icon: 'receipt',    route: '/billing/invoices/new', rules: [{ capability: 'billing:invoices', access: 'full' }] },
  { label: 'New Encounter',   icon: 'assignment', route: '/encounters/new',       rules: [{ capability: 'clinical:notes', access: 'write' }] },
];

@Component({
  selector: 'clv-shell',
  standalone: true,
  imports: [
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatBadgeModule,
    MatMenuModule,
  ],
  template: `
    <mat-sidenav-container class="shell-container">

      <!-- ── Sidebar ──────────────────────────────────────────────────── -->
      <mat-sidenav
        #sidenav
        mode="side"
        [opened]="true"
        [class.shell-sidebar--collapsed]="collapsed()"
        class="shell-sidebar">

        <!-- Logo -->
        <div class="shell-sidebar__logo">
          <mat-icon class="shell-sidebar__logo-icon">local_hospital</mat-icon>
          @if (!collapsed()) {
            <span class="shell-sidebar__logo-text">Clinova</span>
          }
        </div>

        <!-- Navigation -->
        <nav class="shell-sidebar__nav" aria-label="Main navigation">
          @for (item of navItems(); track item.route) {
            <a
              class="shell-sidebar__nav-item"
              [routerLink]="item.route"
              routerLinkActive="shell-sidebar__nav-item--active"
              [matTooltip]="collapsed() ? item.label : ''"
              matTooltipPosition="right"
              [attr.aria-label]="item.label">
              <mat-icon>{{ item.icon }}</mat-icon>
              @if (!collapsed()) {
                <span>{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        <!-- Collapse toggle -->
        <button
          mat-icon-button
          class="shell-sidebar__collapse-btn"
          (click)="toggleCollapse()"
          [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
          <mat-icon>{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
      </mat-sidenav>

      <!-- ── Main Content ──────────────────────────────────────────────── -->
      <mat-sidenav-content class="shell-content">

        <!-- Top bar -->
        <mat-toolbar class="shell-topbar" role="banner">

          <!-- Global patient search (/) -->
          <div class="shell-topbar__search" role="search">
            <mat-icon class="shell-topbar__search-icon">search</mat-icon>
            <input
              class="shell-topbar__search-input"
              placeholder="Search patients (name, MRN, DOB…)"
              aria-label="Global patient search"
              (keydown)="onSearchShortcut($event, searchInput)"
              #searchInput />
            <kbd class="shell-topbar__search-kbd">/</kbd>
          </div>

          <span class="shell-topbar__spacer"></span>

          <!-- Quick create -->
          @if (quickCreate().length) {
            <button mat-stroked-button [matMenuTriggerFor]="quickCreateMenu" aria-label="Quick create">
              <mat-icon>add</mat-icon>
              New
            </button>
            <mat-menu #quickCreateMenu="matMenu">
              @for (item of quickCreate(); track item.route) {
                <button mat-menu-item [routerLink]="item.route"><mat-icon>{{ item.icon }}</mat-icon>{{ item.label }}</button>
              }
            </mat-menu>
          }

          <!-- Notifications -->
          <button mat-icon-button aria-label="Notifications"
            [matBadge]="unreadCount() || null"
            matBadgeColor="warn">
            <mat-icon>notifications</mat-icon>
          </button>

          <!-- Help -->
          <button mat-icon-button aria-label="Help and keyboard shortcuts">
            <mat-icon>help_outline</mat-icon>
          </button>

          <!-- User menu -->
          <button mat-button class="shell-user" [matMenuTriggerFor]="userMenu" aria-label="User menu">
            <span class="shell-user__avatar" aria-hidden="true">{{ initials() }}</span>
            <span class="shell-user__text">
              <span class="shell-user__name">{{ userName() }}</span>
              <span class="shell-user__role">{{ perms.roleLabel() }}</span>
            </span>
          </button>
          <mat-menu #userMenu="matMenu" xPosition="before">
            <a mat-menu-item [routerLink]="['/staff', user()?.id]"><mat-icon>person</mat-icon>My profile</a>
            <button mat-menu-item (click)="changePassword()"><mat-icon>key</mat-icon>Change password</button>
            <button mat-menu-item (click)="auth.signOut()"><mat-icon>logout</mat-icon>Sign out</button>
          </mat-menu>

        </mat-toolbar>

        <!-- Page content -->
        <main class="shell-main" id="main-content">
          <router-outlet />
        </main>

      </mat-sidenav-content>
    </mat-sidenav-container>

    @if (idle.secondsLeft(); as seconds) {
      <div class="shell-idle" role="alertdialog" aria-live="assertive" aria-labelledby="idle-title">
        <div class="shell-idle__card">
          <mat-icon class="shell-idle__icon">timer</mat-icon>
          <h2 id="idle-title">Are you still there?</h2>
          <p>For patient privacy you'll be signed out in <strong>{{ seconds }}</strong> second{{ seconds === 1 ? '' : 's' }}.</p>
          <div class="shell-idle__actions">
            <button mat-button (click)="auth.signOut()">Sign out now</button>
            <button mat-flat-button color="primary" (click)="idle.extend()">Stay signed in</button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './shell.scss',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly perms = inject(Permissions);
  protected readonly idle = inject(IdleTimeout);
  private readonly dialog = inject(MatDialog);

  protected readonly user = this.auth.currentUser;
  protected readonly navItems = computed(() => NAV_ITEMS.filter(i => this.visible(i)));
  protected readonly quickCreate = computed(() => QUICK_CREATE.filter(i => this.visible(i)));
  protected readonly userName = computed(() => {
    const u = this.user();
    return u ? `${this.perms.isProvider() ? 'Dr. ' : ''}${u.firstName} ${u.lastName}` : '';
  });
  protected readonly initials = computed(() => {
    const u = this.user();
    return u ? `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase() : '';
  });
  protected readonly collapsed = signal(false);
  protected readonly unreadCount = signal(0);

  private passwordDialog: MatDialogRef<ChangePasswordDialog> | null = null;

  constructor() {
    this.idle.start(inject(DestroyRef));
    // A temporary or expired password must be replaced before continuing.
    effect(() => {
      if (this.auth.passwordExpired()) untracked(() => this.openPasswordDialog({ required: true }));
    });
  }

  protected changePassword(): void {
    this.openPasswordDialog({});
  }

  protected toggleCollapse(): void {
    this.collapsed.update(v => !v);
  }

  protected onSearchShortcut(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === '/') {
      event.preventDefault();
      input.focus();
    }
  }

  private visible(item: NavItem): boolean {
    return !item.rules || this.perms.canAny(item.rules);
  }

  private openPasswordDialog(data: ChangePasswordDialogData): void {
    if (this.passwordDialog) return;
    this.passwordDialog = this.dialog.open<ChangePasswordDialog, ChangePasswordDialogData>(ChangePasswordDialog, {
      data,
      disableClose: !!data.required,
      autoFocus: 'first-tabbable',
    });
    this.passwordDialog.afterClosed().subscribe(() => (this.passwordDialog = null));
  }
}