import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-billing-page',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './billing-page.component.html',
  styleUrl: './billing-page.component.scss',
})
export class BillingPage {}
