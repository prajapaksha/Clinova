import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'clv-messages-page',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './messages-page.component.html',
  styleUrl: './messages-page.component.scss',
})
export class MessagesPage {}
