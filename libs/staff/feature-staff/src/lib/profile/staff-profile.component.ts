import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService, Permissions } from '@clinova/auth';
import { StaffApiService } from '@clinova/staff/data-access';
import type { StaffProfile } from '@clinova/staff/domain';
import { BADGE_STYLES, CREDENTIAL_STATUS, errorMessage, initials, roleLabel } from '../shared/staff-shared';
import { StaffOverviewComponent } from './staff-overview.component';
import { StaffCredentialsComponent } from './staff-credentials.component';
import { StaffScheduleComponent } from './staff-schedule.component';
import { StaffSecurityComponent } from './staff-security.component';

const TABS = ['overview', 'credentials', 'schedule', 'security'] as const;
type Tab = (typeof TABS)[number];

@Component({
  selector: 'clv-staff-profile',
  imports: [
    DatePipe, RouterModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTabsModule,
    StaffOverviewComponent, StaffCredentialsComponent, StaffScheduleComponent, StaffSecurityComponent,
  ],
  template: `
    <div class="spf">
      @if (canBrowse()) {
        <a mat-button routerLink="/staff" class="spf__back"><mat-icon>arrow_back</mat-icon> Staff directory</a>
      }
      @if (error()) {
        <p class="spf__error" role="alert">{{ error() }}</p>
      } @else if (profile(); as p) {
        <header class="spf__header">
          <span class="spf__avatar" aria-hidden="true">{{ initials(p) }}</span>
          <div class="spf__who">
            <h1 class="spf__name">{{ p.displayName }}</h1>
            <p class="spf__meta">
              {{ roleLabel(p.role) }}
              @if (p.specialties.length) { · {{ p.specialties.join(', ') }} }
              · Joined {{ p.createdAt | date:'MMM y' }}
            </p>
          </div>
          <div class="spf__badges">
            @if (!p.isActive) { <span class="badge badge--muted">Inactive</span> }
            @if (p.security?.lockedUntil) { <span class="badge badge--danger"><mat-icon>lock</mat-icon> Locked</span> }
            <span [class]="'badge badge--' + credentialStatus().tone">Credentials: {{ credentialStatus().label.toLowerCase() }}</span>
          </div>
        </header>

        <mat-tab-group class="spf__tabs" [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)" mat-stretch-tabs="false" animationDuration="0">
          <mat-tab label="Overview">
            <div class="spf__panel"><clv-staff-overview [profile]="p" [canEdit]="canEdit()" (changed)="profile.set($event)" /></div>
          </mat-tab>
          <mat-tab label="Credentials">
            <div class="spf__panel">
              <clv-staff-credentials [profile]="p" [canEdit]="canEdit()" [canVerify]="canVerify()" (changed)="reload()" />
            </div>
          </mat-tab>
          <mat-tab label="Schedule">
            <div class="spf__panel"><clv-staff-schedule [profile]="p" [canEdit]="canEdit()" (changed)="profile.set($event)" /></div>
          </mat-tab>
          @if (p.security) {
            <mat-tab label="Security">
              <div class="spf__panel"><clv-staff-security [profile]="p" [isSelf]="isSelf()" (changed)="$event ? profile.set($event) : reload()" /></div>
            </mat-tab>
          }
        </mat-tab-group>
      } @else {
        <div class="spf__loading"><mat-spinner diameter="32" /></div>
      }
    </div>
  `,
  styles: `
    .spf { padding: 16px 24px 24px; }
    .spf__back { margin-left: -8px; }
    .spf__error { color: var(--clv-danger-text); }
    .spf__loading { display: grid; place-items: center; padding: 48px; }
    .spf__header { display: flex; align-items: center; gap: 16px; margin: 8px 0 16px; flex-wrap: wrap; }
    .spf__avatar { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: var(--clv-primary-50); color: var(--clv-primary-700); font-size: 1.4rem; font-weight: 600; }
    .spf__who { flex: 1; min-width: 240px; }
    .spf__name { margin: 0; font-size: 1.5rem; }
    .spf__meta { margin: 4px 0 0; color: var(--clv-gray-600); }
    .spf__badges { display: flex; gap: 8px; flex-wrap: wrap; }
    .spf__tabs { background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; overflow: hidden; }
    .spf__panel { padding: 20px; }
    ${BADGE_STYLES}
  `,
})
export class StaffProfileComponent {
  private readonly api = inject(StaffApiService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly perms = inject(Permissions);

  /** Route param. */
  readonly id = input.required<string>();
  /** Query param selecting the initial tab. */
  readonly tab = input<string>();

  protected readonly initials = initials;
  protected readonly roleLabel = roleLabel;
  protected readonly profile = signal<StaffProfile | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly isSelf = computed(() => this.auth.currentUser()?.id === this.id());
  protected readonly canEdit = computed(() => this.isSelf() || this.perms.can('staff:profiles', 'full'));
  protected readonly canVerify = computed(() => this.perms.can('staff:profiles', 'full'));
  protected readonly canBrowse = computed(() => this.perms.can('staff:profiles'));
  protected readonly credentialStatus = computed(() => CREDENTIAL_STATUS[this.profile()?.credentialStatus ?? 'NO_EXPIRY']);
  protected readonly tabIndex = computed(() => {
    const i = TABS.indexOf((this.tab() ?? 'overview') as Tab);
    return i < 0 ? 0 : i;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.profile.set(null);
        this.load(id);
      });
    });
  }

  protected selectTab(index: number): void {
    this.router.navigate([], { queryParams: { tab: TABS[index] === 'overview' ? null : TABS[index] }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    this.load(this.id());
  }

  private load(id: string): void {
    this.error.set(null);
    this.api.get(id).subscribe({
      next: p => this.profile.set(p),
      error: err => this.error.set(errorMessage(err, 'This staff profile could not be loaded.')),
    });
  }
}
