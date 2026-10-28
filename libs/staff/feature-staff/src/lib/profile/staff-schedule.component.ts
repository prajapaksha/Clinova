import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { StaffApiService } from '@clinova/staff/data-access';
import type { DaySchedule, StaffProfile } from '@clinova/staff/domain';
import { scheduleErrors } from '@clinova/staff/domain';
import { DAY_NAMES, errorMessage } from '../shared/staff-shared';

const dayGroup = (d: DaySchedule) => new FormGroup({
  dayOfWeek: new FormControl(d.dayOfWeek, { nonNullable: true }),
  isWorking: new FormControl(d.isWorking, { nonNullable: true }),
  start: new FormControl(d.hours?.start ?? '09:00', { nonNullable: true }),
  end: new FormControl(d.hours?.end ?? '17:00', { nonNullable: true }),
  lunch: new FormControl(!!d.lunchBreak, { nonNullable: true }),
  lunchStart: new FormControl(d.lunchBreak?.start ?? '12:00', { nonNullable: true }),
  lunchEnd: new FormControl(d.lunchBreak?.end ?? '13:00', { nonNullable: true }),
});
type DayGroup = ReturnType<typeof dayGroup>;

/** Weekly working hours with lunch breaks (PRD §4.3 schedule management). */
@Component({
  selector: 'clv-staff-schedule',
  imports: [ReactiveFormsModule, MatButtonModule, MatIconModule, MatSlideToggleModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()">
      <table class="sc__table">
        <thead><tr><th>Day</th><th>Working</th><th>Hours</th><th>Lunch break</th></tr></thead>
        <tbody formArrayName="days">
          @for (g of days.controls; track g.controls.dayOfWeek.value; let i = $index) {
            <tr [formGroupName]="i" [class.sc__off]="!g.controls.isWorking.value">
              <th scope="row">{{ dayName(g) }}</th>
              <td><mat-slide-toggle formControlName="isWorking" [attr.aria-label]="dayName(g) + ' working'" /></td>
              <td>
                @if (g.controls.isWorking.value) {
                  <input type="time" formControlName="start" [attr.aria-label]="dayName(g) + ' start'" /> –
                  <input type="time" formControlName="end" [attr.aria-label]="dayName(g) + ' end'" />
                } @else { <span class="sc__muted">Off</span> }
              </td>
              <td>
                @if (g.controls.isWorking.value) {
                  <label class="sc__lunch"><input type="checkbox" formControlName="lunch" /> Lunch</label>
                  @if (g.controls.lunch.value) {
                    <input type="time" formControlName="lunchStart" [attr.aria-label]="dayName(g) + ' lunch start'" /> –
                    <input type="time" formControlName="lunchEnd" [attr.aria-label]="dayName(g) + ' lunch end'" />
                  }
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (canEdit()) {
        <div class="sc__actions">
          @if (error()) { <span class="sc__error" role="alert">{{ error() }}</span> }
          @if (saved()) { <span class="sc__saved" role="status"><mat-icon>check</mat-icon> Saved</span> }
          <button mat-flat-button color="primary" type="submit" [disabled]="busy() || form.pristine">Save schedule</button>
        </div>
      }
    </form>
  `,
  styles: `
    .sc__table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .sc__table th, .sc__table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--clv-gray-100); }
    .sc__table thead th { font-size: 0.72rem; text-transform: uppercase; color: var(--clv-gray-600); border-bottom-color: var(--clv-gray-200); }
    .sc__table input[type='time'] { padding: 4px 6px; border: 1px solid var(--clv-gray-300); border-radius: 6px; font: inherit; }
    .sc__table input:disabled { border-color: transparent; background: transparent; color: inherit; }
    .sc__off th { color: var(--clv-gray-500); }
    .sc__muted { color: var(--clv-gray-500); }
    .sc__lunch { margin-right: 8px; }
    .sc__actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 12px; }
    .sc__error { color: var(--clv-danger-text); margin-right: auto; }
    .sc__saved { display: inline-flex; align-items: center; gap: 4px; color: var(--clv-success-text); }
  `,
})
export class StaffScheduleComponent {
  private readonly api = inject(StaffApiService);

  readonly profile = input.required<StaffProfile>();
  readonly canEdit = input(false);
  readonly changed = output<StaffProfile>();

  protected readonly days = new FormArray<DayGroup>([]);
  protected readonly form = new FormGroup({ days: this.days });
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const schedule = this.profile().schedule;
      this.days.clear({ emitEvent: false });
      for (const d of [...schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek)) this.days.push(dayGroup(d), { emitEvent: false });
      if (this.canEdit()) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
      this.form.markAsPristine();
    });
    this.form.valueChanges.subscribe(() => this.saved.set(false));
  }

  protected dayName(g: DayGroup): string {
    return DAY_NAMES[g.controls.dayOfWeek.value];
  }

  protected save(): void {
    const schedule: DaySchedule[] = this.days.getRawValue().map(d => ({
      dayOfWeek: d.dayOfWeek,
      isWorking: d.isWorking,
      hours: d.isWorking ? { start: d.start, end: d.end } : null,
      lunchBreak: d.isWorking && d.lunch ? { start: d.lunchStart, end: d.lunchEnd } : null,
    }));
    const problems = scheduleErrors(schedule);
    if (problems.length) {
      this.error.set(problems.join(' '));
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.updateSchedule(this.profile().id, schedule).subscribe({
      next: profile => {
        this.busy.set(false);
        this.saved.set(true);
        this.changed.emit(profile);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
