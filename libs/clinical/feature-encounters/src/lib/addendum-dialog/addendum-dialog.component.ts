import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Collects addendum text for a signed note; closes with the trimmed text. */
@Component({
  selector: 'clv-addendum-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Add addendum</h2>
    <mat-dialog-content>
      <p class="hint">The signed note stays unchanged. Your addendum is timestamped and attributed to you.</p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Addendum</mat-label>
        <textarea matInput [formControl]="content" rows="6" maxlength="20000" cdkFocusInitial></textarea>
        @if (content.touched && content.invalid) { <mat-error>Enter the addendum text</mat-error> }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()">Add addendum</button>
    </mat-dialog-actions>
  `,
  styles: `
    .full { width: 100%; }
    .hint { margin: 0 0 12px; font-size: 0.875rem; color: var(--clv-gray-600); }
  `,
})
export class AddendumDialog {
  private readonly dialogRef = inject(MatDialogRef<AddendumDialog, string>);
  protected readonly content = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  protected submit(): void {
    const text = this.content.value.trim();
    if (!text) {
      this.content.markAsTouched();
      this.content.setErrors({ required: true });
      return;
    }
    this.dialogRef.close(text);
  }
}
