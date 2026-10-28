import { Injectable } from '@nestjs/common';

/** Practice details used in patient messages (env-configurable until a Settings screen owns them). */
@Injectable()
export class PracticeSettings {
  readonly name = process.env['PRACTICE_NAME'] ?? 'Clinova Health';
  readonly phone = process.env['PRACTICE_PHONE'] ?? '(555) 010-0100';
  readonly portalUrl = process.env['PORTAL_URL'] ?? 'http://localhost:4300';
  /** IANA time zone for dates/times in messages and SMS quiet hours. */
  readonly timeZone = process.env['PRACTICE_TIMEZONE'] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  date(d: Date): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: this.timeZone, weekday: 'long', month: 'long', day: 'numeric' }).format(d);
  }

  shortDate(d: Date): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: this.timeZone, month: 'long', day: 'numeric', year: 'numeric' }).format(d);
  }

  time(d: Date): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: this.timeZone, hour: 'numeric', minute: '2-digit' }).format(d);
  }

  /** Local hour (0-23) in the practice time zone. */
  hour(d: Date): number {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: this.timeZone, hour: 'numeric', hourCycle: 'h23' }).format(d));
  }

  money(cents: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }
}