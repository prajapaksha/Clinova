import { Component, computed, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import type { DailyVolume } from '@clinova/reporting/domain';
import { formatHourLabel } from '@clinova/reporting/domain';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

@Component({
  selector: 'clv-weekly-volume',
  standalone: true,
  imports: [RouterModule, MatButtonModule],
  template: `
    <section class="panel" aria-labelledby="volume-title">
      <header class="panel__header">
        <h2 id="volume-title" class="panel__title">Weekly volume</h2>
        <span class="panel__chip">7 days</span>
      </header>
      <div class="chart" role="img" [attr.aria-label]="summary()">
        @for (b of bars(); track b.date) {
          <div class="chart__col" [class.chart__col--today]="b.date === today()">
            <span class="chart__value">{{ b.count }}</span>
            <div class="chart__bar" [style.height.%]="b.height"></div>
            <span class="chart__label">{{ b.label }}</span>
          </div>
        }
      </div>
      <footer class="panel__footer">
        <span class="panel__peak">{{ peakLabel() }}</span>
        <a mat-button routerLink="/calendar">Detail view</a>
      </footer>
    </section>
  `,
  styles: `
    :host { display: block; }
    .panel { background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; overflow: hidden; }
    .panel__header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; }
    .panel__title { margin: 0; font-size: 1rem; font-weight: 600; }
    .panel__chip { padding: 2px 8px; border-radius: 999px; background: var(--clv-gray-100); font-size: 0.72rem; color: var(--clv-gray-700); }
    .chart { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; height: 160px; padding: 0 20px; align-items: end; }
    .chart__col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; }
    .chart__bar { width: 100%; max-width: 28px; min-height: 4px; border-radius: 6px 6px 0 0; background: var(--clv-primary-200); }
    .chart__col--today .chart__bar { background: var(--clv-primary-700); }
    .chart__value { font-size: 0.72rem; color: var(--clv-gray-600); }
    .chart__label { font-size: 0.68rem; font-weight: 600; color: var(--clv-gray-600); letter-spacing: 0.04em; }
    .chart__col--today .chart__label { color: var(--clv-primary-700); }
    .panel__footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 12px 20px; margin-top: 8px; border-top: 1px solid var(--clv-gray-100); }
    .panel__peak { font-size: 0.8rem; color: var(--clv-gray-700); }
    @media print { .panel__footer a { display: none; } }
  `,
})
export class WeeklyVolumeComponent {
  readonly days = input.required<ReadonlyArray<DailyVolume>>();
  readonly peakHours = input<{ start: number; end: number } | null>(null);
  /** Local YYYY-MM-DD of the dashboard day, highlighted in the chart. */
  readonly today = input<string>('');

  protected readonly bars = computed(() => {
    const max = Math.max(1, ...this.days().map(d => d.count));
    return this.days().map(d => ({
      date: d.date,
      count: d.count,
      height: (d.count / max) * 100,
      // Parse as a local date; `new Date('YYYY-MM-DD')` would be UTC midnight.
      label: WEEKDAYS[new Date(`${d.date}T12:00:00`).getDay()],
    }));
  });

  protected readonly peakLabel = computed(() => {
    const p = this.peakHours();
    return p ? `Peak hours: ${formatHourLabel(p.start)}–${formatHourLabel(p.end)}` : 'No visits in the last 7 days';
  });

  protected readonly summary = computed(() =>
    'Appointments per day: ' + this.bars().map(b => `${b.label} ${b.count}`).join(', '));
}
