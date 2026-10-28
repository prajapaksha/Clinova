import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Formats integer cents as USD, e.g. `12345 | cents` → "$123.45"; `| cents:'compact'` → "$1.2K" / "$620". */
@Pipe({ name: 'cents', standalone: true })
export class CentsPipe implements PipeTransform {
  transform(value: number | null | undefined, style: 'full' | 'compact' = 'full'): string {
    if (value === null || value === undefined) return '—';
    if (style === 'compact') return (Math.abs(value) < 100_000 ? wholeDollars : compact).format(value / 100);
    return formatter.format(value / 100);
  }
}
