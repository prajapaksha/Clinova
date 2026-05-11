import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { PatientStore } from '@clinova/patient/data-access';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'clv-summary-tab',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, MatCardModule, MatIconModule, MatDividerModule, MatChipsModule],
  template: `
    @if (patient(); as p) {
      <div class="sum">

        <!-- Demographics -->
        <mat-card class="sum__card">
          <mat-card-header>
            <mat-icon mat-card-avatar>person</mat-icon>
            <mat-card-title>Demographics</mat-card-title>
          </mat-card-header>
          <mat-card-content class="sum__grid">
            <div class="sum__field">
              <span class="sum__label">Full Name</span>
              <span>
                @if (p.title) { {{ p.title }}. }
                {{ p.firstName }}
                @if (p.middleName) { {{ p.middleName }} }
                {{ p.lastName }}
              </span>
            </div>
            <div class="sum__field">
              <span class="sum__label">Date of Birth</span>
              <span>{{ p.dateOfBirth | date:'longDate' }}</span>
            </div>
            <div class="sum__field">
              <span class="sum__label">Sex Assigned at Birth</span>
              <span>{{ p.sex }}</span>
            </div>
            @if (p.genderIdentity) {
              <div class="sum__field">
                <span class="sum__label">Gender Identity</span>
                <span>{{ p.genderIdentity }}</span>
              </div>
            }
            @if (p.pronouns) {
              <div class="sum__field">
                <span class="sum__label">Pronouns</span>
                <span>{{ p.pronouns }}</span>
              </div>
            }
            @if (p.maritalStatus) {
              <div class="sum__field">
                <span class="sum__label">Marital Status</span>
                <span>{{ p.maritalStatus }}</span>
              </div>
            }
            <div class="sum__field">
              <span class="sum__label">Preferred Language</span>
              <span>{{ p.preferredLanguage || 'English' }}</span>
            </div>
            @if (p.occupation) {
              <div class="sum__field">
                <span class="sum__label">Occupation</span>
                <span>{{ p.occupation }}</span>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Contact -->
        <mat-card class="sum__card">
          <mat-card-header>
            <mat-icon mat-card-avatar>contacts</mat-icon>
            <mat-card-title>Contact</mat-card-title>
          </mat-card-header>
          <mat-card-content class="sum__grid">
            <div class="sum__field">
              <span class="sum__label">Primary Phone</span>
              <a href="tel:{{ p.contact.primaryPhone }}" class="sum__link">{{ p.contact.primaryPhone }}</a>
            </div>
            @if (p.contact.secondaryPhone) {
              <div class="sum__field">
                <span class="sum__label">Secondary Phone</span>
                <a href="tel:{{ p.contact.secondaryPhone }}" class="sum__link">{{ p.contact.secondaryPhone }}</a>
              </div>
            }
            @if (p.contact.email) {
              <div class="sum__field">
                <span class="sum__label">Email</span>
                <a href="mailto:{{ p.contact.email }}" class="sum__link">{{ p.contact.email }}</a>
              </div>
            }
            <div class="sum__field sum__field--full">
              <span class="sum__label">Mailing Address</span>
              <span>
                {{ p.contact.mailingAddress.street1 }}
                @if (p.contact.mailingAddress.street2) {, {{ p.contact.mailingAddress.street2 }}}
                <br>{{ p.contact.mailingAddress.city }}, {{ p.contact.mailingAddress.state }} {{ p.contact.mailingAddress.postalCode }}
              </span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Emergency Contacts -->
        @if (p.emergencyContacts.length) {
          <mat-card class="sum__card">
            <mat-card-header>
              <mat-icon mat-card-avatar>emergency</mat-icon>
              <mat-card-title>Emergency Contacts</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @for (ec of p.emergencyContacts; track ec.name; let last = $last) {
                <div class="sum__ec">
                  <div class="sum__ec-name">{{ ec.name }}</div>
                  <div class="sum__ec-meta">
                    {{ ec.relationship }} ·
                    <a href="tel:{{ ec.phone }}" class="sum__link">{{ ec.phone }}</a>
                  </div>
                </div>
                @if (!last) { <mat-divider class="sum__divider" /> }
              }
            </mat-card-content>
          </mat-card>
        }

        <!-- Insurance -->
        @if (p.insurancePolicies.length) {
          <mat-card class="sum__card">
            <mat-card-header>
              <mat-icon mat-card-avatar>health_and_safety</mat-icon>
              <mat-card-title>Insurance</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @for (ins of p.insurancePolicies; track ins.id; let last = $last) {
                <div class="sum__insurance">
                  <div class="sum__insurance-hdr">
                    <strong>{{ ins.provider }}</strong>
                    <span class="sum__badge" [class.sum__badge--primary]="ins.isPrimary">
                      {{ ins.isPrimary ? 'Primary' : 'Secondary' }}
                    </span>
                  </div>
                  <div class="sum__grid">
                    <div class="sum__field">
                      <span class="sum__label">Policy #</span>
                      <code class="sum__code">{{ ins.policyNumber }}</code>
                    </div>
                    @if (ins.groupNumber) {
                      <div class="sum__field">
                        <span class="sum__label">Group #</span>
                        <code class="sum__code">{{ ins.groupNumber }}</code>
                      </div>
                    }
                    <div class="sum__field">
                      <span class="sum__label">Subscriber</span>
                      <span>{{ ins.subscriberName }} ({{ ins.relationship }})</span>
                    </div>
                    @if (ins.copayAmountCents != null) {
                      <div class="sum__field">
                        <span class="sum__label">Co-pay</span>
                        <span>{{ ins.copayAmountCents / 100 | currency }}</span>
                      </div>
                    }
                    @if (ins.deductibleAmountCents != null) {
                      <div class="sum__field">
                        <span class="sum__label">Deductible</span>
                        <span>{{ ins.deductibleAmountCents / 100 | currency }}</span>
                      </div>
                    }
                    <div class="sum__field">
                      <span class="sum__label">Effective</span>
                      <span>{{ ins.effectiveDate | date:'mediumDate' }}
                        @if (ins.expirationDate) { — {{ ins.expirationDate | date:'mediumDate' }} }
                      </span>
                    </div>
                  </div>
                </div>
                @if (!last) { <mat-divider class="sum__divider" /> }
              }
            </mat-card-content>
          </mat-card>
        }

        <!-- Active Alerts -->
        @if (store.selectedActiveAlerts().length) {
          <mat-card class="sum__card sum__card--alerts">
            <mat-card-header>
              <mat-icon mat-card-avatar class="sum__alert-avatar">notification_important</mat-icon>
              <mat-card-title>Active Alerts</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @for (alert of store.selectedActiveAlerts(); track alert.id) {
                <div class="sum__alert" [attr.data-severity]="alert.severity">
                  <mat-icon>{{ alert.severity === 'CRITICAL' ? 'error' : 'warning' }}</mat-icon>
                  <span>{{ alert.message }}</span>
                </div>
              }
            </mat-card-content>
          </mat-card>
        }

        <!-- Consent -->
        <mat-card class="sum__card">
          <mat-card-header>
            <mat-icon mat-card-avatar>gavel</mat-icon>
            <mat-card-title>Consent &amp; Privacy</mat-card-title>
          </mat-card-header>
          <mat-card-content class="sum__grid">
            <div class="sum__field">
              <span class="sum__label">Privacy Policy</span>
              @if (p.consent.privacyPolicySignedAt) {
                <span class="sum__ok">
                  <mat-icon>check_circle</mat-icon>
                  Signed {{ p.consent.privacyPolicySignedAt | date:'mediumDate' }}
                </span>
              } @else {
                <span class="sum__pending">Not signed</span>
              }
            </div>
            <div class="sum__field">
              <span class="sum__label">Marketing Consent</span>
              <span>{{ p.consent.marketingConsent ? 'Opted in' : 'Opted out' }}</span>
            </div>
            <div class="sum__field">
              <span class="sum__label">Telehealth Consent</span>
              <span>{{ p.consent.telehealthConsent ? 'Agreed' : 'Not agreed' }}</span>
            </div>
          </mat-card-content>
        </mat-card>

      </div>
    }
  `,
  styles: [`
    .sum {
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 16px;
      align-items: start;

      &__card { &--alerts { border-left: 4px solid #dc2626; } }

      &__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 4px 0;
      }

      &__field {
        display: flex;
        flex-direction: column;
        gap: 2px;
        &--full { grid-column: 1 / -1; }
      }

      &__label {
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant, #6b7280);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      &__link { color: var(--clv-brand, #00796b); text-decoration: none; &:hover { text-decoration: underline; } }
      &__code { font-family: monospace; font-size: 0.875rem; }

      &__ec { padding: 8px 0; }
      &__ec-name { font-weight: 500; }
      &__ec-meta { font-size: 0.875rem; color: var(--mat-sys-on-surface-variant, #666); }

      &__divider { margin: 8px 0; }

      &__insurance-hdr {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      &__badge {
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 10px;
        background: var(--mat-sys-surface-container, #f3f4f6);
        &--primary { background: #dbeafe; color: #1e40af; }
      }

      &__alert {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        &[data-severity="CRITICAL"] { color: #dc2626; }
        &[data-severity="HIGH"] { color: #d97706; }
      }

      &__alert-avatar { color: #dc2626 !important; }

      &__ok {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #059669;
        mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }
      }

      &__pending { color: var(--mat-sys-on-surface-variant, #9ca3af); font-style: italic; }
    }
  `],
})
export class SummaryTab {
  protected readonly store = inject(PatientStore);
  protected readonly patient = computed(() => this.store.selectedPatient());
}
