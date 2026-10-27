import {
  computeBmi,
  emptySoapNote,
  EncounterStatus,
  formatBloodPressure,
  isEncounterEditable,
  recordToVitals,
  signingBlockers,
  VitalType,
  vitalsToRecord,
} from './clinical-domain';

describe('clinical domain', () => {
  describe('isEncounterEditable', () => {
    it('allows edits only before signing', () => {
      expect(isEncounterEditable(EncounterStatus.Draft)).toBe(true);
      expect(isEncounterEditable(EncounterStatus.InProgress)).toBe(true);
      expect(isEncounterEditable(EncounterStatus.Signed)).toBe(false);
      expect(isEncounterEditable(EncounterStatus.Amended)).toBe(false);
    });
  });

  describe('signingBlockers', () => {
    it('requires a chief complaint and a diagnosis', () => {
      expect(signingBlockers(emptySoapNote())).toEqual([
        'Chief complaint is required.',
        'At least one diagnosis is required.',
      ]);
    });

    it('treats whitespace-only chief complaints as missing', () => {
      const note = emptySoapNote();
      const ready = {
        ...note,
        subjective: { ...note.subjective, chiefComplaint: '   ' },
        assessment: { ...note.assessment, diagnoses: [{ code: { code: 'I10', description: 'HTN' }, isPrimary: true, notes: null }] },
      };
      expect(signingBlockers(ready)).toEqual(['Chief complaint is required.']);
    });
  });

  describe('computeBmi', () => {
    it('computes BMI to one decimal place', () => {
      expect(computeBmi(70, 175)).toBe(22.9);
    });

    it('returns null for missing or invalid values', () => {
      expect(computeBmi(null, 175)).toBeNull();
      expect(computeBmi(70, 0)).toBeNull();
    });
  });

  describe('vitals mapping', () => {
    it('drops empty values, adds units, and derives BMI', () => {
      const vitals = recordToVitals({
        [VitalType.HeartRate]: 72,
        [VitalType.WeightKg]: 70,
        [VitalType.HeightCm]: 175,
        [VitalType.Temperature]: undefined,
      });

      expect(vitals).toEqual([
        { type: VitalType.HeartRate, value: 72, unit: 'bpm' },
        { type: VitalType.WeightKg, value: 70, unit: 'kg' },
        { type: VitalType.HeightCm, value: 175, unit: 'cm' },
        { type: VitalType.BMI, value: 22.9, unit: 'kg/m²' },
      ]);
    });

    it('round-trips measurements to a record', () => {
      const record = vitalsToRecord([
        { type: VitalType.BloodPressureSystolic, value: 132 },
        { type: VitalType.BloodPressureDiastolic, value: 88 },
      ]);
      expect(formatBloodPressure(record)).toBe('132/88');
    });

    it('formats blood pressure only when both values are present', () => {
      expect(formatBloodPressure({ [VitalType.BloodPressureSystolic]: 120 })).toBeNull();
    });
  });
});
