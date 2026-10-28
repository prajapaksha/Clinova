import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ShareDocumentData {
  name: string;
  isResult: boolean;
}

/** Confirms sharing a document with the patient portal; results carry the physician's note. */
@Component({
  selector: 'clv-share-document-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.isResult ? 'Release result to patient' : 'Share with patient' }}</h2>
    <mat-dialog-content>
      <p><strong>{{ data.name }}</strong> will appear in the patient portal and the patient will be notified.</p>
      <mat-form-field appearance="outline" class="sd__note">
        <mat-label>{{ data.isResult ? 'Note for the patient (recommended)' : 'Note (optional)' }}</mat-label>
        <textarea matInput rows="4" maxlength="2000" [(ngModel)]="note"
                  [placeholder]="data.isResult ? 'e.g. Your results are normal. No changes needed.' : ''"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [mat-dialog-close]="{ note }">{{ data.isResult ? 'Release' : 'Share' }}</button>
    </mat-dialog-actions>
  `,
  styles: `.sd__note { width: 100%; min-width: min(440px, 80vw); }`,
})
export class ShareDocumentDialog {
  protected readonly data = inject<ShareDocumentData>(MAT_DIALOG_DATA);
  protected note = '';
}
