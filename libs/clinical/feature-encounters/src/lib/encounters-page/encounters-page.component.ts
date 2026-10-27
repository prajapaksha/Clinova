import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-encounters-page',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './encounters-page.component.html',
  styleUrl: './encounters-page.component.scss',
})
export class EncountersPage {}
