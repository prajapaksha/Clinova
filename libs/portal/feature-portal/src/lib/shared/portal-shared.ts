import { Component, computed, input, Pipe, PipeTransform } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { PASSWORD_MIN_LENGTH } from '@clinova/identity/domain';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** `12345 | cents` → "$123.45". */
@Pipe({ name: 'cents' })
export class CentsPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : usd.format(value / 100);
  }
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    const msg = err.error?.message;
    if (Array.isArray(msg)) return msg.join(' ');
    if (typeof msg === 'string') return msg;
    if (err.status === 0) return "We couldn't reach the server. Check your connection and try again.";
  }
  return fallback;
}

/** Local calendar date YYYY-MM-DD. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
}

export function openBlob(blob: Blob, name: string, download = false): void {
  const url = URL.createObjectURL(blob);
  if (download) {
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
  } else {
    window.open(url, '_blank', 'noopener');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const APPOINTMENT_STATUS: Readonly<Record<string, { label: string; tone: string }>> = {
  SCHEDULED: { label: 'Booked', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'ok' },
  CHECKED_IN: { label: 'Checked in', tone: 'ok' },
  IN_PROGRESS: { label: 'In progress', tone: 'ok' },
  COMPLETED: { label: 'Completed', tone: '' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  NO_SHOW: { label: 'Missed', tone: 'warn' },
  RESCHEDULED: { label: 'Rescheduled', tone: '' },
};

export const INVOICE_STATUS: Readonly<Record<string, { label: string; tone: string }>> = {
  SENT: { label: 'Due', tone: 'info' },
  PARTIALLY_PAID: { label: 'Partly paid', tone: 'warn' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  PAID: { label: 'Paid', tone: 'ok' },
  VOIDED: { label: 'Cancelled', tone: '' },
};

const RULES: ReadonlyArray<{ label: string; test: (pw: string) => boolean }> = [
  { label: `${PASSWORD_MIN_LENGTH}+ characters`, test: pw => pw.length >= PASSWORD_MIN_LENGTH },
  { label: 'Upper & lower case', test: pw => /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
  { label: 'A number', test: pw => /\d/.test(pw) },
  { label: 'A symbol', test: pw => /[^A-Za-z0-9]/.test(pw) },
];

export const passwordOk = (pw: string) => RULES.every(r => r.test(pw));

/** Live password checklist shown under new-password fields. */
@Component({
  selector: 'clv-password-rules',
  imports: [MatIconModule],
  template: `
    <ul class="rules" aria-label="Password requirements">
      @for (r of rules(); track r.label) {
        <li [class.ok]="r.ok"><mat-icon>{{ r.ok ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>{{ r.label }}</li>
      }
    </ul>
  `,
  styles: `
    .rules { list-style: none; padding: 0; margin: -6px 0 14px; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--clv-gray-600); }
    li { display: flex; align-items: center; gap: 4px; }
    mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .ok { color: var(--clv-success-text); }
  `,
})
export class PasswordRules {
  readonly password = input('');
  protected readonly rules = computed(() => RULES.map(r => ({ label: r.label, ok: r.test(this.password()) })));
}
