import { Component, effect, inject, input, OnInit, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PortalApiService } from '@clinova/portal/data-access';
import type { Thread, ThreadSummary } from '@clinova/portal/domain';
import { THREAD_CATEGORY_LABELS, ThreadCategory, URGENT_DISCLAIMER } from '@clinova/portal/domain';
import { errorMessage } from '../shared/portal-shared';

@Component({
  selector: 'clv-portal-messages',
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule],
  template: `
    <header class="pp-head">
      <div><h1 class="pp-title">Messages</h1><p class="pp-sub">Secure messages with your care team for non-urgent questions.</p></div>
      <a mat-flat-button color="primary" routerLink="new"><mat-icon>edit</mat-icon> New message</a>
    </header>
    @if (error()) { <p class="pp-note pp-note--warn">{{ error() }}</p> }
    <section class="pp-card">
      <ul class="pp-list">
        @for (t of threads(); track t.id) {
          <li class="ms" [class.ms--unread]="t.unread">
            <span class="pp-icon"><mat-icon>{{ t.unread ? 'mark_email_unread' : 'chat_bubble_outline' }}</mat-icon></span>
            <a class="pp-list__main ms__link" [routerLink]="t.id">
              <div class="pp-list__title">{{ t.subject }} @if (t.unread) { <span class="pp-badge pp-badge--info">New reply</span> }</div>
              <div class="pp-list__meta">{{ labels[t.category] }} · {{ t.lastAuthorType === 'STAFF' ? 'Care team' : 'You' }}: {{ t.lastMessagePreview }}</div>
            </a>
            <span class="pp-muted ms__date">{{ t.lastMessageAt | date:'MMM d' }}</span>
          </li>
        } @empty {
          <li class="pp-empty ms__empty"><mat-icon>forum</mat-icon><br />No messages yet. Send one whenever you have a question.</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .ms__link { text-decoration: none; color: inherit; }
    .ms__link .pp-list__meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ms--unread .pp-list__title { color: var(--clv-primary-700); }
    .ms__date { font-size: 13px; white-space: nowrap; }
    .ms__empty { display: block !important; }
  `,
})
export class PortalMessagesPage {
  private readonly api = inject(PortalApiService);
  protected readonly labels = THREAD_CATEGORY_LABELS;
  protected readonly threads = signal<ThreadSummary[]>([]);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.api.threads().subscribe({ next: t => this.threads.set(t), error: err => this.error.set(errorMessage(err)) });
  }
}

@Component({
  selector: 'clv-portal-thread',
  imports: [DatePipe, FormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <a mat-button routerLink="/messages" class="pp-back"><mat-icon>arrow_back</mat-icon> Messages</a>
    @if (error()) { <p class="pp-note pp-note--warn">{{ error() }}</p> }
    @if (t(); as t) {
      <header class="pp-head"><div><h1 class="pp-title">{{ t.subject }}</h1><p class="pp-sub">{{ labels[t.category] }}@if (t.status === 'CLOSED') { · Closed by the office }</p></div></header>
      <section class="pp-card th">
        @for (m of t.messages; track m.id) {
          <div class="th__msg" [class.th__msg--me]="m.authorType === 'PATIENT'">
            <div class="th__meta">{{ m.authorType === 'PATIENT' ? 'You' : m.authorName }} · {{ m.createdAt | date:'MMM d, h:mm a' }}</div>
            <div class="th__body">{{ m.body }}</div>
          </div>
        }
      </section>
      <form class="pp-card th__reply" (ngSubmit)="send()">
        <mat-form-field appearance="outline">
          <mat-label>Reply</mat-label>
          <textarea matInput rows="4" name="reply" maxlength="5000" [(ngModel)]="reply"></textarea>
        </mat-form-field>
        <div class="pp-actions">
          <span class="pp-muted th__disc">Non-urgent only. For emergencies call 911.</span>
          <button mat-flat-button color="primary" [disabled]="busy() || !reply.trim()">Send</button>
        </div>
      </form>
    }
  `,
  styles: `
    .th { display: flex; flex-direction: column; gap: 12px; }
    .th__msg { max-width: 80%; align-self: flex-start; }
    .th__msg--me { align-self: flex-end; text-align: right; }
    .th__meta { font-size: 12px; color: var(--clv-gray-600); margin-bottom: 4px; }
    .th__body { display: inline-block; text-align: left; padding: 12px 14px; border-radius: 16px 16px 16px 4px; background: var(--clv-gray-100); white-space: pre-line; line-height: 1.5; }
    .th__msg--me .th__body { background: var(--clv-primary-700); color: #fff; border-radius: 16px 16px 4px 16px; }
    .th__reply { margin-top: 16px; }
    .th__disc { font-size: 13px; margin-right: auto; }
    @media (max-width: 760px) { .th__msg { max-width: 92%; } }
  `,
})
export class PortalThreadPage {
  private readonly api = inject(PortalApiService);
  readonly id = input.required<string>();
  protected readonly labels = THREAD_CATEGORY_LABELS;
  protected readonly t = signal<Thread | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected reply = '';

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.api.thread(id).subscribe({ next: t => this.t.set(t), error: err => this.error.set(errorMessage(err)) }));
    });
  }

  protected send(): void {
    if (!this.reply.trim()) return;
    this.busy.set(true);
    this.api.reply(this.id(), this.reply).subscribe({
      next: t => {
        this.busy.set(false);
        this.reply = '';
        this.t.set(t);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}

@Component({
  selector: 'clv-portal-compose',
  imports: [FormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <a mat-button routerLink="/messages" class="pp-back"><mat-icon>arrow_back</mat-icon> Messages</a>
    <header class="pp-head"><div><h1 class="pp-title">New message</h1><p class="pp-sub">Your message goes to the care team at the practice.</p></div></header>
    <p class="pp-note pp-note--warn cp__disc" role="note"><mat-icon>emergency</mat-icon>{{ disclaimer }}</p>
    <form class="pp-card cp" (ngSubmit)="send()">
      <mat-form-field appearance="outline">
        <mat-label>Topic</mat-label>
        <mat-select name="category" [(ngModel)]="topic">
          @for (c of categories; track c.value) { <mat-option [value]="c.value">{{ c.label }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Subject</mat-label>
        <input matInput name="subject" maxlength="150" [(ngModel)]="title" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Message</mat-label>
        <textarea matInput rows="7" name="body" maxlength="5000" [(ngModel)]="body"></textarea>
      </mat-form-field>
      @if (error()) { <p class="pp-error" role="alert">{{ error() }}</p> }
      <div class="pp-actions">
        <a mat-button routerLink="/messages">Cancel</a>
        <button mat-flat-button color="primary" [disabled]="busy() || !title.trim() || !body.trim()">Send message</button>
      </div>
    </form>
  `,
  styles: `.cp { max-width: 720px; display: flex; flex-direction: column; } .cp__disc { max-width: 720px; margin-bottom: 16px; }`,
})
export class PortalComposePage implements OnInit {
  private readonly api = inject(PortalApiService);
  private readonly router = inject(Router);

  /** Optional query params to prefill (e.g. from a bill). */
  readonly category = input<string>();
  readonly subject = input<string>();

  protected readonly disclaimer = URGENT_DISCLAIMER;
  protected readonly categories = Object.values(ThreadCategory).map(value => ({ value, label: THREAD_CATEGORY_LABELS[value] }));
  protected topic: ThreadCategory = ThreadCategory.General;
  protected title = '';
  protected body = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (Object.values(ThreadCategory).includes(this.category() as ThreadCategory)) this.topic = this.category() as ThreadCategory;
    this.title = this.subject() ?? '';
  }

  protected send(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.startThread({ category: this.topic, subject: this.title, body: this.body }).subscribe({
      next: t => this.router.navigate(['/messages', t.id]),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
