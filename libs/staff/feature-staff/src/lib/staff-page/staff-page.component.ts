import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-staff-page',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './staff-page.component.html',
  styleUrl: './staff-page.component.scss',
})
export class StaffPage {}
