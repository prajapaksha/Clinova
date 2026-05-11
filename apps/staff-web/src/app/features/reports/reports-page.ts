import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-reports-page',
  standalone: true,
  imports: [MatCardModule],
  template: `<mat-card><mat-card-header><mat-card-title>Reports</mat-card-title></mat-card-header><mat-card-content><p>Phase implementation coming soon.</p></mat-card-content></mat-card>`,
})
export class ReportsPage {}
