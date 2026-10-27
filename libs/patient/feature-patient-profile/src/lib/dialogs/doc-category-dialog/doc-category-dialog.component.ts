import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DocumentCategory } from '@clinova/patient/domain';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'clv-doc-category-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './doc-category-dialog.component.html',
  styleUrl: './doc-category-dialog.component.scss',
})
export class DocCategoryDialog {
  protected readonly data = inject<{ fileName: string }>(MAT_DIALOG_DATA);
  protected readonly selected = signal<DocumentCategory>(DocumentCategory.Other);
  protected readonly categories = [
    { value: DocumentCategory.ConsentForm,  label: 'Consent Form',  icon: 'gavel' },
    { value: DocumentCategory.LabReport,    label: 'Lab Report',    icon: 'biotech' },
    { value: DocumentCategory.Referral,     label: 'Referral',      icon: 'outgoing_mail' },
    { value: DocumentCategory.Imaging,      label: 'Imaging',       icon: 'radiology' },
    { value: DocumentCategory.PriorRecord,  label: 'Prior Record',  icon: 'history_edu' },
    { value: DocumentCategory.Insurance,    label: 'Insurance',     icon: 'health_and_safety' },
    { value: DocumentCategory.Other,        label: 'Other',         icon: 'attach_file' },
  ];
}
