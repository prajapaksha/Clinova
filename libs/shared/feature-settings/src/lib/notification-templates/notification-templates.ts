import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Permissions } from '@clinova/auth';
import type { TemplatePreview } from '@clinova/notifications/data-access';
import { NotificationsApiService } from '@clinova/notifications/data-access';
import type { MergeField, TemplateView } from '@clinova/notifications/domain';
import { MERGE_FIELDS, NOTIFICATION_TYPES, NotificationChannel, NotificationType, smsSegments } from '@clinova/notifications/domain';

const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Email', SMS: 'Text', PORTAL: 'Portal' };

/** PRD §4.6: practice-configurable templates per notification type with merge fields. */
@Component({
  selector: 'clv-notification-templates',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule],
  templateUrl: './notification-templates.html',
  styleUrl: './notification-templates.scss',
})
export class NotificationTemplatesComponent {
  private readonly api = inject(NotificationsApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly perms = inject(Permissions);
  private readonly bodyEl = viewChild<ElementRef<HTMLTextAreaElement>>('bodyEl');

  protected readonly canEdit = computed(() => this.perms.can('system:settings', 'write'));
  protected readonly channelLabel = CHANNEL_LABEL;
  protected readonly all = signal<TemplateView[]>([]);
  protected readonly type = signal<NotificationType>(NotificationType.AppointmentConfirmation);
  protected readonly channel = signal<NotificationChannel>(NotificationChannel.Email);
  protected subject = '';
  protected body = '';
  protected isActive = true;
  protected readonly preview = signal<TemplatePreview | null>(null);
  protected readonly busy = signal(false);
  protected readonly dirty = signal(false);

  protected readonly types = Object.values(NotificationType).map(t => ({ type: t, ...NOTIFICATION_TYPES[t] }));
  protected readonly spec = computed(() => NOTIFICATION_TYPES[this.type()]);
  protected readonly current = computed(() => this.all().find(v => v.type === this.type() && v.channel === this.channel()) ?? null);
  protected readonly channels = computed(() => this.all().filter(v => v.type === this.type()));
  protected readonly fields = computed(() => this.spec().mergeFields.map(f => ({ key: f, label: MERGE_FIELDS[f].label, token: `{{${f}}}` })));
  protected readonly isSms = computed(() => this.channel() === NotificationChannel.SMS);
  protected readonly segments = computed(() => smsSegments(this.preview()?.body ?? ''));

  private readonly preview$ = new Subject<void>();

  constructor() {
    this.api.templates().subscribe(list => {
      this.all.set(list);
      this.select(this.type(), this.channel());
    });
    this.preview$.pipe(
      debounceTime(250),
      switchMap(() => this.api.preview(this.type(), this.isSms() ? null : this.subject, this.body)),
    ).subscribe(p => this.preview.set(p));
  }

  protected customCount(type: NotificationType): number {
    return this.all().filter(v => v.type === type && v.isCustom).length;
  }

  protected isOff(type: NotificationType): boolean {
    return this.all().some(v => v.type === type && !v.isActive);
  }

  protected select(type: NotificationType, channel?: NotificationChannel): void {
    const options = this.all().filter(v => v.type === type);
    const view = options.find(v => v.channel === channel) ?? options[0];
    this.type.set(type);
    if (!view) return;
    this.channel.set(view.channel);
    this.subject = view.subject ?? '';
    this.body = view.body;
    this.isActive = view.isActive;
    this.dirty.set(false);
    this.changed(false);
  }

  protected changed(markDirty = true): void {
    if (markDirty) this.dirty.set(true);
    this.preview$.next();
  }

  protected insert(field: MergeField): void {
    const el = this.bodyEl()?.nativeElement;
    const token = `{{${field}}}`;
    const start = el?.selectionStart ?? this.body.length;
    const end = el?.selectionEnd ?? this.body.length;
    this.body = this.body.slice(0, start) + token + this.body.slice(end);
    this.changed();
    setTimeout(() => el?.setSelectionRange(start + token.length, start + token.length));
  }

  protected save(): void {
    this.busy.set(true);
    this.api.saveTemplate(this.type(), this.channel(), { subject: this.isSms() ? null : this.subject, body: this.body, isActive: this.isActive }).subscribe({
      next: view => this.saved(view, 'Template saved.'),
      error: err => this.fail(err),
    });
  }

  protected reset(): void {
    if (!confirm('Restore the built-in wording for this message?')) return;
    this.busy.set(true);
    this.api.resetTemplate(this.type(), this.channel()).subscribe({
      next: view => this.saved(view, 'Restored the default template.'),
      error: err => this.fail(err),
    });
  }

  private saved(view: TemplateView, message: string): void {
    this.busy.set(false);
    this.all.update(list => list.map(v => (v.type === view.type && v.channel === view.channel ? view : v)));
    this.select(view.type, view.channel);
    this.snack.open(message, 'OK', { duration: 3000 });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const msg = err instanceof HttpErrorResponse ? err.error?.message : null;
    this.snack.open(typeof msg === 'string' ? msg : 'The template could not be saved.', 'OK', { duration: 5000 });
  }
}
