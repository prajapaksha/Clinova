import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface TemporaryPasswordData {
  name: string;
  email: string;
  password: string;
  created?: boolean;
}

/** Shows a one-time temporary password; it is never retrievable again. */
@Component({
  selector: 'clv-temporary-password-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.created ? 'Account created' : 'Password reset' }}</h2>
    <mat-dialog-content class="tp">
      <p>Share this temporary password with <strong>{{ data.name }}</strong> ({{ data.email }}) through a secure channel.
        They'll be asked to choose a new password when they sign in.</p>
      <div class="tp__box">
        <code class="tp__pw" data-testid="temporary-password">{{ data.password }}</code>
        <button mat-icon-button type="button" (click)="copy()" [attr.aria-label]="copied() ? 'Copied' : 'Copy password'">
          <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
        </button>
      </div>
      <p class="tp__warn"><mat-icon>visibility_off</mat-icon> This password won't be shown again.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .tp { max-width: 440px; }
    .tp__box { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 8px 8px 16px; border: 1px dashed var(--clv-gray-300); border-radius: 8px; background: var(--clv-gray-100); }
    .tp__pw { font-size: 1.1rem; letter-spacing: 0.04em; user-select: all; }
    .tp__warn { display: flex; align-items: center; gap: 6px; color: var(--clv-warning-text); font-size: 0.85rem; }
    .tp__warn mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `,
})
export class TemporaryPasswordDialog {
  protected readonly data = inject<TemporaryPasswordData>(MAT_DIALOG_DATA);
  protected readonly copied = signal(false);

  protected copy(): void {
    navigator.clipboard?.writeText(this.data.password).then(() => this.copied.set(true), () => undefined);
  }
}
