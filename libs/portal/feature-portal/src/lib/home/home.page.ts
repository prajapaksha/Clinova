import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PortalApiService, PortalSession } from '@clinova/portal/data-access';
import type { PortalDashboard } from '@clinova/portal/domain';
import { CentsPipe, errorMessage } from '../shared/portal-shared';

/** PRD §4.8 dashboard: next appointment, balance due, new documents, unread messages. */
@Component({
  selector: 'clv-portal-home',
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, CentsPipe],
  template: `
    <header class="pp-head">
      <div>
        <h1 class="pp-title">{{ greeting() }}@if (d(); as dash) {, {{ dash.greetingName }}}</h1>
        <p class="pp-sub">
          @if (welcome()) { Your account is ready. Here's everything in one place. }
          @else if (lastLogin()) { Last signed in {{ lastLogin() | date:'MMM d, y, h:mm a' }}. }
          @else { Here's what's happening with your care. }
        </p>
      </div>
      <a mat-flat-button color="primary" routerLink="/appointments/book"><mat-icon>add</mat-icon> Book an appointment</a>
    </header>

    @if (error()) { <p class="pp-note pp-note--warn">{{ error() }}</p> }
    @if (!d() && !error()) { <div class="pp-empty"><mat-spinner diameter="32" /></div> }

    @if (d(); as d) {
      <div class="hm">
        <section class="pp-card hm__next" aria-labelledby="next-title">
          <h2 id="next-title" class="pp-section-title">Next appointment</h2>
          @if (d.nextAppointment; as a) {
            <div class="hm__appt">
              <div class="hm__date"><span>{{ a.start | date:'MMM' }}</span><strong>{{ a.start | date:'d' }}</strong><span>{{ a.start | date:'EEE' }}</span></div>
              <div>
                <div class="hm__time">{{ a.start | date:'h:mm a' }}</div>
                <div class="pp-list__title">{{ a.typeName }} with {{ a.providerName }}</div>
                @if (a.location) { <div class="pp-list__meta"><mat-icon inline>place</mat-icon> {{ a.location }}</div> }
              </div>
            </div>
            <div class="pp-actions hm__left">
              @if (a.canChange) { <a mat-stroked-button [routerLink]="['/appointments', a.id, 'reschedule']">Reschedule</a> }
              <a mat-button routerLink="/appointments">All appointments ({{ d.upcomingCount }})</a>
            </div>
          } @else {
            <p class="pp-muted">You have no upcoming appointments.</p>
            <a mat-stroked-button routerLink="/appointments/book">Book a visit</a>
          }
        </section>

        <section class="pp-card" aria-labelledby="bal-title">
          <h2 id="bal-title" class="pp-section-title">Balance due</h2>
          <div class="hm__big pp-money">{{ d.balanceCents | cents }}</div>
          @if (d.balanceCents > 0) {
            <p class="pp-muted">{{ d.openInvoiceCount }} open bill{{ d.openInvoiceCount === 1 ? '' : 's' }}@if (d.oldestDueDate) { · due {{ d.oldestDueDate | date:'MMM d' }} }</p>
            <a mat-flat-button color="primary" routerLink="/billing/pay">Pay now</a>
          } @else {
            <p class="pp-muted"><mat-icon inline class="hm__ok">check_circle</mat-icon> You're all paid up.</p>
            <a mat-button routerLink="/billing">Billing history</a>
          }
        </section>

        <section class="pp-card" aria-labelledby="msg-title">
          <h2 id="msg-title" class="pp-section-title">Messages</h2>
          <div class="hm__big">{{ d.unreadMessages }}</div>
          <p class="pp-muted">unread message{{ d.unreadMessages === 1 ? '' : 's' }} from your care team</p>
          <div class="pp-actions hm__left">
            <a mat-stroked-button routerLink="/messages">Open inbox</a>
            <a mat-button routerLink="/messages/new">New message</a>
          </div>
        </section>
      </div>

      <section class="pp-card hm__docs" aria-labelledby="docs-title">
        <h2 id="docs-title" class="pp-section-title">New results & documents</h2>
        @if (d.newDocuments.length) {
          <ul class="pp-list">
            @for (doc of d.newDocuments; track doc.id) {
              <li>
                <span class="pp-icon"><mat-icon>{{ doc.isResult ? 'science' : 'description' }}</mat-icon></span>
                <div class="pp-list__main">
                  <div class="pp-list__title">{{ doc.name }} <span class="pp-badge pp-badge--info">New</span></div>
                  <div class="pp-list__meta">Shared {{ doc.sharedAt | date:'MMM d' }}@if (doc.sharedByName) { by {{ doc.sharedByName }} }</div>
                </div>
                <a mat-button routerLink="/records" [queryParams]="{ tab: 'documents' }">View</a>
              </li>
            }
          </ul>
        } @else {
          <p class="pp-muted">Nothing new. Results appear here once your doctor reviews and releases them.</p>
        }
      </section>

      <section aria-label="Quick actions" class="pp-grid hm__quick">
        <a routerLink="/records" [queryParams]="{ tab: 'medications' }" class="pp-card hm__tile"><mat-icon>medication</mat-icon> Request a refill</a>
        <a routerLink="/records" class="pp-card hm__tile"><mat-icon>summarize</mat-icon> Visit summaries</a>
        <a routerLink="/profile" class="pp-card hm__tile"><mat-icon>badge</mat-icon> Update insurance</a>
        <a routerLink="/billing" class="pp-card hm__tile"><mat-icon>credit_card</mat-icon> Payment methods</a>
      </section>
      @if (d.pendingRequests) {
        <p class="pp-muted hm__pending"><mat-icon inline>hourglass_top</mat-icon> {{ d.pendingRequests }} request{{ d.pendingRequests === 1 ? ' is' : 's are' }} waiting for review by the office.</p>
      }
    }
  `,
  styles: `
    .hm { display: grid; gap: 16px; grid-template-columns: 1.4fr 1fr 1fr; }
    .hm .pp-card + .pp-card { margin-top: 0; }
    .hm__appt { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
    .hm__date { width: 64px; padding: 8px 0; border-radius: 14px; background: var(--clv-primary-50); color: var(--clv-primary-700); display: flex; flex-direction: column; align-items: center; font-size: 12px; text-transform: uppercase; font-weight: 600; }
    .hm__date strong { font-size: 26px; line-height: 1.1; }
    .hm__time { font-size: 20px; font-weight: 700; }
    .hm__left { justify-content: flex-start; }
    .hm__big { font-size: 32px; font-weight: 700; }
    .hm__ok { color: var(--clv-success-text); }
    .hm__docs { margin-top: 16px; }
    .hm__quick { margin-top: 16px; }
    .hm__tile { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--clv-gray-900); font-weight: 600; }
    .hm__tile:hover { border-color: var(--clv-primary-300); }
    .hm__tile mat-icon { color: var(--clv-primary-700); }
    .hm__pending { margin-top: 16px; }
    @media (max-width: 900px) { .hm { grid-template-columns: 1fr; } }
  `,
})
export class PortalHomePage {
  private readonly api = inject(PortalApiService);
  private readonly session = inject(PortalSession);
  readonly welcome = input<string>();

  protected readonly d = signal<PortalDashboard | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly lastLogin = this.session.previousLogin;
  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });

  constructor() {
    this.api.dashboard().subscribe({ next: d => this.d.set(d), error: err => this.error.set(errorMessage(err)) });
  }
}
