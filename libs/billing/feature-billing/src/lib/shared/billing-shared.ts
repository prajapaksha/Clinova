import { computed, inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Permissions } from '@clinova/auth';
import { PaymentMethod } from '@clinova/billing/domain';

/** Billing capability checks from the shared permission matrix (PRD §3.2: invoices & payments). */
@Injectable({ providedIn: 'root' })
export class BillingPermissions {
  private readonly perms = inject(Permissions);
  readonly canManage = computed(() => this.perms.can('billing:invoices', 'full'));
  readonly canTakePayment = computed(() => this.perms.can('billing:invoices', 'write'));
  readonly canEditFeeSchedules = computed(() => this.perms.can('system:settings', 'write'));
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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CreditCard]: 'Credit card',
  [PaymentMethod.DebitCard]: 'Debit card',
  [PaymentMethod.ACH]: 'ACH / bank transfer',
  [PaymentMethod.Cash]: 'Cash',
  [PaymentMethod.Check]: 'Check',
  [PaymentMethod.HSA]: 'HSA card',
  [PaymentMethod.FSA]: 'FSA card',
  [PaymentMethod.PatientPortal]: 'Patient portal',
  [PaymentMethod.Insurance]: 'Insurance',
};

/** Methods staff can record at the desk (insurance comes through claims). */
export const DESK_PAYMENT_METHODS = Object.values(PaymentMethod).filter(
  m => m !== PaymentMethod.Insurance && m !== PaymentMethod.PatientPortal,
);

export function centsFromDollars(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : value ?? 0;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
