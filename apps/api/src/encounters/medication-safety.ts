import {
  ALLERGEN_CLASS_ALIASES,
  DRUG_CATALOG,
  DrugEntry,
  INTERACTION_RULES,
  InteractionSeverity,
} from './reference/drugs.data';

export interface PatientAllergyInput {
  allergen: string;
  type: string;
  severity: string;
  reaction: string;
}

export interface AllergyAlert {
  allergen: string;
  severity: string;
  reaction: string;
  reason: string;
}

export interface InteractionAlert {
  withMedication: string;
  severity: InteractionSeverity;
  message: string;
}

export interface SafetyCheckResult {
  allergyAlerts: AllergyAlert[];
  interactionAlerts: InteractionAlert[];
}

const normalize = (s: string) => s.trim().toLowerCase();

/** Finds the catalog drug referenced by a name or a free-text medication line ("Lisinopril 10mg daily"). */
export function findDrug(text: string): DrugEntry | undefined {
  const t = normalize(text);
  if (!t) return undefined;
  const exact = DRUG_CATALOG.find(d => normalize(d.name) === t);
  if (exact) return exact;
  // Prefer the longest matching name so "Amoxicillin-Clavulanate" wins over "Amoxicillin".
  return [...DRUG_CATALOG]
    .sort((a, b) => b.name.length - a.name.length)
    .find(d => t.includes(normalize(d.name)) || t.startsWith(normalize(d.name).split(/[\s-]/)[0]));
}

function tokensFor(name: string): Set<string> {
  const drug = findDrug(name);
  const base = normalize(drug?.name ?? name);
  const tokens = new Set<string>([base, base.split(/[\s-]/)[0]]);
  drug?.classes.forEach(c => tokens.add(c));
  return tokens;
}

export function checkAllergies(medicationName: string, allergies: ReadonlyArray<PatientAllergyInput>): AllergyAlert[] {
  const drug = findDrug(medicationName);
  const drugName = normalize(drug?.name ?? medicationName);
  const nameParts = drugName.split(/[\s-]/);
  const classes = new Set(drug?.classes ?? []);

  return allergies.flatMap(allergy => {
    const allergen = normalize(allergy.allergen);
    if (!allergen) return [];

    const aliasClasses = ALLERGEN_CLASS_ALIASES[allergen] ?? [];
    const classHit = aliasClasses.find(c => classes.has(c)) ?? (classes.has(allergen) ? allergen : undefined);
    const nameHit = nameParts.includes(allergen) || drugName === allergen || allergen.includes(drugName);

    if (!classHit && !nameHit) return [];
    return [{
      allergen: allergy.allergen,
      severity: allergy.severity,
      reaction: allergy.reaction,
      reason: nameHit
        ? `Patient is allergic to ${allergy.allergen}.`
        : `${drug?.name ?? medicationName} is in the ${classHit} class; patient is allergic to ${allergy.allergen}.`,
    }];
  });
}

export function checkInteractions(medicationName: string, otherMedications: ReadonlyArray<string>): InteractionAlert[] {
  const newTokens = tokensFor(medicationName);
  const newName = normalize(findDrug(medicationName)?.name ?? medicationName);
  const seen = new Set<string>();
  const alerts: InteractionAlert[] = [];

  for (const other of otherMedications) {
    const otherDrug = findDrug(other);
    if (normalize(otherDrug?.name ?? other) === newName) {
      const key = `${other}|duplicate`;
      if (!seen.has(key)) {
        seen.add(key);
        alerts.push({
          withMedication: other,
          severity: 'MODERATE',
          message: `Duplicate therapy: patient is already taking ${otherDrug?.name ?? other}.`,
        });
      }
      continue;
    }
    const otherTokens = tokensFor(other);

    for (const rule of INTERACTION_RULES) {
      const hit = (newTokens.has(rule.a) && otherTokens.has(rule.b)) || (newTokens.has(rule.b) && otherTokens.has(rule.a));
      const key = `${other}|${rule.message}`;
      if (hit && !seen.has(key)) {
        seen.add(key);
        alerts.push({ withMedication: otherDrug?.name ?? other, severity: rule.severity, message: rule.message });
      }
    }
  }
  return alerts;
}

export function runSafetyChecks(
  medicationName: string,
  allergies: ReadonlyArray<PatientAllergyInput>,
  otherMedications: ReadonlyArray<string>,
): SafetyCheckResult {
  return {
    allergyAlerts: checkAllergies(medicationName, allergies),
    interactionAlerts: checkInteractions(medicationName, otherMedications),
  };
}
