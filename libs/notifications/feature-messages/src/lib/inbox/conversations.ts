import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CareTeamApiService } from '@clinova/portal/data-access';
import type { Thread, ThreadSummary } from '@clinova/portal/domain';
import { THREAD_CATEGORY_LABELS } from '@clinova/portal/domain';

/** Care-team inbox for secure patient messages (PRD §10.3: "answer portal messages"). */
@Component({
  selector: 'clv-conversations',
  imports: [DatePipe, FormsModule, RouterModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule],
  templateUrl: './conversations.html',
  styleUrl: './conversations.scss',
})
export class Conversations {
  private readonly api = inject(CareTeamApiService);
  private readonly router = inject(Router);

  /** Selected thread id (query param). */
  readonly threadId = input<string>();
  /** Unread counts may have changed. */
  readonly changed = output<void>();

  protected readonly labels = THREAD_CATEGORY_LABELS;
  protected readonly status = signal<'OPEN' | 'CLOSED' | 'ALL'>('OPEN');
  protected readonly unreadOnly = signal(false);
  protected readonly threads = signal<ThreadSummary[]>([]);
  protected readonly thread = signal<Thread | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected reply = '';
  protected readonly selected = computed(() => this.threadId() ?? null);

  constructor() {
    effect(() => {
      const status = this.status();
      const unread = this.unreadOnly();
      untracked(() => this.loadList(status, unread));
    });
    effect(() => {
      const id = this.selected();
      untracked(() => (id ? this.open(id) : this.thread.set(null)));
    });
  }

  protected select(t: ThreadSummary): void {
    this.router.navigate([], { queryParams: { thread: t.id }, queryParamsHandling: 'merge' });
  }

  protected send(): void {
    const t = this.thread();
    if (!t || !this.reply.trim()) return;
    this.busy.set(true);
    this.api.reply(t.id, this.reply).subscribe({
      next: updated => {
        this.busy.set(false);
        this.reply = '';
        this.thread.set(updated);
        this.loadList(this.status(), this.unreadOnly());
      },
      error: err => this.fail(err),
    });
  }

  protected setThreadStatus(status: 'OPEN' | 'CLOSED'): void {
    const t = this.thread();
    if (!t) return;
    this.api.setThreadStatus(t.id, status).subscribe({
      next: () => {
        this.thread.set({ ...t, status });
        this.loadList(this.status(), this.unreadOnly());
      },
      error: err => this.fail(err),
    });
  }

  private open(id: string): void {
    this.api.thread(id).subscribe({
      next: t => {
        this.thread.set(t);
        this.threads.update(list => list.map(x => (x.id === id ? { ...x, unread: false } : x)));
        this.changed.emit();
      },
      error: err => this.fail(err),
    });
  }

  private loadList(status: string, unread: boolean): void {
    this.api.threads({ status, unread }).subscribe({ next: t => this.threads.set(t), error: err => this.fail(err) });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const msg = err instanceof HttpErrorResponse ? err.error?.message : null;
    this.error.set(typeof msg === 'string' ? msg : 'Something went wrong.');
  }
}
