import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        icon: 'dashboard',        route: '/dashboard' },
  { label: 'Calendar',         icon: 'calendar_month',   route: '/calendar' },
  { label: 'Patients',         icon: 'people',           route: '/patients' },
  { label: 'Encounters',       icon: 'clinical_notes',   route: '/encounters' },
  { label: 'Billing',          icon: 'receipt_long',     route: '/billing' },
  { label: 'Reports',          icon: 'bar_chart',        route: '/reports' },
  { label: 'Staff',            icon: 'badge',            route: '/staff' },
  { label: 'Messages',         icon: 'forum',            route: '/messages' },
  { label: 'Settings',         icon: 'settings',         route: '/settings' },
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
          @for (item of navItems; track item.route) {
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
          <button mat-stroked-button [matMenuTriggerFor]="quickCreateMenu" aria-label="Quick create">
            <mat-icon>add</mat-icon>
            New
          </button>
          <mat-menu #quickCreateMenu="matMenu">
            <button mat-menu-item routerLink="/patients/new"><mat-icon>person_add</mat-icon>New Patient</button>
            <button mat-menu-item routerLink="/calendar/new"><mat-icon>event</mat-icon>New Appointment</button>
            <button mat-menu-item routerLink="/billing/invoices/new"><mat-icon>receipt</mat-icon>New Invoice</button>
            <button mat-menu-item routerLink="/encounters/new"><mat-icon>clinical_notes</mat-icon>New Encounter</button>
          </mat-menu>

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
          <button mat-icon-button [matMenuTriggerFor]="userMenu" aria-label="User menu">
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item><mat-icon>person</mat-icon>Profile</button>
            <button mat-menu-item><mat-icon>logout</mat-icon>Sign out</button>
          </mat-menu>

        </mat-toolbar>

        <!-- Page content -->
        <main class="shell-main" id="main-content">
          <router-outlet />
        </main>

      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styleUrl: './shell.scss',
})
export class ShellComponent {
  protected readonly navItems = NAV_ITEMS;
  protected readonly collapsed = signal(false);
  protected readonly unreadCount = signal(0);

  protected toggleCollapse(): void {
    this.collapsed.update(v => !v);
  }

  protected onSearchShortcut(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === '/') {
      event.preventDefault();
      input.focus();
    }
  }
}
