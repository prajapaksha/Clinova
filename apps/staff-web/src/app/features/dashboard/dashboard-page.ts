import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'clv-dashboard-page',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  template: `
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Welcome to Clinova Health Platform</p>
    </div>

    <div class="dashboard-grid">
      <mat-card class="kpi-card">
        <mat-card-content>
          <div class="kpi-card__icon"><mat-icon>calendar_today</mat-icon></div>
          <div class="kpi-card__value">—</div>
          <div class="kpi-card__label">Today's Appointments</div>
        </mat-card-content>
      </mat-card>
      <mat-card class="kpi-card">
        <mat-card-content>
          <div class="kpi-card__icon"><mat-icon>people</mat-icon></div>
          <div class="kpi-card__value">—</div>
          <div class="kpi-card__label">Patients Checked In</div>
        </mat-card-content>
      </mat-card>
      <mat-card class="kpi-card">
        <mat-card-content>
          <div class="kpi-card__icon"><mat-icon>clinical_notes</mat-icon></div>
          <div class="kpi-card__value">—</div>
          <div class="kpi-card__label">Unsigned Notes</div>
        </mat-card-content>
      </mat-card>
      <mat-card class="kpi-card">
        <mat-card-content>
          <div class="kpi-card__icon"><mat-icon>receipt_long</mat-icon></div>
          <div class="kpi-card__value">—</div>
          <div class="kpi-card__label">Outstanding Invoices</div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-title  { margin: 0; font-size: 24px; font-weight: 600; color: var(--clv-gray-900); }
    .page-subtitle { margin: 4px 0 0; color: var(--clv-gray-600); font-size: 14px; }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }

    .kpi-card mat-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
      gap: 8px;
    }

    .kpi-card__icon mat-icon {
      font-size: 32px; width: 32px; height: 32px;
      color: var(--clv-primary-700);
    }
    .kpi-card__value { font-size: 28px; font-weight: 700; color: var(--clv-gray-900); }
    .kpi-card__label { font-size: 13px; color: var(--clv-gray-600); text-align: center; }
  `],
})
export class DashboardPage {}
