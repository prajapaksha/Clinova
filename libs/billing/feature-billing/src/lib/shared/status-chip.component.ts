import { Component, computed, input } from '@angular/core';
import { ClaimStatus, InvoiceStatus } from '@clinova/billing/domain';

const LABELS: Record<string, string> = {
  [InvoiceStatus.Draft]: 'Draft',
  [InvoiceStatus.Sent]: 'Sent',
  [InvoiceStatus.PartiallyPaid]: 'Partially paid',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.Overdue]: 'Overdue',
  [InvoiceStatus.Voided]: 'Voided',
  [ClaimStatus.Submitted]: 'Submitted',
  [ClaimStatus.Pending]: 'Pending',
  [ClaimStatus.Denied]: 'Denied',
  [ClaimStatus.Appealed]: 'Appealed',
};

/** Colored status pill for invoices and claims. */
@Component({
  selector: 'clv-status-chip',
  standalone: true,
  template: `<span class="chip" [attr.data-status]="status()">{{ label() }}</span>`,
  styles: `
    .chip {
      display: inline-block; padding: 2px 10px; border-radius: 999px; white-space: nowrap;
      font-size: 0.72rem; font-weight: 600; background: var(--clv-gray-100); color: var(--clv-gray-700);
    }
    [data-status='SENT'], [data-status='SUBMITTED'] { background: var(--clv-info-bg); color: var(--clv-info-text); }
    [data-status='PARTIALLY_PAID'], [data-status='PENDING'], [data-status='APPEALED'] { background: var(--clv-warning-bg); color: var(--clv-warning-text); }
    [data-status='PAID'] { background: var(--clv-success-bg); color: var(--clv-success-text); }
    [data-status='OVERDUE'], [data-status='DENIED'] { background: var(--clv-danger-bg); color: var(--clv-danger-text); }
    [data-status='VOIDED'] { text-decoration: line-through; }
  `,
})
export class StatusChipComponent {
  readonly status = input.required<string>();
  protected readonly label = computed(() => LABELS[this.status()] ?? this.status().charAt(0) + this.status().slice(1).toLowerCase());
}
