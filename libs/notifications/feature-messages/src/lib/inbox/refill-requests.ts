import { Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Permissions } from '@clinova/auth';
import { CareTeamApiService } from '@clinova/portal/data-access';
import type { RefillRequest } from '@clinova/portal/domain';

/** Refill requests from the portal; physicians approve or deny (PRD §4.8). */
@Component({
  selector: 'clv-refill-requests',
  imports: [DatePipe, FormsModule, RouterModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="rq__bar">
      <mat-button-toggle-group [value]="status()" (change)="status.set($event.value)" aria-label="Status">
        <mat-button-toggle value="PENDING">Waiting</mat-button-toggle>
        <mat-button-toggle value="ALL">All</mat-button-toggle>
      </mat-button-toggle-group>
      @if (!canRespond()) { <span class="rq__hint">Only physicians can approve or deny refills.</span> }
    </div>
    @if (error()) { <p class="rq__error" role="alert">{{ error() }}</p> }
    <div class="rq__list">
      @for (r of rows(); track r.id) {
        <article class="rq__card">
          <header>
            <div>
              <strong>{{ r.medicationName }}</strong>
              <div class="rq__meta"><a [routerLink]="['/patients', r.patientId]">{{ r.patientName }}</a> · requested {{ r.createdAt | date:'MMM d, h:mm a' }}</div>
            </div>
            <span class="rq__status" [attr.data-status]="r.status">{{ r.status.toLowerCase() }}</span>
          </header>
          <dl>
            <div><dt>Prescriber</dt><dd>{{ r.prescriberName ?? '—' }}</dd></div>
            <div><dt>Refills left</dt><dd>{{ r.refillsRemaining }}</dd></div>
            <div><dt>Pharmacy</dt><dd>{{ r.pharmacy ?? '—' }}</dd></div>
          </dl>
          @if (r.note) { <p class="rq__note">“{{ r.note }}”</p> }
          @if (r.status === 'PENDING' && canRespond()) {
            <div class="rq__respond">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Note to patient (required to deny)</mat-label>
                <input matInput [(ngModel)]="notes[r.id]" [name]="'note-' + r.id" />
              </mat-form-field>
              <button mat-stroked-button type="button" [disabled]="busy()" (click)="respond(r, 'DENIED')">Deny</button>
              <button mat-flat-button color="primary" type="button" [disabled]="busy()" (click)="respond(r, 'APPROVED')">Approve refill</button>
            </div>
          } @else if (r.status !== 'PENDING') {
            <p class="rq__meta">{{ r.status === 'APPROVED' ? 'Approved' : 'Denied' }} by {{ r.respondedByName }} {{ r.respondedAt | date:'MMM d' }}@if (r.responseNote) { — “{{ r.responseNote }}” }</p>
          }
        </article>
      } @empty {
        <p class="rq__empty">No {{ status() === 'PENDING' ? 'waiting ' : '' }}refill requests.</p>
      }
    </div>
  `,
  styleUrl: './requests.scss',
})
export class RefillRequests {
  private readonly api = inject(CareTeamApiService);
  private readonly perms = inject(Permissions);
  readonly changed = output<void>();

  protected readonly status = signal<'PENDING' | 'ALL'>('PENDING');
  protected readonly rows = signal<RefillRequest[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canRespond = computed(() => this.perms.isProvider());
  protected notes: Record<string, string> = {};

  constructor() {
    effect(() => {
      const status = this.status();
      untracked(() => this.load(status));
    });
  }

  protected respond(r: RefillRequest, decision: 'APPROVED' | 'DENIED'): void {
    const note = this.notes[r.id]?.trim();
    if (decision === 'DENIED' && !note) {
      this.error.set('Add a note telling the patient why the refill was denied.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.respondRefill(r.id, decision, note).subscribe({
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
    this.api.refills(status).subscribe({ next: r => this.rows.set(r), error: () => this.error.set('Refill requests could not be loaded.') });
  }
}
