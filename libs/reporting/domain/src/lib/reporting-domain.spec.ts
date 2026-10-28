import { formatHourLabel, peakWindow, sortAlerts, trendPercent } from './reporting-domain';

describe('reporting domain — dashboard helpers', () => {
  describe('trendPercent', () => {
    it('computes rounded percentage change', () => {
      expect(trendPercent(42, 37)).toBe(14);
      expect(trendPercent(30, 40)).toBe(-25);
    });

    it('returns null without a baseline', () => {
      expect(trendPercent(5, 0)).toBeNull();
    });
  });

  describe('peakWindow', () => {
    it('finds the busiest two-hour window', () => {
      expect(peakWindow([9, 10, 10, 11, 14, 10, 11])).toEqual({ start: 10, end: 12 });
    });

    it('prefers the earliest window on ties', () => {
      expect(peakWindow([9, 15])).toEqual({ start: 8, end: 10 });
    });

    it('returns null with no data', () => {
      expect(peakWindow([])).toBeNull();
    });
  });

  it('sortAlerts orders critical, warning, info', () => {
    const sorted = sortAlerts([{ severity: 'INFO' }, { severity: 'CRITICAL' }, { severity: 'WARNING' }] as const);
    expect(sorted.map(a => a.severity)).toEqual(['CRITICAL', 'WARNING', 'INFO']);
  });

  it('formatHourLabel uses 12-hour labels', () => {
    expect([0, 9, 12, 14].map(formatHourLabel)).toEqual(['12AM', '9AM', '12PM', '2PM']);
  });
});
