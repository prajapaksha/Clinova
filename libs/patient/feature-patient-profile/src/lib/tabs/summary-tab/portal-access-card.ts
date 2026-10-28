import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Permissions } from '@clinova/auth';
import { CareTeamApiService } from '@clinova/portal/data-access';
import type { PortalAccessSummary } from '@clinova/portal/domain';

const STATUS: Record<string, { label: string; cls: string }> = {
  NONE: { label: 'No account', cls: '' },
  INVITED: { label: 'Invited', cls: 'pa__badge--info' },
  ACTIVE: { label: 'Active', cls: 'pa__badge--ok' },
  DISABLED: { label: 'Disabled', cls: 'pa__badge--off' },
};

/** Staff view of the patient's portal account: invite, resend, disable (PRD §4.8). */
@Component({
  selector: 'clv-portal-access-card',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatTooltipModule],
  template: `
    <mat-card class="pa">
      <mat-card-header>
        <mat-card-title class="pa__title"><mat-icon>devices</mat-icon>Patient portal
          @if (access(); as a) { <span class="pa__badge" [class]="status(a).cls">{{ status(a).label }}</span> }
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if (access(); as a) {
          @switch (a.status) {
            @case ('ACTIVE') {
              <p>Signed up as <strong>{{ a.email }}</strong>@if (a.activatedAt) {<span> on {{ a.activatedAt | date:'mediumDate' }}</span>}.
                @if (a.lastLoginAt) { Last signed in {{ a.lastLoginAt | date:'medium' }}. }</p>
              @if (a.lockedUntil) { <p class="pa__warn"><mat-icon inline>lock</mat-icon> Locked after failed sign-ins until {{ a.lockedUntil | date:'shortTime' }}.</p> }
            }
            @case ('INVITED') { <p>Invite sent to <strong>{{ a.email }}</strong>; expires {{ a.inviteExpiresAt | date:'mediumDate' }}.</p> }
            @case ('DISABLED') { <p>Portal access is turned off for {{ a.email }}.</p> }
            @default { <p class="pa__muted">Invite the patient to book visits, see results, pay bills and message the care team online. They can also sign up with their name, date of birth and email on file.</p> }
          }
          @if (code(); as c) {
            <div class="pa__code" role="status">
              <span>Share this one-time code with the patient (valid 14 days):</span>
              <code data-testid="invite-code">{{ c }}</code>
              <span class="pa__muted">They enter it at the portal under “I have an invite code”.</span>
            </div>
          }
          @if (error()) { <p class="pa__warn">{{ error() }}</p> }
        }
      </mat-card-content>
      @if (canManage() && access(); as a) {
        <mat-card-actions>
          @if (a.status === 'NONE' || a.status === 'INVITED') {
            <button mat-stroked-button type="button" [disabled]="busy()" (click)="invite()"><mat-icon>send</mat-icon> {{ a.status === 'INVITED' ? 'New invite code' : 'Invite to portal' }}</button>
          }
          @if (a.status === 'ACTIVE' || a.status === 'INVITED') {
            <button mat-button type="button" [disabled]="busy()" (click)="setDisabled(true)">Turn off access</button>
          }
          @if (a.status === 'DISABLED') {
            <button mat-stroked-button type="button" [disabled]="busy()" (click)="setDisabled(false)">Turn access back on</button>
          }
        </mat-card-actions>
      }
    </mat-card>
  `,
  styles: `
    .pa__title { display: flex; align-items: center; gap: 8px; }
    .pa__badge { margin-left: 4px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; background: var(--clv-gray-100); color: var(--clv-gray-700); }
    .pa__badge--ok { background: var(--clv-success-bg); color: var(--clv-success-text); }
    .pa__badge--info { background: var(--clv-info-bg); color: var(--clv-info-text); }
    .pa__badge--off { background: var(--clv-danger-bg); color: var(--clv-danger-text); }
    .pa__muted { color: var(--clv-gray-600); }
    .pa__warn { color: var(--clv-danger-text); }
    .pa__code { display: flex; flex-direction: column; gap: 6px; padding: 12px; border: 1px dashed var(--clv-gray-300); border-radius: 8px; background: var(--clv-gray-100); }
    .pa__code code { font-size: 22px; letter-spacing: 0.12em; font-weight: 600; user-select: all; }
  `,
})
export class PortalAccessCard {
  private readonly api = inject(CareTeamApiService);
  private readonly perms = inject(Permissions);

  readonly patientId = input.required<string>();
  protected readonly access = signal<PortalAccessSummary | null>(null);
  protected readonly code = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canManage = () => this.perms.can('patient:profiles', 'write');

  constructor() {
    effect(() => {
      const id = this.patientId();
      untracked(() => {
        this.code.set(null);
        this.api.portalAccess(id).subscribe({ next: a => this.access.set(a), error: () => this.access.set(null) });
      });
    });
  }

  protected status(a: PortalAccessSummary) {
    return STATUS[a.status] ?? STATUS['NONE'];
  }

  protected invite(): void {
    this.run(() => this.api.invite(this.patientId()).subscribe({
      next: r => {
        this.code.set(r.code);
        this.reload();
      },
      error: err => this.fail(err),
    }));
  }

  protected setDisabled(disabled: boolean): void {
    if (disabled && !confirm('Turn off portal access? The patient will be signed out and unable to sign in.')) return;
    this.run(() => this.api.setPortalDisabled(this.patientId(), disabled).subscribe({
      next: a => {
        this.busy.set(false);
        this.access.set(a);
      },
      error: err => this.fail(err),
    }));
  }

  private run(fn: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    fn();
  }

  private reload(): void {
    this.api.portalAccess(this.patientId()).subscribe(a => {
      this.busy.set(false);
      this.access.set(a);
    });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const msg = err instanceof HttpErrorResponse ? err.error?.message : null;
    this.error.set(typeof msg === 'string' ? msg : 'Something went wrong.');
  }
}
