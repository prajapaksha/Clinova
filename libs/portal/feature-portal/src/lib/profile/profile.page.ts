import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { EditableProfile, PreferencesResponse } from '@clinova/portal/data-access';
import { PortalApiService, PortalSession } from '@clinova/portal/data-access';
import type { NotificationChannel, NotificationTopic, ProfileChangeField, ProfileChangeRequest } from '@clinova/portal/domain';
import { PROFILE_FIELD_LABELS } from '@clinova/portal/domain';
import { PasswordRules, errorMessage, passwordOk } from '../shared/portal-shared';

type Tab = 'details' | 'notifications' | 'security';
const text = (v = '') => new FormControl(v, { nonNullable: true });

@Component({
  selector: 'clv-portal-profile',
  imports: [
    DatePipe, FormsModule, ReactiveFormsModule, RouterModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatSelectModule, PasswordRules,
  ],
  templateUrl: './profile.page.html',
  styles: `
    .pf__h3 { margin: 18px 0 10px; font-size: 15px; color: var(--clv-gray-700); grid-column: 1 / -1; }
    .pf__prefs { width: 100%; border-collapse: collapse; }
    .pf__prefs th, .pf__prefs td { padding: 12px 8px; border-bottom: 1px solid var(--clv-gray-100); text-align: left; }
    .pf__prefs td.c, .pf__prefs th.c { text-align: center; width: 80px; }
    .pf__pw { max-width: 440px; display: flex; flex-direction: column; }
    .pf__req { margin-bottom: 16px; }
  `,
})
export class PortalProfilePage {
  private readonly api = inject(PortalApiService);
  private readonly session = inject(PortalSession);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  readonly tab = input<string>();
  protected readonly active = computed<Tab>(() => (['details', 'notifications', 'security'].includes(this.tab() ?? '') ? this.tab() as Tab : 'details'));
  protected readonly labels = PROFILE_FIELD_LABELS;

  protected readonly profile = signal<EditableProfile | null>(null);
  protected readonly requests = signal<ProfileChangeRequest[]>([]);
  protected readonly prefs = signal<PreferencesResponse | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    preferredName: text(), pronouns: text(), preferredLanguage: text('English'),
    primaryPhone: new FormControl('', { nonNullable: true, validators: Validators.required }),
    secondaryPhone: text(), email: new FormControl('', { nonNullable: true, validators: Validators.email }), preferredMethod: text('PHONE'),
    street1: new FormControl('', { nonNullable: true, validators: Validators.required }), street2: text(),
    city: new FormControl('', { nonNullable: true, validators: Validators.required }),
    state: new FormControl('', { nonNullable: true, validators: Validators.required }),
    postalCode: new FormControl('', { nonNullable: true, validators: Validators.required }),
    ecName: text(), ecRelationship: text(), ecPhone: text(),
    insProvider: text(), insPolicy: text(), insGroup: text(), insSubscriber: text(), insRelationship: text('SELF'),
  });

  protected readonly pw = new FormGroup({ current: text(), next: text(), confirm: text() });
  protected readonly pwValue = toSignal(this.pw.valueChanges, { initialValue: this.pw.getRawValue() });
  protected readonly pwOk = computed(() => !!this.pwValue().current && passwordOk(this.pwValue().next ?? '') && this.pwValue().next === this.pwValue().confirm);

  constructor() {
    this.load();
    this.api.preferences().subscribe(p => this.prefs.set(p));
  }

  protected setTab(tab: Tab): void {
    this.router.navigate([], { queryParams: { tab: tab === 'details' ? null : tab }, replaceUrl: true });
  }

  protected fields(r: ProfileChangeRequest): string {
    return (Object.keys(r.changes) as ProfileChangeField[]).map(f => this.labels[f]).join(', ');
  }

  protected submit(): void {
    const p = this.profile();
    if (!p) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please complete the required fields.');
      return;
    }
    const v = this.form.getRawValue();
    const policy = p.insurancePolicies[0];
    const changes = {
      preferredName: v.preferredName || null,
      pronouns: v.pronouns || null,
      preferredLanguage: v.preferredLanguage || 'English',
      contact: {
        primaryPhone: v.primaryPhone, secondaryPhone: v.secondaryPhone || null, email: v.email || null, preferredMethod: v.preferredMethod,
        mailingAddress: { street1: v.street1, street2: v.street2 || null, city: v.city, state: v.state, postalCode: v.postalCode, country: p.contact.mailingAddress.country ?? 'US' },
        billingAddress: p.contact.billingAddress,
      },
      emergencyContacts: [
        ...(v.ecName && v.ecPhone ? [{ name: v.ecName, relationship: v.ecRelationship, phone: v.ecPhone }] : []),
        ...p.emergencyContacts.slice(1),
      ],
      insurancePolicies: v.insProvider && v.insPolicy
        ? [{ ...(policy ?? {}), provider: v.insProvider, policyNumber: v.insPolicy, groupNumber: v.insGroup || null, subscriberName: v.insSubscriber, relationship: v.insRelationship }, ...p.insurancePolicies.slice(1)]
        : p.insurancePolicies,
    };
    this.busy.set(true);
    this.error.set(null);
    this.api.requestProfileChange(changes).subscribe({
      next: () => {
        this.busy.set(false);
        this.snack.open('Thanks! The office will review your changes, usually within 1 business day.', 'OK', { duration: 6000 });
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  protected toggle(topic: NotificationTopic, channel: NotificationChannel, value: boolean): void {
    const current = this.prefs();
    if (!current) return;
    const preferences = { ...current.preferences, [topic]: { ...current.preferences[topic], [channel]: value } };
    this.prefs.set({ ...current, preferences });
    this.api.savePreferences(preferences).subscribe({
      next: p => this.prefs.set(p),
      error: err => this.snack.open(errorMessage(err), 'OK', { duration: 4000 }),
    });
  }

  protected changePassword(): void {
    const v = this.pw.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.session.changePassword(v.current, v.next).subscribe({
      next: () => {
        this.busy.set(false);
        this.pw.reset();
        this.snack.open('Your password was changed.', 'OK', { duration: 4000 });
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  private load(): void {
    this.api.profile().subscribe({
      next: p => {
        this.profile.set(p);
        const c = p.contact;
        const ec = p.emergencyContacts[0];
        const ins = p.insurancePolicies[0];
        this.form.reset({
          preferredName: p.preferredName ?? '', pronouns: p.pronouns ?? '', preferredLanguage: p.preferredLanguage,
          primaryPhone: c.primaryPhone ?? '', secondaryPhone: c.secondaryPhone ?? '', email: c.email ?? '', preferredMethod: c.preferredMethod ?? 'PHONE',
          street1: c.mailingAddress?.street1 ?? '', street2: c.mailingAddress?.street2 ?? '', city: c.mailingAddress?.city ?? '',
          state: c.mailingAddress?.state ?? '', postalCode: c.mailingAddress?.postalCode ?? '',
          ecName: ec?.name ?? '', ecRelationship: ec?.relationship ?? '', ecPhone: ec?.phone ?? '',
          insProvider: ins?.provider ?? '', insPolicy: ins?.policyNumber ?? '', insGroup: ins?.groupNumber ?? '',
          insSubscriber: ins?.subscriberName ?? '', insRelationship: ins?.relationship ?? 'SELF',
        });
      },
      error: err => this.error.set(errorMessage(err)),
    });
    this.api.profileRequests().subscribe(r => this.requests.set(r));
  }
}
