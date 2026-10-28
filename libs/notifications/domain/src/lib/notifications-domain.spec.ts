import {
  DEFAULT_TEMPLATES,
  MERGE_FIELDS,
  NOTIFICATION_TYPES,
  NotificationType,
  renderTemplate,
  reminderSchedule,
  retryDelayMs,
  sampleValues,
  smsSegments,
  templateErrors,
} from './notifications-domain';

describe('renderTemplate', () => {
  it('fills merge fields and tidies blanks', () => {
    expect(renderTemplate('Hi {{patient_first_name}},  see {{ provider_name }} {{location}}\n', { patient_first_name: 'Ada', provider_name: 'Dr. Chen' }))
      .toBe('Hi Ada, see Dr. Chen');
  });
});

describe('templateErrors', () => {
  it('flags unknown merge fields and stray braces', () => {
    const allowed = NOTIFICATION_TYPES[NotificationType.PaymentReceipt].mergeFields;
    expect(templateErrors('Paid {{payment_amount}}', allowed)).toEqual([]);
    expect(templateErrors('Visit {{appointment_date}} {{bogus}}', allowed)[0]).toContain('{{appointment_date}}, {{bogus}}');
    expect(templateErrors('Hi {{patient_first_name}', allowed)).toHaveLength(1);
  });

  it('accepts every built-in template', () => {
    for (const [type, channels] of Object.entries(DEFAULT_TEMPLATES)) {
      const allowed = NOTIFICATION_TYPES[type as NotificationType].mergeFields;
      for (const [channel, t] of Object.entries(channels)) {
        expect([type, channel, templateErrors(`${t?.subject ?? ''} ${t?.body}`, allowed)]).toEqual([type, channel, []]);
        expect(NOTIFICATION_TYPES[type as NotificationType].channels).toContain(channel);
      }
    }
  });

  it('defines an example for every merge field', () => {
    for (const f of Object.values(MERGE_FIELDS)) expect(f.example).toBeTruthy();
  });
});

describe('reminderSchedule', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  it('schedules 48h and 2h reminders that are still in the future', () => {
    expect(reminderSchedule(new Date('2026-11-05T15:00:00Z'), now).map(r => [r.type, r.sendAt.toISOString()])).toEqual([
      [NotificationType.AppointmentReminder48h, '2026-11-03T15:00:00.000Z'],
      [NotificationType.AppointmentReminder2h, '2026-11-05T13:00:00.000Z'],
    ]);
    expect(reminderSchedule(new Date('2026-11-02T10:00:00Z'), now).map(r => r.type)).toEqual([NotificationType.AppointmentReminder2h]);
    expect(reminderSchedule(new Date('2026-11-01T13:00:00Z'), now)).toEqual([]);
  });
});

describe('delivery rules', () => {
  it('backs off exponentially up to an hour', () => {
    expect([1, 2, 3, 4, 8].map(retryDelayMs).map(ms => ms / 60_000)).toEqual([1, 2, 4, 8, 60]);
  });

  it('counts SMS segments', () => {
    expect(smsSegments('x'.repeat(160))).toBe(1);
    expect(smsSegments('x'.repeat(161))).toBe(2);
  });

  it('keeps SMS templates to a single segment', () => {
    for (const channels of Object.values(DEFAULT_TEMPLATES)) {
      if (channels.SMS) expect(smsSegments(renderTemplate(channels.SMS.body, sampleValues()))).toBe(1);
    }
  });
});