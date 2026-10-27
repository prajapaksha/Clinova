import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'clv-root',
  template: '<router-outlet />',
})
export class App {}
