import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-messages-page',
  standalone: true,
  imports: [MatCardModule],
  template: `<mat-card><mat-card-header><mat-card-title>Messages</mat-card-title></mat-card-header><mat-card-content><p>Phase implementation coming soon.</p></mat-card-content></mat-card>`,
})
export class MessagesPage {}
