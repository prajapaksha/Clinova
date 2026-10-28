import { Component, computed, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { CardInput } from '@clinova/portal/data-access';
import { cardBrand, cardDigits, isCardExpired, isValidCardNumber } from '@clinova/portal/domain';

/** Card entry (test mode). In production this is replaced by the processor's hosted fields. */
@Component({
  selector: 'clv-card-form',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule],
  template: `
    <div [formGroup]="form" class="cf">
      <mat-form-field appearance="outline" class="cf__wide">
        <mat-label>Card number</mat-label>
        <input matInput formControlName="number" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234" (input)="format()" />
        @if (brand()) { <span matSuffix class="cf__brand">{{ brand() }}</span> }
        @if (form.controls.number.touched && !numberOk()) { <mat-error>Check your card number</mat-error> }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Expiry (MM/YY)</mat-label>
        <input matInput formControlName="expiry" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Security code</mat-label>
        <input matInput formControlName="cvc" inputmode="numeric" autocomplete="cc-csc" maxlength="4" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="cf__wide">
        <mat-label>Name on card</mat-label>
        <input matInput formControlName="name" autocomplete="cc-name" />
      </mat-form-field>
      @if (offerSave()) {
        <mat-checkbox formControlName="save" class="cf__wide">Save this card for next time</mat-checkbox>
      }
      <p class="cf__test cf__wide">Test mode: use 4242 4242 4242 4242 with any future expiry. 4000 0000 0000 0002 is declined.</p>
    </div>
  `,
  styles: `
    .cf { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
    .cf__wide { grid-column: 1 / -1; }
    .cf__brand { padding-right: 12px; font-weight: 600; color: var(--clv-gray-600); }
    .cf__test { margin: 4px 0 0; font-size: 12px; color: var(--clv-gray-600); }
  `,
})
export class CardForm {
  readonly offerSave = input(false);
  readonly changed = output<void>();

  protected readonly form = new FormGroup({
    number: new FormControl('', { nonNullable: true, validators: Validators.required }),
    expiry: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})$/)] }),
    cvc: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{3,4}$/)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    save: new FormControl(true, { nonNullable: true }),
  });
  private readonly number = signal('');
  protected readonly brand = computed(() => (cardDigits(this.number()).length >= 2 ? cardBrand(this.number()).replace('Card', '') : ''));
  protected readonly numberOk = computed(() => isValidCardNumber(this.number()));

  protected format(): void {
    const digits = cardDigits(this.form.controls.number.value).slice(0, 19);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.form.controls.number.setValue(formatted, { emitEvent: false });
    this.number.set(formatted);
    this.changed.emit();
  }

  /** Validated card, or an error message. */
  value(): { card: CardInput; save: boolean } | { error: string } {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (!isValidCardNumber(v.number)) return { error: 'Check your card number.' };
    if (this.form.controls.expiry.invalid) return { error: 'Enter the expiry as MM/YY.' };
    const [mm, yy] = v.expiry.split('/').map(s => Number(s.trim()));
    const expYear = yy < 100 ? 2000 + yy : yy;
    if (isCardExpired(mm, expYear)) return { error: 'This card has expired.' };
    if (this.form.controls.cvc.invalid) return { error: 'Enter the 3 or 4 digit security code.' };
    if (this.form.controls.name.invalid) return { error: 'Enter the name on the card.' };
    return { card: { number: cardDigits(v.number), expMonth: mm, expYear, cvc: v.cvc, cardholderName: v.name.trim() }, save: v.save };
  }

  reset(): void {
    this.form.reset({ number: '', expiry: '', cvc: '', name: '', save: true });
    this.number.set('');
  }
}
