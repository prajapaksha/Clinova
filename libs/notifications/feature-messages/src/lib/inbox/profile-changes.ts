import { Component, effect, inject, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CareTeamApiService } from '@clinova/portal/data-access';
import type { ProfileChangeField, ProfileChangeRequest } from '@clinova/portal/domain';
import { PROFILE_FIELD_LABELS } from '@clinova/portal/domain';

type Obj = Record<string, unknown>;

/** Human-readable value for a profile field, for side-by-side review. */
export function describeValue(field: ProfileChangeField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'contact') {
    const c = value as Obj;
    const a = (c['mailingAddress'] ?? {}) as Obj;
    return [c['primaryPhone'], c['secondaryPhone'], c['email'], `prefers ${String(c['preferredMethod'] ?? '').toLowerCase()}`,
      [a['street1'], a['street2'], a['city'], `${a['state'] ?? ''} ${a['postalCode'] ?? ''}`.trim()].filter(Boolean).join(', ')]
      .filter(Boolean).join('\n');
  }
  if (field === 'emergencyContacts') return (value as Obj[]).map(e => `${e['name']} (${e['relationship'] || 'contact'}) ${e['phone']}`).join('\n') || '—';
  if (field === 'insurancePolicies') {
    return (value as Obj[]).map(p => `${p['provider']} · ID ${p['policyNumber']}${p['groupNumber'] ? ` · group ${p['groupNumber']}` : ''} · ${String(p['relationship'] ?? '').toLowerCase()}`).join('\n') || '—';
  }
  return String(value);
}

/** Demographic / contact / insurance updates submitted from the portal, applied on approval. */
@Component({
  selector: 'clv-profile-changes',
  imports: [DatePipe, FormsModule, RouterModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="rq__bar">
      <mat-button-toggle-group [value]="status()" (change)="status.set($event.value)" aria-label="Status">
        <mat-button-toggle value="PENDING">Waiting</mat-button-toggle>
        <mat-button-toggle value="ALL">All</mat-button-toggle>
      </mat-button-toggle-group>
    </div>
    @if (error()) { <p class="rq__error" role="alert">{{ error() }}</p> }
    <div class="rq__list">
      @for (r of rows(); track r.id) {
        <article class="rq__card">
          <header>
            <div>
              <strong><a [routerLink]="['/patients', r.patientId]">{{ r.patientName }}</a></strong><span class="rq__meta rq__mrn">{{ r.patientMrn }}</span>
              <div class="rq__meta">Submitted {{ r.createdAt | date:'MMM d, h:mm a' }}</div>
            </div>
            <span class="rq__status" [attr.data-status]="r.status">{{ r.status.toLowerCase() }}</span>
          </header>
          <table class="rq__diff">
            <thead><tr><th>Field</th><th>Current</th><th>Requested</th></tr></thead>
            <tbody>
              @for (f of fields(r); track f) {
                <tr><th>{{ labels[f] }}</th><td>{{ describe(f, r.changes[f]?.old) }}</td><td class="rq__new">{{ describe(f, r.changes[f]?.new) }}</td></tr>
              }
            </tbody>
          </table>
          @if (r.status === 'PENDING') {
            <div class="rq__respond">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Reason (required to reject)</mat-label>
                <input matInput [(ngModel)]="reasons[r.id]" [name]="'reason-' + r.id" />
              </mat-form-field>
              <button mat-stroked-button type="button" [disabled]="busy()" (click)="review(r, 'REJECTED')">Reject</button>
              <button mat-flat-button color="primary" type="button" [disabled]="busy()" (click)="review(r, 'APPROVED')">Approve & update chart</button>
            </div>
          } @else {
            <p class="rq__meta">{{ r.status === 'APPROVED' ? 'Applied' : 'Rejected' }} by {{ r.reviewedByName }} {{ r.reviewedAt | date:'MMM d' }}@if (r.rejectionReason) { — “{{ r.rejectionReason }}” }</p>
          }
        </article>
      } @empty {
        <p class="rq__empty">No {{ status() === 'PENDING' ? 'waiting ' : '' }}profile updates.</p>
      }
    </div>
  `,
  styleUrl: './requests.scss',
})
export class ProfileChanges {
  private readonly api = inject(CareTeamApiService);
  readonly changed = output<void>();

  protected readonly labels = PROFILE_FIELD_LABELS;
  protected readonly status = signal<'PENDING' | 'ALL'>('PENDING');
  protected readonly rows = signal<ProfileChangeRequest[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected reasons: Record<string, string> = {};
  protected readonly describe = describeValue;

  constructor() {
    effect(() => {
      const status = this.status();
      untracked(() => this.load(status));
    });
  }

  protected fields(r: ProfileChangeRequest): ProfileChangeField[] {
    return Object.keys(r.changes) as ProfileChangeField[];
  }

  protected review(r: ProfileChangeRequest, decision: 'APPROVED' | 'REJECTED'): void {
    const reason = this.reasons[r.id]?.trim();
    if (decision === 'REJECTED' && !reason) {
      this.error.set('Give the patient a reason for rejecting the update.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.reviewChange(r.id, decision, reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.load(this.status());
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const msg = err instanceof HttpErrorResponse ? err.error?.message : null;
        this.error.set(typeof msg === 'string' ? msg : 'Something went wrong.');
      },
    });
  }

  private load(status: string): void {
    this.api.changeRequests(status).subscribe({ next: r => this.rows.set(r), error: () => this.error.set('Updates could not be loaded.') });
  }
}
