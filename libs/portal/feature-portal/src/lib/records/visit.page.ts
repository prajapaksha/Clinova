import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PortalApiService, PortalSession } from '@clinova/portal/data-access';
import type { VisitSummary } from '@clinova/portal/domain';
import { errorMessage } from '../shared/portal-shared';

/** Printable, patient-friendly visit summary ("Download" uses the browser's Save as PDF). */
@Component({
  selector: 'clv-portal-visit',
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule],
  template: `
    <div class="pp-noprint vs__bar">
      <a mat-button routerLink="/records" class="pp-back"><mat-icon>arrow_back</mat-icon> Health records</a>
      @if (v()) { <button mat-stroked-button type="button" (click)="print()"><mat-icon>download</mat-icon> Download / print</button> }
    </div>
    @if (error()) { <p class="pp-note pp-note--warn">{{ error() }}</p> }
    @if (v(); as v) {
      <article class="pp-card vs">
        <header class="vs__head">
          <div>
            <p class="vs__over">Visit summary</p>
            <h1 class="pp-title">{{ v.date | date:'MMMM d, y' }}</h1>
            <p class="pp-sub">{{ v.providerName }}@if (v.reasonForVisit) { · {{ v.reasonForVisit }} }</p>
          </div>
          <div class="vs__patient">{{ name() }}</div>
        </header>

        @if (v.diagnoses.length) {
          <section><h2>What we discussed</h2>
            <ul>@for (d of v.diagnoses; track d.code) { <li>{{ d.description }} <span class="pp-muted">({{ d.code }})</span></li> }</ul>
          </section>
        }
        @if (v.vitals.length) {
          <section><h2>Your measurements</h2>
            <dl class="pp-kv">@for (x of v.vitals; track x.label) { <div><dt>{{ x.label }}</dt><dd>{{ x.value }}</dd></div> }</dl>
          </section>
        }
        @if (v.treatmentPlan) { <section><h2>Your care plan</h2><p class="vs__text">{{ v.treatmentPlan }}</p></section> }
        @if (v.patientInstructions) { <section><h2>Instructions</h2><p class="vs__text">{{ v.patientInstructions }}</p></section> }
        @if (v.prescriptions.length) {
          <section><h2>Medications prescribed</h2>
            <ul>@for (p of v.prescriptions; track p.name) { <li><strong>{{ p.name }}</strong> — {{ p.directions }}@if (p.refills) { · {{ p.refills }} refill{{ p.refills === 1 ? '' : 's' }} } </li> }</ul>
          </section>
        }
        @if (v.followUpInstructions) { <section><h2>Follow-up</h2><p class="vs__text">{{ v.followUpInstructions }}</p></section> }
        <footer class="vs__foot pp-muted">
          @if (v.signedByName) { Reviewed and signed by {{ v.signedByName }} on {{ v.signedAt | date:'MMM d, y' }}. }
          Questions about this visit? Send a message from the patient portal or call the office.
        </footer>
      </article>
    }
  `,
  styles: `
    .vs__bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .vs { max-width: 820px; }
    .vs__head { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--clv-gray-200); }
    .vs__over { margin: 0; text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; color: var(--clv-primary-700); font-weight: 600; }
    .vs__patient { font-weight: 600; text-align: right; }
    section { padding: 16px 0; border-bottom: 1px solid var(--clv-gray-100); }
    section h2 { font-size: 17px; margin: 0 0 8px; }
    section ul { margin: 0; padding-left: 20px; line-height: 1.7; }
    .vs__text { margin: 0; white-space: pre-line; line-height: 1.6; }
    .vs__foot { padding-top: 16px; font-size: 13px; }
    @media print { .vs { border: 0; padding: 0; max-width: none; } }
  `,
})
export class PortalVisitPage {
  private readonly api = inject(PortalApiService);
  private readonly session = inject(PortalSession);

  readonly id = input.required<string>();
  protected readonly v = signal<VisitSummary | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly name = () => {
    const u = this.session.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  };

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.api.visit(id).subscribe({ next: v => this.v.set(v), error: err => this.error.set(errorMessage(err)) }));
    });
  }

  protected print(): void {
    window.print();
  }
}
