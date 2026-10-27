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
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'clv-patient-new',
  standalone: true,
  imports: [
    RouterModule, ReactiveFormsModule,
    MatStepperModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './patient-new.component.html',
  styleUrl: './patient-new.component.scss',
})
export class PatientNewComponent {
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
    bloodType:         new FormControl('UNKNOWN'),
    maritalStatus:     new FormControl(''),
    preferredLanguage: new FormControl('English'),
    allergiesNote:     new FormControl(''),
  });

  protected readonly consentForm = new FormGroup({
    privacyPolicy:     new FormControl(false, { validators: [Validators.requiredTrue] }),
    telehealthConsent: new FormControl(false),
    marketingConsent:  new FormControl(false),
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
