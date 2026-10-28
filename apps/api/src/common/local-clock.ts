/** Converts between UTC instants and a client's local wall clock using a fixed UTC offset. */
export class LocalClock {
  /** @param offsetMinutes minutes behind UTC, as returned by `Date.prototype.getTimezoneOffset()`. */
  constructor(private readonly offsetMinutes: number) {}

  /** UTC instant of local midnight for a YYYY-MM-DD date. */
  midnight(date: string): Date {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d) + this.offsetMinutes * 60_000);
  }

  private shifted(instant: Date): Date {
    return new Date(instant.getTime() - this.offsetMinutes * 60_000);
  }

  /** Local YYYY-MM-DD. */
  dateKey(instant: Date): string {
    return this.shifted(instant).toISOString().slice(0, 10);
  }

  /** Local YYYY-MM. */
  monthKey(instant: Date): string {
    return this.dateKey(instant).slice(0, 7);
  }

  hour(instant: Date): number {
    return this.shifted(instant).getUTCHours();
  }

  time(instant: Date): string {
    const local = this.shifted(instant);
    const h = local.getUTCHours();
    const m = String(local.getUTCMinutes()).padStart(2, '0');
    return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  }
}