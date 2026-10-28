import { Component } from '@angular/core';
import type { CapabilityKey } from '@clinova/identity/domain';
import { PERMISSION_MATRIX, PermissionLevel, ROLE_LABELS, STAFF_ROLES } from '@clinova/identity/domain';

const CAPABILITIES: ReadonlyArray<{ key: CapabilityKey; label: string }> = [
  { key: 'patient:profiles', label: 'Patient profiles' },
  { key: 'clinical:notes', label: 'Clinical notes' },
  { key: 'scheduling:appointments', label: 'Appointments' },
  { key: 'clinical:prescriptions', label: 'Prescriptions' },
  { key: 'billing:invoices', label: 'Invoices & payments' },
  { key: 'staff:profiles', label: 'Staff profiles' },
  { key: 'reporting:reports', label: 'Reports & analytics' },
  { key: 'system:settings', label: 'System settings' },
  { key: 'identity:users', label: 'User management' },
  { key: 'identity:auditLogs', label: 'Audit logs' },
];

const LEVELS: Readonly<Record<PermissionLevel, { label: string; short: string }>> = {
  [PermissionLevel.Full]: { label: 'Full access', short: 'Full' },
  [PermissionLevel.Limited]: { label: 'Limited access', short: 'Limited' },
  [PermissionLevel.ReadOnly]: { label: 'Read only', short: 'Read' },
  [PermissionLevel.None]: { label: 'No access', short: '—' },
};

/** Read-only view of the PRD §3.2 permission matrix enforced by the API. */
@Component({
  selector: 'clv-permissions-matrix',
  template: `
    <div class="pm">
      <h2 class="pm__title">Roles & permissions</h2>
      <p class="pm__sub">Access for each role, enforced on every request. Limited access is a subset: e.g. front desk can edit
        demographics and insurance but not medical history; staff can edit their own profile only.</p>
      <div class="pm__wrap">
        <table class="pm__table">
          <thead>
            <tr><th scope="col">Capability</th>@for (r of roles; track r.role) { <th scope="col">{{ r.label }}</th> }</tr>
          </thead>
          <tbody>
            @for (c of capabilities; track c.key) {
              <tr>
                <th scope="row">{{ c.label }}</th>
                @for (r of roles; track r.role) {
                  <td><span class="pm__level" [attr.data-level]="level(r.role, c.key)" [attr.title]="levelLabel(r.role, c.key)">{{ levelShort(r.role, c.key) }}</span></td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .pm { background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; padding: 20px; }
    .pm__title { margin: 0; font-size: 1.15rem; }
    .pm__sub { margin: 4px 0 16px; color: var(--clv-gray-600); font-size: 0.875rem; max-width: 760px; }
    .pm__wrap { overflow-x: auto; }
    .pm__table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .pm__table th, .pm__table td { padding: 8px 10px; border-bottom: 1px solid var(--clv-gray-100); text-align: center; white-space: nowrap; }
    .pm__table thead th { font-size: 0.72rem; text-transform: uppercase; color: var(--clv-gray-600); border-bottom-color: var(--clv-gray-200); }
    .pm__table tbody th { text-align: left; font-weight: 500; }
    .pm__level { display: inline-block; min-width: 56px; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
    .pm__level[data-level='FULL'] { background: var(--clv-success-bg); color: var(--clv-success-text); }
    .pm__level[data-level='LIMITED'] { background: var(--clv-warning-bg); color: var(--clv-warning-text); }
    .pm__level[data-level='READ_ONLY'] { background: var(--clv-info-bg); color: var(--clv-info-text); }
    .pm__level[data-level='NONE'] { color: var(--clv-gray-400); }
  `,
})
export class PermissionsMatrixComponent {
  protected readonly roles = STAFF_ROLES.map(role => ({ role, label: ROLE_LABELS[role] }));
  protected readonly capabilities = CAPABILITIES;

  protected level(role: keyof typeof PERMISSION_MATRIX, key: CapabilityKey): PermissionLevel {
    return PERMISSION_MATRIX[role][key];
  }

  protected levelLabel(role: keyof typeof PERMISSION_MATRIX, key: CapabilityKey): string {
    return LEVELS[this.level(role, key)].label;
  }

  protected levelShort(role: keyof typeof PERMISSION_MATRIX, key: CapabilityKey): string {
    return LEVELS[this.level(role, key)].short;
  }
}
