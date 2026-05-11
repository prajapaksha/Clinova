import { Component, computed, inject } from '@angular/core';
import { PatientStore } from '@clinova/patient/data-access';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-billing-tab',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatCardModule],
  template: `
    @if (patient(); as p) {
      <div class="bil">

        <!-- Balance Summary -->
        <div class="bil__summary-row">
          <mat-card class="bil__kpi-card">
            <mat-card-content>
              <div class="bil__kpi-label">Current Balance</div>
              <div class="bil__kpi-value">$0.00</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="bil__kpi-card bil__kpi-card--warn">
            <mat-card-content>
              <div class="bil__kpi-label">Overdue</div>
              <div class="bil__kpi-value">$0.00</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="bil__kpi-card">
            <mat-card-content>
              <div class="bil__kpi-label">Last Payment</div>
              <div class="bil__kpi-value">—</div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Insurance -->
        @if (p.insurancePolicies.length) {
          <mat-card class="bil__card">
            <mat-card-header>
              <mat-icon mat-card-avatar>health_and_safety</mat-icon>
              <mat-card-title>Insurance on File</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @for (ins of p.insurancePolicies; track ins.id) {
                <div class="bil__ins-row">
                  <div>
                    <strong>{{ ins.provider }}</strong>
                    <span class="bil__badge">{{ ins.isPrimary ? 'Primary' : 'Secondary' }}</span>
                  </div>
                  <div class="bil__ins-meta">Policy {{ ins.policyNumber }}</div>
                </div>
              }
            </mat-card-content>
          </mat-card>
        }

        <!-- Invoices -->
        <div class="bil__inv-header">
          <h2 class="bil__section-title">Invoices</h2>
          <button mat-stroked-button>
            <mat-icon>add</mat-icon> New Invoice
          </button>
        </div>

        <div class="bil__empty">
          <mat-icon class="bil__empty-icon">receipt_long</mat-icon>
          <p>No invoices on record.</p>
          <p class="bil__hint">Billing data will appear once the billing module is connected.</p>
        </div>

      </div>
    }
  `,
  styles: [`
    .bil {
      padding: 24px;

      &__summary-row {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }

      &__kpi-card {
        &--warn .bil__kpi-value { color: #dc2626; }
      }

      &__kpi-label {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant, #6b7280);
        margin-bottom: 4px;
      }

      &__kpi-value { font-size: 1.75rem; font-weight: 600; }

      &__card { margin-bottom: 24px; }

      &__ins-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 0;
        &:not(:last-child) { border-bottom: 1px solid var(--mat-sys-outline-variant, #e5e7eb); }
      }

      &__badge {
        font-size: 0.75rem;
        padding: 1px 8px;
        border-radius: 10px;
        background: #dbeafe;
        color: #1e40af;
        margin-left: 8px;
      }

      &__ins-meta { font-size: 0.875rem; color: var(--mat-sys-on-surface-variant, #9ca3af); }

      &__inv-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      &__section-title { font-size: 1rem; font-weight: 600; margin: 0; }

      &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 48px 24px;
        border: 1px dashed var(--mat-sys-outline, #d1d5db);
        border-radius: 8px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant, #9ca3af);
      }

      &__empty-icon {
        font-size: 48px !important;
        width: 48px;
        height: 48px;
        opacity: 0.3;
      }

      &__hint { font-size: 0.875rem; }
    }
  `],
})
export class BillingTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}
