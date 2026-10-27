import { checkAllergies, checkInteractions, findDrug, runSafetyChecks } from './medication-safety';

const allergy = (allergen: string, type = 'DRUG') => ({ allergen, type, severity: 'HIGH', reaction: 'Hives' });

describe('medication safety', () => {
  describe('findDrug', () => {
    it('matches catalog names case-insensitively', () => {
      expect(findDrug('amoxicillin')?.name).toBe('Amoxicillin');
    });

    it('matches free-text medication lines and prefers the longest name', () => {
      expect(findDrug('Lisinopril 10mg daily')?.name).toBe('Lisinopril');
      expect(findDrug('Amoxicillin-Clavulanate 875/125 mg BID')?.name).toBe('Amoxicillin-Clavulanate');
    });

    it('returns undefined for unknown drugs', () => {
      expect(findDrug('Unobtainium 5 mg')).toBeUndefined();
    });
  });

  describe('checkAllergies', () => {
    it('flags a direct name match', () => {
      const alerts = checkAllergies('Amoxicillin', [allergy('Amoxicillin')]);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].reason).toContain('allergic to Amoxicillin');
    });

    it('flags class cross-sensitivity (penicillin allergy vs amoxicillin)', () => {
      const alerts = checkAllergies('Amoxicillin-Clavulanate', [allergy('Penicillin')]);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].reason).toContain('penicillin class');
    });

    it('maps common wording such as "Sulfa drugs"', () => {
      expect(checkAllergies('Sulfamethoxazole-Trimethoprim', [allergy('Sulfa drugs')])).toHaveLength(1);
    });

    it('does not flag unrelated allergies', () => {
      expect(checkAllergies('Lisinopril', [allergy('Penicillin'), allergy('Peanuts', 'FOOD')])).toEqual([]);
    });
  });

  describe('checkInteractions', () => {
    it('flags warfarin + NSAID as a major interaction', () => {
      const alerts = checkInteractions('Ibuprofen', ['Warfarin 5 mg daily']);
      expect(alerts).toEqual([
        expect.objectContaining({ withMedication: 'Warfarin', severity: 'MAJOR' }),
      ]);
    });

    it('checks interactions in both directions', () => {
      expect(checkInteractions('Spironolactone', ['Lisinopril 10mg'])).toHaveLength(1);
      expect(checkInteractions('Lisinopril', ['Spironolactone 25 mg'])).toHaveLength(1);
    });

    it('flags duplicate therapy when the drug is already on the medication list', () => {
      expect(checkInteractions('Furosemide', ['Furosemide 40mg QD'])).toEqual([
        expect.objectContaining({ severity: 'MODERATE', message: expect.stringContaining('Duplicate therapy') }),
      ]);
    });

    it('returns no alerts for safe combinations', () => {
      expect(checkInteractions('Acetaminophen', ['Lisinopril 10mg', 'Metformin 500mg'])).toEqual([]);
    });
  });

  it('runSafetyChecks combines both checks', () => {
    const result = runSafetyChecks('Naproxen', [allergy('NSAIDs')], ['Warfarin 2 mg']);
    expect(result.allergyAlerts).toHaveLength(1);
    expect(result.interactionAlerts).toHaveLength(1);
  });
});
