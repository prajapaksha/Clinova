export interface DrugEntry {
  name: string;
  form: string;
  strengths: string[];
  route: string;
  /** Lower-case classes used for allergy cross-matching and interaction checks. */
  classes: string[];
}

export const DRUG_CATALOG: ReadonlyArray<DrugEntry> = [
  { name: 'Amoxicillin', form: 'Capsule', strengths: ['250 mg', '500 mg'], route: 'Oral', classes: ['penicillin', 'antibiotic'] },
  { name: 'Amoxicillin-Clavulanate', form: 'Tablet', strengths: ['500/125 mg', '875/125 mg'], route: 'Oral', classes: ['penicillin', 'antibiotic'] },
  { name: 'Penicillin V Potassium', form: 'Tablet', strengths: ['250 mg', '500 mg'], route: 'Oral', classes: ['penicillin', 'antibiotic'] },
  { name: 'Cephalexin', form: 'Capsule', strengths: ['250 mg', '500 mg'], route: 'Oral', classes: ['cephalosporin', 'antibiotic'] },
  { name: 'Azithromycin', form: 'Tablet', strengths: ['250 mg', '500 mg'], route: 'Oral', classes: ['macrolide', 'antibiotic'] },
  { name: 'Clarithromycin', form: 'Tablet', strengths: ['250 mg', '500 mg'], route: 'Oral', classes: ['macrolide', 'antibiotic', 'cyp3a4-inhibitor'] },
  { name: 'Doxycycline Hyclate', form: 'Capsule', strengths: ['100 mg'], route: 'Oral', classes: ['tetracycline', 'antibiotic'] },
  { name: 'Ciprofloxacin', form: 'Tablet', strengths: ['250 mg', '500 mg'], route: 'Oral', classes: ['fluoroquinolone', 'antibiotic'] },
  { name: 'Levofloxacin', form: 'Tablet', strengths: ['500 mg', '750 mg'], route: 'Oral', classes: ['fluoroquinolone', 'antibiotic'] },
  { name: 'Sulfamethoxazole-Trimethoprim', form: 'Tablet', strengths: ['800/160 mg'], route: 'Oral', classes: ['sulfonamide', 'antibiotic'] },
  { name: 'Nitrofurantoin', form: 'Capsule', strengths: ['100 mg'], route: 'Oral', classes: ['antibiotic'] },
  { name: 'Ibuprofen', form: 'Tablet', strengths: ['400 mg', '600 mg', '800 mg'], route: 'Oral', classes: ['nsaid'] },
  { name: 'Naproxen', form: 'Tablet', strengths: ['250 mg', '500 mg'], route: 'Oral', classes: ['nsaid'] },
  { name: 'Meloxicam', form: 'Tablet', strengths: ['7.5 mg', '15 mg'], route: 'Oral', classes: ['nsaid'] },
  { name: 'Aspirin', form: 'Tablet', strengths: ['81 mg', '325 mg'], route: 'Oral', classes: ['nsaid', 'salicylate', 'antiplatelet'] },
  { name: 'Acetaminophen', form: 'Tablet', strengths: ['325 mg', '500 mg'], route: 'Oral', classes: ['analgesic'] },
  { name: 'Tramadol', form: 'Tablet', strengths: ['50 mg'], route: 'Oral', classes: ['opioid', 'serotonergic'] },
  { name: 'Hydrocodone-Acetaminophen', form: 'Tablet', strengths: ['5/325 mg', '10/325 mg'], route: 'Oral', classes: ['opioid'] },
  { name: 'Codeine-Acetaminophen', form: 'Tablet', strengths: ['30/300 mg'], route: 'Oral', classes: ['opioid'] },
  { name: 'Lisinopril', form: 'Tablet', strengths: ['5 mg', '10 mg', '20 mg', '40 mg'], route: 'Oral', classes: ['ace-inhibitor', 'antihypertensive'] },
  { name: 'Enalapril', form: 'Tablet', strengths: ['5 mg', '10 mg', '20 mg'], route: 'Oral', classes: ['ace-inhibitor', 'antihypertensive'] },
  { name: 'Losartan', form: 'Tablet', strengths: ['25 mg', '50 mg', '100 mg'], route: 'Oral', classes: ['arb', 'antihypertensive'] },
  { name: 'Amlodipine', form: 'Tablet', strengths: ['2.5 mg', '5 mg', '10 mg'], route: 'Oral', classes: ['calcium-channel-blocker', 'antihypertensive'] },
  { name: 'Hydrochlorothiazide', form: 'Tablet', strengths: ['12.5 mg', '25 mg'], route: 'Oral', classes: ['thiazide', 'sulfonamide-nonantibiotic', 'antihypertensive'] },
  { name: 'Furosemide', form: 'Tablet', strengths: ['20 mg', '40 mg'], route: 'Oral', classes: ['loop-diuretic'] },
  { name: 'Spironolactone', form: 'Tablet', strengths: ['25 mg', '50 mg'], route: 'Oral', classes: ['potassium-sparing-diuretic'] },
  { name: 'Metoprolol Succinate', form: 'Tablet ER', strengths: ['25 mg', '50 mg', '100 mg'], route: 'Oral', classes: ['beta-blocker', 'antihypertensive'] },
  { name: 'Carvedilol', form: 'Tablet', strengths: ['3.125 mg', '6.25 mg', '12.5 mg', '25 mg'], route: 'Oral', classes: ['beta-blocker', 'antihypertensive'] },
  { name: 'Atorvastatin', form: 'Tablet', strengths: ['10 mg', '20 mg', '40 mg', '80 mg'], route: 'Oral', classes: ['statin'] },
  { name: 'Simvastatin', form: 'Tablet', strengths: ['10 mg', '20 mg', '40 mg'], route: 'Oral', classes: ['statin', 'cyp3a4-substrate'] },
  { name: 'Rosuvastatin', form: 'Tablet', strengths: ['5 mg', '10 mg', '20 mg'], route: 'Oral', classes: ['statin'] },
  { name: 'Warfarin', form: 'Tablet', strengths: ['1 mg', '2 mg', '5 mg'], route: 'Oral', classes: ['anticoagulant', 'vitamin-k-antagonist'] },
  { name: 'Apixaban', form: 'Tablet', strengths: ['2.5 mg', '5 mg'], route: 'Oral', classes: ['anticoagulant'] },
  { name: 'Clopidogrel', form: 'Tablet', strengths: ['75 mg'], route: 'Oral', classes: ['antiplatelet'] },
  { name: 'Nitroglycerin', form: 'Sublingual Tablet', strengths: ['0.4 mg'], route: 'Sublingual', classes: ['nitrate'] },
  { name: 'Sildenafil', form: 'Tablet', strengths: ['25 mg', '50 mg', '100 mg'], route: 'Oral', classes: ['pde5-inhibitor'] },
  { name: 'Metformin', form: 'Tablet', strengths: ['500 mg', '850 mg', '1000 mg'], route: 'Oral', classes: ['biguanide', 'antidiabetic'] },
  { name: 'Glipizide', form: 'Tablet', strengths: ['5 mg', '10 mg'], route: 'Oral', classes: ['sulfonylurea', 'antidiabetic'] },
  { name: 'Insulin Glargine', form: 'Injection Pen', strengths: ['100 units/mL'], route: 'Subcutaneous', classes: ['insulin', 'antidiabetic'] },
  { name: 'Levothyroxine', form: 'Tablet', strengths: ['25 mcg', '50 mcg', '75 mcg', '100 mcg'], route: 'Oral', classes: ['thyroid'] },
  { name: 'Omeprazole', form: 'Capsule DR', strengths: ['20 mg', '40 mg'], route: 'Oral', classes: ['ppi'] },
  { name: 'Pantoprazole', form: 'Tablet DR', strengths: ['20 mg', '40 mg'], route: 'Oral', classes: ['ppi'] },
  { name: 'Famotidine', form: 'Tablet', strengths: ['20 mg', '40 mg'], route: 'Oral', classes: ['h2-blocker'] },
  { name: 'Ondansetron', form: 'Tablet ODT', strengths: ['4 mg', '8 mg'], route: 'Oral', classes: ['antiemetic', 'serotonergic'] },
  { name: 'Sertraline', form: 'Tablet', strengths: ['25 mg', '50 mg', '100 mg'], route: 'Oral', classes: ['ssri', 'serotonergic'] },
  { name: 'Escitalopram', form: 'Tablet', strengths: ['5 mg', '10 mg', '20 mg'], route: 'Oral', classes: ['ssri', 'serotonergic'] },
  { name: 'Fluoxetine', form: 'Capsule', strengths: ['10 mg', '20 mg', '40 mg'], route: 'Oral', classes: ['ssri', 'serotonergic'] },
  { name: 'Bupropion XL', form: 'Tablet ER', strengths: ['150 mg', '300 mg'], route: 'Oral', classes: ['antidepressant'] },
  { name: 'Trazodone', form: 'Tablet', strengths: ['50 mg', '100 mg'], route: 'Oral', classes: ['antidepressant', 'serotonergic'] },
  { name: 'Lorazepam', form: 'Tablet', strengths: ['0.5 mg', '1 mg'], route: 'Oral', classes: ['benzodiazepine'] },
  { name: 'Alprazolam', form: 'Tablet', strengths: ['0.25 mg', '0.5 mg', '1 mg'], route: 'Oral', classes: ['benzodiazepine'] },
  { name: 'Gabapentin', form: 'Capsule', strengths: ['100 mg', '300 mg', '400 mg'], route: 'Oral', classes: ['anticonvulsant'] },
  { name: 'Cyclobenzaprine', form: 'Tablet', strengths: ['5 mg', '10 mg'], route: 'Oral', classes: ['muscle-relaxant'] },
  { name: 'Prednisone', form: 'Tablet', strengths: ['5 mg', '10 mg', '20 mg'], route: 'Oral', classes: ['corticosteroid'] },
  { name: 'Albuterol HFA', form: 'Inhaler', strengths: ['90 mcg/actuation'], route: 'Inhalation', classes: ['beta-agonist', 'bronchodilator'] },
  { name: 'Fluticasone Propionate', form: 'Nasal Spray', strengths: ['50 mcg/spray'], route: 'Intranasal', classes: ['corticosteroid'] },
  { name: 'Budesonide-Formoterol', form: 'Inhaler', strengths: ['160/4.5 mcg'], route: 'Inhalation', classes: ['corticosteroid', 'bronchodilator'] },
  { name: 'Montelukast', form: 'Tablet', strengths: ['10 mg'], route: 'Oral', classes: ['leukotriene-antagonist'] },
  { name: 'Cetirizine', form: 'Tablet', strengths: ['10 mg'], route: 'Oral', classes: ['antihistamine'] },
  { name: 'Loratadine', form: 'Tablet', strengths: ['10 mg'], route: 'Oral', classes: ['antihistamine'] },
  { name: 'Allopurinol', form: 'Tablet', strengths: ['100 mg', '300 mg'], route: 'Oral', classes: ['xanthine-oxidase-inhibitor'] },
  { name: 'Colchicine', form: 'Tablet', strengths: ['0.6 mg'], route: 'Oral', classes: ['antigout'] },
  { name: 'Tamsulosin', form: 'Capsule', strengths: ['0.4 mg'], route: 'Oral', classes: ['alpha-blocker'] },
  { name: 'Potassium Chloride ER', form: 'Tablet ER', strengths: ['10 mEq', '20 mEq'], route: 'Oral', classes: ['potassium'] },
  { name: 'Calcium Carbonate', form: 'Tablet', strengths: ['500 mg', '1250 mg'], route: 'Oral', classes: ['calcium', 'antacid'] },
  { name: 'Ferrous Sulfate', form: 'Tablet', strengths: ['325 mg'], route: 'Oral', classes: ['iron'] },
  { name: 'Vitamin D3', form: 'Capsule', strengths: ['1000 IU', '2000 IU', '50000 IU'], route: 'Oral', classes: ['vitamin'] },
  { name: 'Mupirocin', form: 'Ointment', strengths: ['2%'], route: 'Topical', classes: ['antibiotic-topical'] },
  { name: 'Hydrocortisone', form: 'Cream', strengths: ['1%', '2.5%'], route: 'Topical', classes: ['corticosteroid'] },
];

/** Maps common allergy wording to drug classes. */
export const ALLERGEN_CLASS_ALIASES: Readonly<Record<string, string[]>> = {
  penicillin: ['penicillin'],
  penicillins: ['penicillin'],
  amoxicillin: ['penicillin'],
  sulfa: ['sulfonamide'],
  'sulfa drugs': ['sulfonamide'],
  sulfonamide: ['sulfonamide'],
  sulfonamides: ['sulfonamide'],
  nsaid: ['nsaid'],
  nsaids: ['nsaid'],
  aspirin: ['salicylate'],
  cephalosporin: ['cephalosporin'],
  cephalosporins: ['cephalosporin'],
  macrolide: ['macrolide'],
  macrolides: ['macrolide'],
  fluoroquinolone: ['fluoroquinolone'],
  fluoroquinolones: ['fluoroquinolone'],
  codeine: ['opioid'],
  morphine: ['opioid'],
  opioid: ['opioid'],
  opioids: ['opioid'],
  'ace inhibitor': ['ace-inhibitor'],
  'ace inhibitors': ['ace-inhibitor'],
  statin: ['statin'],
  statins: ['statin'],
  tetracycline: ['tetracycline'],
  tetracyclines: ['tetracycline'],
  benzodiazepine: ['benzodiazepine'],
  benzodiazepines: ['benzodiazepine'],
};

export type InteractionSeverity = 'MAJOR' | 'MODERATE' | 'MINOR';

export interface InteractionRule {
  /** Class (or lower-case drug name) on each side of the interaction. */
  a: string;
  b: string;
  severity: InteractionSeverity;
  message: string;
}

// Small screening table for common, well-known interactions. Not a substitute for a
// licensed drug-interaction database.
export const INTERACTION_RULES: ReadonlyArray<InteractionRule> = [
  { a: 'anticoagulant', b: 'nsaid', severity: 'MAJOR', message: 'Increased bleeding risk with anticoagulant + NSAID.' },
  { a: 'anticoagulant', b: 'antiplatelet', severity: 'MAJOR', message: 'Increased bleeding risk with anticoagulant + antiplatelet.' },
  { a: 'vitamin-k-antagonist', b: 'macrolide', severity: 'MAJOR', message: 'Macrolides can raise INR in patients on warfarin.' },
  { a: 'vitamin-k-antagonist', b: 'fluoroquinolone', severity: 'MAJOR', message: 'Fluoroquinolones can raise INR in patients on warfarin.' },
  { a: 'vitamin-k-antagonist', b: 'sulfonamide', severity: 'MAJOR', message: 'Sulfamethoxazole can markedly raise INR in patients on warfarin.' },
  { a: 'nitrate', b: 'pde5-inhibitor', severity: 'MAJOR', message: 'Nitrate + PDE5 inhibitor can cause severe hypotension.' },
  { a: 'opioid', b: 'benzodiazepine', severity: 'MAJOR', message: 'Opioid + benzodiazepine increases risk of respiratory depression.' },
  { a: 'cyp3a4-substrate', b: 'cyp3a4-inhibitor', severity: 'MAJOR', message: 'Strong CYP3A4 inhibitor raises simvastatin levels (myopathy/rhabdomyolysis risk).' },
  { a: 'ace-inhibitor', b: 'potassium-sparing-diuretic', severity: 'MODERATE', message: 'ACE inhibitor + potassium-sparing diuretic can cause hyperkalemia.' },
  { a: 'ace-inhibitor', b: 'potassium', severity: 'MODERATE', message: 'ACE inhibitor + potassium supplement can cause hyperkalemia.' },
  { a: 'arb', b: 'potassium-sparing-diuretic', severity: 'MODERATE', message: 'ARB + potassium-sparing diuretic can cause hyperkalemia.' },
  { a: 'ssri', b: 'serotonergic', severity: 'MODERATE', message: 'Combining serotonergic agents increases serotonin syndrome risk.' },
  { a: 'ssri', b: 'nsaid', severity: 'MODERATE', message: 'SSRI + NSAID increases GI bleeding risk.' },
  { a: 'tramadol', b: 'serotonergic', severity: 'MODERATE', message: 'Tramadol with serotonergic agents increases serotonin syndrome risk.' },
  { a: 'thyroid', b: 'calcium', severity: 'MINOR', message: 'Calcium reduces levothyroxine absorption — separate doses by 4 hours.' },
  { a: 'thyroid', b: 'iron', severity: 'MINOR', message: 'Iron reduces levothyroxine absorption — separate doses by 4 hours.' },
  { a: 'tetracycline', b: 'calcium', severity: 'MINOR', message: 'Calcium reduces tetracycline absorption — separate doses.' },
];
