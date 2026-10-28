import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** Two-column welcome layout for sign-in pages (stacks on phones). */
@Component({
  selector: 'clv-auth-frame',
  imports: [RouterModule, MatIconModule],
  template: `
    <div class="af">
      <aside class="af__aside">
        <a routerLink="/sign-in" class="af__brand"><span class="af__mark"><mat-icon>local_hospital</mat-icon></span> Clinova</a>
        <h2>Your care, in one calm place.</h2>
        <ul>
          <li><mat-icon>event_available</mat-icon> Book and manage appointments</li>
          <li><mat-icon>description</mat-icon> See visit summaries and test results</li>
          <li><mat-icon>credit_card</mat-icon> Pay bills securely</li>
          <li><mat-icon>chat</mat-icon> Message your care team</li>
        </ul>
        <p class="af__small"><mat-icon>lock</mat-icon> Your information is private and protected.</p>
      </aside>
      <main class="af__main">
        <div class="af__card">
          <h1>{{ title() }}</h1>
          @if (subtitle()) { <p class="af__sub">{{ subtitle() }}</p> }
          <ng-content />
        </div>
        <p class="af__help">Need help? Call the office at <a href="tel:+15550100100">(555) 010-0100</a>.</p>
      </main>
    </div>
  `,
  styles: `
    .af { min-height: 100vh; display: grid; grid-template-columns: minmax(300px, 440px) 1fr; }
    .af__aside { padding: 48px 40px; color: #fff; background: linear-gradient(160deg, var(--clv-primary-700), var(--clv-primary-900)); display: flex; flex-direction: column; gap: 20px; }
    .af__brand { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; font-weight: 700; font-size: 20px; }
    .af__mark { width: 38px; height: 38px; border-radius: 10px; background: rgba(255, 255, 255, 0.18); display: grid; place-items: center; }
    .af__aside h2 { color: #fff; font-size: 28px; line-height: 1.25; margin: 24px 0 0; }
    .af__aside ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; }
    .af__aside li { display: flex; align-items: center; gap: 12px; opacity: 0.95; }
    .af__small { margin-top: auto; display: flex; align-items: center; gap: 8px; font-size: 13px; opacity: 0.85; }
    .af__small mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .af__main { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; }
    .af__card { width: 100%; max-width: 460px; background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 20px; padding: 32px; }
    .af__card h1 { margin: 0; font-size: 26px; }
    .af__sub { margin: 6px 0 22px; color: var(--clv-gray-600); }
    .af__help { color: var(--clv-gray-600); font-size: 14px; }
    @media (max-width: 820px) {
      .af { grid-template-columns: 1fr; }
      .af__aside { padding: 20px; gap: 0; }
      .af__aside h2, .af__aside ul, .af__small { display: none; }
      .af__card { padding: 22px; border-radius: 16px; }
    }
  `,
})
export class AuthFrame {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
