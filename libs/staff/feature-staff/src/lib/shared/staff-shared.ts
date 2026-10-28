import { HttpErrorResponse } from '@angular/common/http';
import type { CredentialExpiryStatus } from '@clinova/staff/domain';
import { ROLE_LABELS, STAFF_ROLES, UserRole } from '@clinova/identity/domain';

export type Tone = 'danger' | 'warning' | 'info' | 'ok' | 'muted';

export const CREDENTIAL_STATUS: Readonly<Record<CredentialExpiryStatus, { label: string; tone: Tone }>> = {
  EXPIRED: { label: 'Expired', tone: 'danger' },
  DUE_7: { label: 'Expires within 7 days', tone: 'danger' },
  DUE_30: { label: 'Expires within 30 days', tone: 'warning' },
  DUE_90: { label: 'Expires within 90 days', tone: 'info' },
  VALID: { label: 'Current', tone: 'ok' },
  NO_EXPIRY: { label: 'No expiry', tone: 'muted' },
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ROLE_OPTIONS = STAFF_ROLES.map(role => ({ value: role as string, label: ROLE_LABELS[role] }));

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] ?? role;
}

export function initials(person: { firstName: string; lastName: string }): string {
  return `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase();
}

/** "in 12 days", "today", "3 days ago". */
export function relativeDays(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return 'today';
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
  return `${-days} day${days === -1 ? '' : 's'} ago`;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    const msg = err.error?.message;
    if (Array.isArray(msg)) return msg.join(' ');
    if (typeof msg === 'string') return msg;
    if (err.status === 403) return 'You do not have permission to perform this action.';
  }
  return fallback;
}

/** Shared badge styles (component styles stay under the size budget). */
export const BADGE_STYLES = `
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; white-space: nowrap; }
  .badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
  .badge--danger { background: var(--clv-danger-bg); color: var(--clv-danger-text); }
  .badge--warning { background: var(--clv-warning-bg); color: var(--clv-warning-text); }
  .badge--info { background: var(--clv-info-bg); color: var(--clv-info-text); }
  .badge--ok { background: var(--clv-success-bg); color: var(--clv-success-text); }
  .badge--muted { background: var(--clv-gray-100); color: var(--clv-gray-600); }
`;
