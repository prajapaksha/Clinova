import {
  availableSlots,
  canChangeOnline,
  cardBrand,
  diffProfile,
  formatInviteCode,
  isCardExpired,
  isValidCardNumber,
  normalizeInviteCode,
  normalizePreferences,
  workingWindows,
} from './portal-domain';

const midnight = new Date('2026-11-02T05:00:00Z'); // local midnight at UTC-5
const day = { dayOfWeek: 1, isWorking: true, hours: { start: '09:00', end: '12:00' }, lunchBreak: { start: '10:00', end: '10:30' } };

describe('workingWindows', () => {
  it('splits the day around lunch', () => {
    const w = workingWindows(day, midnight);
    expect(w.map(x => [x.start.toISOString(), x.end.toISOString()])).toEqual([
      ['2026-11-02T14:00:00.000Z', '2026-11-02T15:00:00.000Z'],
      ['2026-11-02T15:30:00.000Z', '2026-11-02T17:00:00.000Z'],
    ]);
  });

  it('returns nothing on days off', () => {
    expect(workingWindows({ ...day, isWorking: false }, midnight)).toEqual([]);
    expect(workingWindows(undefined, midnight)).toEqual([]);
  });
});

describe('availableSlots', () => {
  const windows = workingWindows(day, midnight);
  const now = new Date('2026-11-01T12:00:00Z');

  it('steps through windows avoiding busy time and buffers', () => {
    const slots = availableSlots({
      windows,
      busy: [{ start: new Date('2026-11-02T15:30:00Z'), end: new Date('2026-11-02T16:00:00Z') }],
      durationMinutes: 30,
      bufferMinutes: 15,
      now,
    });
    expect(slots.map(s => s.start.toISOString().slice(11, 16))).toEqual(['14:00', '14:30', '16:30']);
  });

  it('respects the minimum lead time', () => {
    const slots = availableSlots({ windows, busy: [], durationMinutes: 30, now: new Date('2026-11-02T13:30:00Z') });
    expect(slots[0].start.toISOString().slice(11, 16)).toBe('15:30');
  });

  it('only offers slots that fit the full duration', () => {
    const slots = availableSlots({ windows, busy: [], durationMinutes: 60, now });
    expect(slots.map(s => s.start.toISOString().slice(11, 16))).toEqual(['14:00', '15:30', '16:00']);
  });
});

describe('canChangeOnline', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  it('enforces the 24-hour cutoff', () => {
    expect(canChangeOnline('2026-11-02T12:00:00Z', now)).toBe(true);
    expect(canChangeOnline('2026-11-02T11:59:00Z', now)).toBe(false);
  });
});

describe('cards', () => {
  it('validates numbers and detects brands', () => {
    expect(isValidCardNumber('4242 4242 4242 4242')).toBe(true);
    expect(isValidCardNumber('4242 4242 4242 4241')).toBe(false);
    expect(cardBrand('5555555555554444')).toBe('Mastercard');
    expect(cardBrand('378282246310005')).toBe('American Express');
  });

  it('treats a card as valid through its expiry month', () => {
    const now = new Date(2026, 9, 28);
    expect(isCardExpired(10, 2026, now)).toBe(false);
    expect(isCardExpired(9, 2026, now)).toBe(true);
    expect(isCardExpired(1, 27, now)).toBe(false);
  });
});

describe('profile changes', () => {
  it('keeps only fields that differ', () => {
    const changes = diffProfile(
      { preferredName: 'Ruth', pronouns: null, contact: { primaryPhone: '1' } },
      { preferredName: 'Ruthie', pronouns: null, contact: { primaryPhone: '1' }, bloodType: 'O_POS' },
    );
    expect(changes).toEqual({ preferredName: { old: 'Ruth', new: 'Ruthie' } });
  });
});

describe('invite codes & preferences', () => {
  it('normalizes codes typed by patients', () => {
    expect(normalizeInviteCode(' k7qm-3xpa ')).toBe('K7QM3XPA');
    expect(formatInviteCode('k7qm3xpa')).toBe('K7QM-3XPA');
  });

  it('fills missing preferences from defaults', () => {
    const prefs = normalizePreferences({ billing: { email: false } });
    expect(prefs.billing).toEqual({ email: false, sms: false });
    expect(prefs.appointmentReminders.sms).toBe(true);
  });
});
