import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PatientApiService } from '@clinova/patient/data-access';
import type { CreatePatientDto } from '@clinova/patient/data-access';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'clv-patient-new',
  standalone: true,
  imports: [
    RouterModule, ReactiveFormsModule,
    MatStepperModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="pnew">

      <div class="pnew__header">
        <button mat-icon-button routerLink="/patients" matTooltip="Back to patients">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div>
          <h1 class="pnew__title">Register New Patient</h1>
          <p class="pnew__subtitle">Complete all required fields to create the patient record.</p>
        </div>
      </div>

      @if (submitError()) {
        <div class="pnew__error-banner">
          <mat-icon>error</mat-icon>
          {{ submitError() }}
        </div>
      }

      <mat-stepper linear class="pnew__stepper" #stepper>

        <!-- Step 1: Identity -->
        <mat-step [stepControl]="identityForm" label="Identity">
          <form [formGroup]="identityForm" class="pnew__form">
            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field pnew__field--sm">
                <mat-label>Title</mat-label>
                <mat-select formControlName="title">
                  <mat-option value="">—</mat-option>
                  @for (t of titles; track t) {
                    <mat-option [value]="t">{{ t }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>First Name *</mat-label>
                <input matInput formControlName="firstName" placeholder="Given name" />
                @if (identityForm.get('firstName')?.invalid && identityForm.get('firstName')?.touched) {
                  <mat-error>First name is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field pnew__field--sm">
                <mat-label>Middle Name</mat-label>
                <input matInput formControlName="middleName" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Last Name *</mat-label>
                <input matInput formControlName="lastName" placeholder="Family name" />
                @if (identityForm.get('lastName')?.invalid && identityForm.get('lastName')?.touched) {
                  <mat-error>Last name is required.</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Preferred Name / Nickname</mat-label>
                <input matInput formControlName="preferredName" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Date of Birth *</mat-label>
                <input matInput type="date" formControlName="dateOfBirth" />
                @if (identityForm.get('dateOfBirth')?.invalid && identityForm.get('dateOfBirth')?.touched) {
                  <mat-error>Date of birth is required.</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Sex Assigned at Birth *</mat-label>
                <mat-select formControlName="sex">
                  <mat-option value="MALE">Male</mat-option>
                  <mat-option value="FEMALE">Female</mat-option>
                  <mat-option value="INTERSEX">Intersex</mat-option>
                  <mat-option value="UNKNOWN">Unknown / Not reported</mat-option>
                </mat-select>
                @if (identityForm.get('sex')?.invalid && identityForm.get('sex')?.touched) {
                  <mat-error>Sex is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Gender Identity</mat-label>
                <mat-select formControlName="genderIdentity">
                  <mat-option value="">Prefer not to say</mat-option>
                  <mat-option value="MAN">Man</mat-option>
                  <mat-option value="WOMAN">Woman</mat-option>
                  <mat-option value="NON_BINARY">Non-binary</mat-option>
                  <mat-option value="TRANSGENDER_MAN">Transgender man</mat-option>
                  <mat-option value="TRANSGENDER_WOMAN">Transgender woman</mat-option>
                  <mat-option value="GENDER_FLUID">Gender fluid</mat-option>
                  <mat-option value="OTHER">Other</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field pnew__field--sm">
                <mat-label>Pronouns</mat-label>
                <input matInput formControlName="pronouns" placeholder="e.g. she/her" />
              </mat-form-field>
            </div>

            <div class="pnew__step-actions">
              <button mat-flat-button matStepperNext [disabled]="identityForm.invalid">
                Next <mat-icon iconPositionEnd>arrow_forward</mat-icon>
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Step 2: Contact -->
        <mat-step [stepControl]="contactForm" label="Contact">
          <form [formGroup]="contactForm" class="pnew__form">
            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Primary Phone *</mat-label>
                <mat-icon matPrefix>phone</mat-icon>
                <input matInput formControlName="primaryPhone" type="tel" placeholder="+1 (555) 000-0000" />
                @if (contactForm.get('primaryPhone')?.invalid && contactForm.get('primaryPhone')?.touched) {
                  <mat-error>Valid phone number is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Secondary Phone</mat-label>
                <mat-icon matPrefix>phone</mat-icon>
                <input matInput formControlName="secondaryPhone" type="tel" />
              </mat-form-field>
            </div>

            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Email</mat-label>
                <mat-icon matPrefix>email</mat-icon>
                <input matInput formControlName="email" type="email" placeholder="patient@example.com" />
                @if (contactForm.get('email')?.invalid && contactForm.get('email')?.touched) {
                  <mat-error>Please enter a valid email address.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Preferred Contact Method</mat-label>
                <mat-select formControlName="preferredMethod">
                  <mat-option value="PHONE">Phone</mat-option>
                  <mat-option value="SMS">SMS / Text</mat-option>
                  <mat-option value="EMAIL">Email</mat-option>
                  <mat-option value="PATIENT_PORTAL">Patient Portal</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="pnew__section-label">Mailing Address</div>

            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field pnew__field--wide">
                <mat-label>Street Address *</mat-label>
                <input matInput formControlName="street1" placeholder="123 Main St" />
                @if (contactForm.get('street1')?.invalid && contactForm.get('street1')?.touched) {
                  <mat-error>Street address is required.</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>City *</mat-label>
                <input matInput formControlName="city" />
                @if (contactForm.get('city')?.invalid && contactForm.get('city')?.touched) {
                  <mat-error>City is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field pnew__field--sm">
                <mat-label>State *</mat-label>
                <input matInput formControlName="state" placeholder="CA" maxlength="2" />
                @if (contactForm.get('state')?.invalid && contactForm.get('state')?.touched) {
                  <mat-error>State is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field pnew__field--sm">
                <mat-label>Zip Code *</mat-label>
                <input matInput formControlName="postalCode" placeholder="90210" />
                @if (contactForm.get('postalCode')?.invalid && contactForm.get('postalCode')?.touched) {
                  <mat-error>Zip code is required.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field pnew__field--sm">
                <mat-label>Country</mat-label>
                <input matInput formControlName="country" />
              </mat-form-field>
            </div>

            <div class="pnew__step-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-flat-button matStepperNext [disabled]="contactForm.invalid">
                Next <mat-icon iconPositionEnd>arrow_forward</mat-icon>
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Step 3: Insurance -->
        <mat-step [stepControl]="insuranceForm" label="Insurance">
          <form [formGroup]="insuranceForm" class="pnew__form">
            <p class="pnew__optional-note">Insurance information is optional and can be added later.</p>

            <mat-checkbox formControlName="hasPrimary" class="pnew__checkbox">
              Patient has primary insurance
            </mat-checkbox>

            @if (insuranceForm.get('hasPrimary')?.value) {
              <div class="pnew__ins-section">
                <div class="pnew__row">
                  <mat-form-field appearance="outline" class="pnew__field">
                    <mat-label>Insurance Provider</mat-label>
                    <input matInput formControlName="provider" placeholder="Blue Cross Blue Shield" />
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="pnew__field">
                    <mat-label>Policy Number</mat-label>
                    <input matInput formControlName="policyNumber" />
                  </mat-form-field>
                </div>

                <div class="pnew__row">
                  <mat-form-field appearance="outline" class="pnew__field">
                    <mat-label>Group Number</mat-label>
                    <input matInput formControlName="groupNumber" />
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="pnew__field">
                    <mat-label>Subscriber Name</mat-label>
                    <input matInput formControlName="subscriberName" />
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="pnew__field">
                    <mat-label>Subscriber Relationship</mat-label>
                    <mat-select formControlName="relationship">
                      <mat-option value="SELF">Self</mat-option>
                      <mat-option value="SPOUSE">Spouse</mat-option>
                      <mat-option value="CHILD">Child</mat-option>
                      <mat-option value="OTHER">Other</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>
            }

            <div class="pnew__step-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-flat-button matStepperNext>
                Next <mat-icon iconPositionEnd>arrow_forward</mat-icon>
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Step 4: Medical History -->
        <mat-step [stepControl]="medicalForm" label="Medical History">
          <form [formGroup]="medicalForm" class="pnew__form">
            <p class="pnew__optional-note">All medical fields are optional. Details can be updated from the patient's chart.</p>

            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Blood Type</mat-label>
                <mat-select formControlName="bloodType">
                  <mat-option value="UNKNOWN">Unknown</mat-option>
                  <mat-option value="A_POSITIVE">A+</mat-option>
                  <mat-option value="A_NEGATIVE">A−</mat-option>
                  <mat-option value="B_POSITIVE">B+</mat-option>
                  <mat-option value="B_NEGATIVE">B−</mat-option>
                  <mat-option value="AB_POSITIVE">AB+</mat-option>
                  <mat-option value="AB_NEGATIVE">AB−</mat-option>
                  <mat-option value="O_POSITIVE">O+</mat-option>
                  <mat-option value="O_NEGATIVE">O−</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Marital Status</mat-label>
                <mat-select formControlName="maritalStatus">
                  <mat-option value="">—</mat-option>
                  <mat-option value="SINGLE">Single</mat-option>
                  <mat-option value="MARRIED">Married</mat-option>
                  <mat-option value="DIVORCED">Divorced</mat-option>
                  <mat-option value="WIDOWED">Widowed</mat-option>
                  <mat-option value="SEPARATED">Separated</mat-option>
                  <mat-option value="DOMESTIC_PARTNER">Domestic Partner</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="pnew__field">
                <mat-label>Preferred Language</mat-label>
                <input matInput formControlName="preferredLanguage" placeholder="English" />
              </mat-form-field>
            </div>

            <div class="pnew__row">
              <mat-form-field appearance="outline" class="pnew__field pnew__field--wide">
                <mat-label>Known Allergies (brief description)</mat-label>
                <textarea matInput formControlName="allergiesNote" rows="2"
                          placeholder="e.g. Penicillin – rash; Peanuts – anaphylaxis"></textarea>
                <mat-hint>Full allergy management is available on the Medical tab after registration.</mat-hint>
              </mat-form-field>
            </div>

            <div class="pnew__step-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-flat-button matStepperNext>
                Next <mat-icon iconPositionEnd>arrow_forward</mat-icon>
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Step 5: Consent -->
        <mat-step [stepControl]="consentForm" label="Consent">
          <form [formGroup]="consentForm" class="pnew__form">

            <div class="pnew__consent-card">
              <mat-icon class="pnew__consent-icon">gavel</mat-icon>
              <div>
                <h3 class="pnew__consent-title">Privacy Policy &amp; Consent</h3>
                <p class="pnew__consent-text">
                  By registering this patient, you confirm that the patient has been informed of
                  the practice's privacy policies and their rights under HIPAA.
                </p>
              </div>
            </div>

            <div class="pnew__checkboxes">
              <mat-checkbox formControlName="privacyPolicy" color="primary">
                <span class="pnew__required-label">
                  Patient acknowledges the Privacy Policy and Notice of Privacy Practices *
                </span>
              </mat-checkbox>
              @if (consentForm.get('privacyPolicy')?.invalid && consentForm.get('privacyPolicy')?.touched) {
                <p class="pnew__checkbox-error">Acknowledgement is required to register the patient.</p>
              }

              <mat-checkbox formControlName="telehealthConsent" color="primary">
                Patient consents to telehealth services
              </mat-checkbox>

              <mat-checkbox formControlName="marketingConsent" color="primary">
                Patient opts in to health reminders and marketing communications
              </mat-checkbox>
            </div>

            <div class="pnew__step-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-flat-button
                      color="primary"
                      [disabled]="consentForm.invalid || submitting()"
                      (click)="submit()">
                @if (submitting()) {
                  <mat-spinner diameter="18" class="pnew__btn-spinner" />
                } @else {
                  <mat-icon>person_add</mat-icon>
                }
                Register Patient
              </button>
            </div>

          </form>
        </mat-step>

      </mat-stepper>
    </div>
  `,
  styleUrl: './patient-new.scss',
})
export class PatientNewPage {
  private readonly api = inject(PatientApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly titles = ['Dr', 'Mr', 'Mrs', 'Ms', 'Mx', 'Prof'];

  protected readonly identityForm = new FormGroup({
    title:          new FormControl(''),
    firstName:      new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    middleName:     new FormControl(''),
    lastName:       new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    preferredName:  new FormControl(''),
    dateOfBirth:    new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sex:            new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    genderIdentity: new FormControl(''),
    pronouns:       new FormControl(''),
  });

  protected readonly contactForm = new FormGroup({
    primaryPhone:    new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    secondaryPhone:  new FormControl(''),
    email:           new FormControl('', { validators: [Validators.email] }),
    preferredMethod: new FormControl('PHONE'),
    street1:         new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    city:            new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    state:           new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    postalCode:      new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    country:         new FormControl('US'),
  });

  protected readonly insuranceForm = new FormGroup({
    hasPrimary:      new FormControl(false),
    provider:        new FormControl(''),
    policyNumber:    new FormControl(''),
    groupNumber:     new FormControl(''),
    subscriberName:  new FormControl(''),
    relationship:    new FormControl('SELF'),
  });

  protected readonly medicalForm = new FormGroup({
    bloodType:        new FormControl('UNKNOWN'),
    maritalStatus:    new FormControl(''),
    preferredLanguage: new FormControl('English'),
    allergiesNote:    new FormControl(''),
  });

  protected readonly consentForm = new FormGroup({
    privacyPolicy:    new FormControl(false, { validators: [Validators.requiredTrue] }),
    telehealthConsent: new FormControl(false),
    marketingConsent: new FormControl(false),
  });

  protected submit(): void {
    if (this.consentForm.invalid) {
      this.consentForm.markAllAsTouched();
      return;
    }

    const iv = this.identityForm.getRawValue();
    const cv = this.contactForm.getRawValue();

    const dto: CreatePatientDto = {
      firstName:   iv.firstName,
      lastName:    iv.lastName,
      dateOfBirth: iv.dateOfBirth,
      sex:         iv.sex,
      contact: {
        primaryPhone: cv.primaryPhone,
        email: cv.email || undefined,
        mailingAddress: {
          street1:    cv.street1,
          city:       cv.city,
          state:      cv.state,
          postalCode: cv.postalCode,
          country:    cv.country || 'US',
        },
      },
    };

    this.submitting.set(true);
    this.submitError.set(null);

    this.api.create(dto).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: patient => this.router.navigate(['/patients', patient.id]),
      error: (e: Error) => {
        this.submitError.set(e.message ?? 'Registration failed. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
