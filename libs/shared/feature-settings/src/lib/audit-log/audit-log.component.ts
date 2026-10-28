import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { AuditLogEntry, AuditLogFilters } from '@clinova/identity/domain';
import { AuditAction, ROLE_LABELS, UserRole } from '@clinova/identity/domain';
import { IdentityApiService } from '@clinova/identity/data-access';
import { StaffApiService } from '@clinova/staff/data-access';
import type { StaffSummary } from '@clinova/staff/domain';

const RESOURCE_TYPES = [
  'Patient', 'Allergy', 'Document', 'Encounter', 'Addendum', 'Prescription', 'Invoice', 'Payment', 'Statement',
  'Staff', 'StaffCredential', 'Session',
];
const ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
  [AuditAction.View]: 'Viewed',
  [AuditAction.Create]: 'Created',
  [AuditAction.Update]: 'Updated',
  [AuditAction.Delete]: 'Deleted',
  [AuditAction.Sign]: 'Signed',
  [AuditAction.Login]: 'Signed in',
  [AuditAction.LoginFailed]: 'Sign-in failed',
  [AuditAction.AccountLocked]: 'Account locked',
  [AuditAction.Logout]: 'Signed out',
  [AuditAction.PasswordChanged]: 'Password changed',
  [AuditAction.PasswordReset]: 'Password reset',
  [AuditAction.RoleChanged]: 'Role changed',
  [AuditAction.AccountStatusChanged]: 'Account status changed',
};
const SECURITY_ACTIONS = new Set<string>([AuditAction.LoginFailed, AuditAction.AccountLocked, AuditAction.PasswordReset, AuditAction.RoleChanged, AuditAction.AccountStatusChanged]);

const shorten = (v: string | null, max = 60) => (v && v.length > max ? `${v.slice(0, max)}…` : v ?? '∅');

/** PRD §5.1 audit trail: who accessed or changed what, when, and from where. */
@Component({
  selector: 'clv-audit-log',
  imports: [
    DatePipe, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule,
    MatProgressSpinnerModule, MatSelectModule, MatTooltipModule,
  ],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent {
  private readonly api = inject(IdentityApiService);
  private readonly router = inject(Router);

  /** Query params (deep links such as a patient's access log). */
  readonly patientId = input<string>();
  readonly userId = input<string>();

  protected readonly actions = Object.values(AuditAction).map(value => ({ value, label: ACTION_LABELS[value] }));
  protected readonly resourceTypes = RESOURCE_TYPES;
  protected readonly staff = signal<StaffSummary[]>([]);

  protected readonly action = signal<AuditAction[]>([]);
  protected readonly resourceType = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(50);

  protected readonly entries = signal<AuditLogEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly patientName = computed(() => this.entries().find(e => e.patientId === this.patientId())?.patientName ?? null);

  constructor() {
    inject(StaffApiService).list({ status: 'all' }).subscribe({ next: rows => this.staff.set(rows), error: () => undefined });
    effect(() => {
      const filters: AuditLogFilters = {
        patientId: this.patientId() || undefined,
        userId: this.userId() || undefined,
        action: this.action().length ? this.action() : undefined,
        resourceType: this.resourceType() || undefined,
        from: this.from() ? new Date(`${this.from()}T00:00:00`).toISOString() : undefined,
        to: this.to() ? new Date(`${this.to()}T23:59:59.999`).toISOString() : undefined,
        limit: this.pageSize(),
        offset: this.pageIndex() * this.pageSize(),
      };
      untracked(() => this.load(filters));
    });
  }

  protected setQuery(key: 'userId' | 'patientId', value: string | null): void {
    this.pageIndex.set(0);
    this.router.navigate([], { queryParams: { [key]: value || null }, queryParamsHandling: 'merge' });
  }

  protected setFilter<T>(target: { set(v: T): void }, value: T): void {
    this.pageIndex.set(0);
    target.set(value);
  }

  protected onPage(e: PageEvent): void {
    this.pageSize.set(e.pageSize);
    this.pageIndex.set(e.pageIndex);
  }

  protected actionLabel(a: AuditAction): string {
    return ACTION_LABELS[a] ?? a;
  }

  protected isSecurity(a: AuditAction): boolean {
    return SECURITY_ACTIONS.has(a);
  }

  protected roleLabel(role: string | null): string {
    return role ? ROLE_LABELS[role as UserRole] ?? role : '';
  }

  protected change(e: AuditLogEntry): string | null {
    if (e.fieldName) return `${e.fieldName}: ${shorten(e.oldValue)} → ${shorten(e.newValue)}`;
    if (e.oldValue || e.newValue) return [e.oldValue && shorten(e.oldValue), e.newValue && shorten(e.newValue)].filter(Boolean).join(' → ');
    return null;
  }

  protected exportCsv(): void {
    const header = ['Time', 'User', 'Role', 'Action', 'Resource', 'Resource ID', 'Patient', 'Field', 'Old value', 'New value', 'IP address'];
    const rows = this.entries().map(e => [
      new Date(e.createdAt).toISOString(), e.userName ?? '', e.userRole ?? '', e.action, e.resourceType, e.resourceId ?? '',
      e.patientName ?? e.patientId ?? '', e.fieldName ?? '', e.oldValue ?? '', e.newValue ?? '', e.ipAddress ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `audit-log-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  private load(filters: AuditLogFilters): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.auditLogs(filters).subscribe({
      next: page => {
        this.entries.set(page.entries);
        this.total.set(page.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('The audit log could not be loaded.');
      },
    });
  }
}
