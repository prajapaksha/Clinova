import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

const dbUrl = (process.env['DATABASE_URL'] ?? 'file:./dev.db').replace(/^file:/, '');
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ─── helpers ────────────────────────────────────────────────────────────────

function mrn(n: number) {
  return `CLV-2026-${String(n).padStart(5, '0')}`;
}

function addr(street1: string, city: string, state: string, postalCode: string) {
  return { street1, street2: null, city, state, postalCode, country: 'US' };
}

function contact(
  primaryPhone: string,
  email: string | null,
  mailingAddress: ReturnType<typeof addr>,
  secondaryPhone?: string,
) {
  return JSON.stringify({
    primaryPhone,
    secondaryPhone: secondaryPhone ?? null,
    email,
    preferredMethod: 'PHONE',
    mailingAddress,
    billingAddress: null,
  });
}

function emergencyContacts(
  contacts: Array<{ name: string; relationship: string; phone: string }>,
) {
  return JSON.stringify(contacts);
}

function allergy(
  type: string,
  allergen: string,
  reaction: string,
  severity: string,
  notes?: string,
  onsetDate?: string,
) {
  return {
    id: randomUUID(),
    type,
    allergen,
    reaction,
    severity,
    onsetDate: onsetDate ?? null,
    notes: notes ?? null,
  };
}

function insurance(
  provider: string,
  policyNumber: string,
  subscriberName: string,
  effectiveDate: string,
  opts: {
    isPrimary?: boolean;
    groupNumber?: string;
    relationship?: string;
    copayAmountCents?: number;
    deductibleAmountCents?: number;
    expirationDate?: string;
  } = {},
) {
  return {
    id: randomUUID(),
    isPrimary: opts.isPrimary ?? true,
    provider,
    policyNumber,
    groupNumber: opts.groupNumber ?? null,
    subscriberName,
    subscriberDob: null,
    relationship: opts.relationship ?? 'SELF',
    effectiveDate,
    expirationDate: opts.expirationDate ?? null,
    copayAmountCents: opts.copayAmountCents ?? null,
    deductibleAmountCents: opts.deductibleAmountCents ?? null,
  };
}

function alert(severity: string, message: string, isActive = true) {
  return {
    id: randomUUID(),
    severity,
    message,
    isActive,
    createdAt: new Date().toISOString(),
  };
}

function consent(
  privacyPolicySigned: string | null,
  marketing: boolean,
  telehealth: boolean,
) {
  return JSON.stringify({
    privacyPolicySignedAt: privacyPolicySigned,
    marketingConsent: marketing,
    telehealthConsent: telehealth,
    releaseOfInfoAuthorizations: [],
  });
}

// ─── patient records ─────────────────────────────────────────────────────────

const patients = [
  // 1 — Elderly diabetic with Medicare, multiple conditions, critical allergy
  {
    mrn: mrn(1),
    title: 'Mr',
    firstName: 'James',
    middleName: 'Earl',
    lastName: 'Okafor',
    preferredName: null,
    dateOfBirth: new Date('1957-04-09'),
    sex: 'MALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'B_POSITIVE',
    heightCm: 178,
    weightKg: 92.4,
    maritalStatus: 'MARRIED',
    occupation: 'Retired',
    preferredLanguage: 'English',
    ethnicity: 'Black or African American',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('555-0101', 'j.okafor@email.com', addr('412 Magnolia Lane', 'Houston', 'TX', '77002')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Patricia Okafor', relationship: 'Spouse', phone: '555-0102' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'Sulfa', 'Severe rash and hives', 'CRITICAL', 'Documented 2018 — carry epi-pen'),
      allergy('FOOD', 'Shellfish', 'Urticaria', 'HIGH'),
    ]),
    chronicConditionsJson: JSON.stringify(['Type 2 Diabetes Mellitus', 'Hypertension', 'Chronic Kidney Disease Stage 3']),
    currentMedicationsJson: JSON.stringify(['Metformin 1000mg BID', 'Lisinopril 10mg QD', 'Atorvastatin 40mg QD', 'Aspirin 81mg QD']),
    pastSurgeriesJson: JSON.stringify(['Appendectomy (1989)', 'Right knee arthroscopy (2014)']),
    familyHistoryJson: JSON.stringify(['Father: Type 2 Diabetes, CAD', 'Mother: Hypertension, Stroke']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'Pneumococcal (2023)', 'Shingrix series (2022)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Medicare Part B', 'MCR-0104-TX-JEO', 'James E Okafor', '2022-07-01', { copayAmountCents: 2000, deductibleAmountCents: 22600 }),
      insurance('Humana Gold Plus HMO', 'HGP-88321', 'James E Okafor', '2023-01-01', { isPrimary: false, copayAmountCents: 500, deductibleAmountCents: 0 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('CRITICAL', 'SULFA ALLERGY — no sulfonamides or sulfonylureas'),
      alert('HIGH', 'CKD Stage 3 — adjust renally-cleared medications'),
    ]),
    consentJson: consent('2023-02-14T10:00:00.000Z', false, true),
  },

  // 2 — Young professional, no insurance, urgent care
  {
    mrn: mrn(2),
    title: 'Ms',
    firstName: 'Priya',
    middleName: null,
    lastName: 'Nair',
    preferredName: 'Pri',
    dateOfBirth: new Date('1996-11-22'),
    sex: 'FEMALE',
    genderIdentity: 'WOMAN',
    pronouns: 'she/her',
    photoUrl: null,
    bloodType: 'O_POSITIVE',
    heightCm: 162,
    weightKg: 58.0,
    maritalStatus: 'SINGLE',
    occupation: 'UX Designer',
    preferredLanguage: 'English',
    ethnicity: 'Asian — South Asian',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('415-555-0201', 'priya.nair@designstudio.io', addr('820 Valencia St Apt 4', 'San Francisco', 'CA', '94110')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Rohini Nair', relationship: 'Mother', phone: '408-555-0202' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'NSAIDs', 'Asthma exacerbation', 'HIGH', 'Use acetaminophen instead'),
    ]),
    chronicConditionsJson: JSON.stringify(['Asthma (mild persistent)']),
    currentMedicationsJson: JSON.stringify(['Fluticasone/Salmeterol inhaler PRN', 'Albuterol inhaler PRN']),
    pastSurgeriesJson: JSON.stringify([]),
    familyHistoryJson: JSON.stringify(['Mother: Asthma', 'Maternal grandmother: Hypertension']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'COVID-19 booster (2024)', 'Tdap (2021)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Covered California — Anthem Blue Cross', 'ANTCA-88220-PN', 'Priya Nair', '2026-01-01', { copayAmountCents: 3000, deductibleAmountCents: 250000 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([]),
    consentJson: consent('2026-01-10T09:30:00.000Z', true, true),
  },

  // 3 — Bilingual patient, two insurance policies, chronic conditions
  {
    mrn: mrn(3),
    title: 'Mrs',
    firstName: 'Sofia',
    middleName: 'Maria',
    lastName: 'Reyes',
    preferredName: null,
    dateOfBirth: new Date('1979-06-03'),
    sex: 'FEMALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'A_POSITIVE',
    heightCm: 158,
    weightKg: 74.5,
    maritalStatus: 'MARRIED',
    occupation: 'School Teacher',
    preferredLanguage: 'Spanish',
    ethnicity: 'Hispanic or Latino',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('305-555-0301', 'sreyes@miamedschool.edu', addr('2210 SW 8th St', 'Miami', 'FL', '33135'), '305-555-0302'),
    emergencyContactsJson: emergencyContacts([
      { name: 'Carlos Reyes', relationship: 'Spouse', phone: '305-555-0303' },
      { name: 'Ana Gutierrez', relationship: 'Sister', phone: '786-555-0304' },
    ]),
    allergiesJson: JSON.stringify([]),
    chronicConditionsJson: JSON.stringify(['Hypothyroidism', 'Migraine with aura', 'Vitamin D deficiency']),
    currentMedicationsJson: JSON.stringify(['Levothyroxine 100mcg QD', 'Sumatriptan 50mg PRN', 'Vitamin D3 2000IU QD']),
    pastSurgeriesJson: JSON.stringify(['C-section (2007)', 'Laparoscopic cholecystectomy (2019)']),
    familyHistoryJson: JSON.stringify(['Mother: Hypothyroidism, Diabetes T2', 'Father: Hypertension']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'COVID-19 (2023)', 'MMR booster (2020)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Florida Blue HMO', 'FLB-SR-20220301', 'Sofia M Reyes', '2022-03-01', { groupNumber: 'GRP-44512', copayAmountCents: 2500, deductibleAmountCents: 100000 }),
      insurance('Cigna Dental & Vision', 'CGDV-44512-SR', 'Sofia M Reyes', '2022-03-01', { isPrimary: false, copayAmountCents: 1000 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('MEDIUM', 'Spanish-preferred — interpreter recommended for complex discussions'),
    ]),
    consentJson: consent('2022-03-12T14:00:00.000Z', true, false),
  },

  // 4 — Elderly woman, complex medical history, critical alert
  {
    mrn: mrn(4),
    title: 'Mrs',
    firstName: 'Ruth',
    middleName: 'Anne',
    lastName: 'Abernathy',
    preferredName: 'Ruthie',
    dateOfBirth: new Date('1942-12-18'),
    sex: 'FEMALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'AB_NEGATIVE',
    heightCm: 155,
    weightKg: 60.2,
    maritalStatus: 'WIDOWED',
    occupation: 'Retired',
    preferredLanguage: 'English',
    ethnicity: 'White or Caucasian',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('615-555-0401', null, addr('88 Dogwood Circle', 'Nashville', 'TN', '37201'), '615-555-0402'),
    emergencyContactsJson: emergencyContacts([
      { name: 'Beverly Holt', relationship: 'Daughter', phone: '615-555-0403' },
      { name: 'Franklin Abernathy', relationship: 'Son', phone: '901-555-0404' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'Warfarin', 'Severe GI bleeding (hospitalized 2021)', 'CRITICAL', 'Do not prescribe — use DOAC alternatives only'),
      allergy('DRUG', 'Codeine', 'Severe nausea and respiratory depression', 'HIGH'),
      allergy('ENVIRONMENTAL', 'Bee venom', 'Anaphylaxis — carries EpiPen', 'CRITICAL'),
    ]),
    chronicConditionsJson: JSON.stringify([
      'Atrial fibrillation',
      'Heart failure (HFrEF, EF 35%)',
      'Osteoporosis',
      'Osteoarthritis bilateral knees',
      'Age-related macular degeneration',
      'Mild cognitive impairment',
    ]),
    currentMedicationsJson: JSON.stringify([
      'Apixaban 5mg BID',
      'Carvedilol 12.5mg BID',
      'Sacubitril/Valsartan 49/51mg BID',
      'Furosemide 40mg QD',
      'Alendronate 70mg weekly',
      'Calcium + D3 daily',
    ]),
    pastSurgeriesJson: JSON.stringify([
      'Hysterectomy (1978)',
      'Left hip replacement (2015)',
      'Cardiac ablation (2019)',
      'Cataract surgery left eye (2023)',
    ]),
    familyHistoryJson: JSON.stringify([
      'Husband (deceased): MI at 71',
      'Father: Stroke',
      'Mother: Dementia',
    ]),
    immunizationLogJson: JSON.stringify(['High-dose Influenza (2025)', 'Pneumococcal PCV20 (2024)', 'Shingrix series (2021)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Medicare Part B', 'MCR-0142-TN-RAA', 'Ruth A Abernathy', '2007-12-01', { copayAmountCents: 2000, deductibleAmountCents: 22600 }),
      insurance('AARP / United Healthcare Supplement Plan G', 'AARP-TN-0142-RA', 'Ruth A Abernathy', '2020-01-01', { isPrimary: false, copayAmountCents: 0, deductibleAmountCents: 22600 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('CRITICAL', 'WARFARIN ALLERGY — use DOAC only (currently on Apixaban)'),
      alert('CRITICAL', 'BEE VENOM ANAPHYLAXIS — EpiPen on file, caution during any outdoor procedure'),
      alert('HIGH', 'Falls risk — frailty + bilateral knee OA + macular degeneration'),
      alert('HIGH', 'Advance directive on file — DNR/DNI'),
    ]),
    consentJson: consent('2021-08-20T10:00:00.000Z', false, false),
  },

  // 5 — Pediatric patient (child), parent as primary contact
  {
    mrn: mrn(5),
    title: null,
    firstName: 'Liam',
    middleName: null,
    lastName: 'Chen',
    preferredName: null,
    dateOfBirth: new Date('2013-03-30'),
    sex: 'MALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'O_NEGATIVE',
    heightCm: 148,
    weightKg: 38.0,
    maritalStatus: null,
    occupation: null,
    preferredLanguage: 'English',
    ethnicity: 'Asian — East Asian',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('626-555-0501', 'mei.chen@family.com', addr('770 Monterey Rd', 'Pasadena', 'CA', '91106')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Mei Chen', relationship: 'Mother', phone: '626-555-0501' },
      { name: 'David Chen', relationship: 'Father', phone: '626-555-0502' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('FOOD', 'Peanuts', 'Anaphylaxis', 'CRITICAL', 'EpiPen at school and on file', '2017-04-15'),
      allergy('FOOD', 'Tree nuts', 'Swelling and hives', 'HIGH'),
    ]),
    chronicConditionsJson: JSON.stringify(['Peanut / tree nut allergy (anaphylaxis risk)', 'Mild persistent asthma']),
    currentMedicationsJson: JSON.stringify(['Montelukast 5mg QD', 'Fluticasone propionate inhaler 44mcg BID', 'Albuterol inhaler PRN']),
    pastSurgeriesJson: JSON.stringify(['Tonsillectomy and adenoidectomy (2020)']),
    familyHistoryJson: JSON.stringify(['Mother: Seasonal allergies', 'Maternal uncle: Peanut allergy']),
    immunizationLogJson: JSON.stringify(['MMR (2024)', 'Varicella (2024)', 'HPV series started (2025)', 'Influenza (2025)', 'COVID-19 (2024)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Anthem Blue Cross PPO', 'ANTCA-FAM-CHEN-0503', 'David Chen', '2024-01-01', { groupNumber: 'EMP-CHEN-2024', copayAmountCents: 2000, deductibleAmountCents: 300000, relationship: 'CHILD' }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('CRITICAL', 'PEANUT / TREE NUT ANAPHYLAXIS — EpiPen must be accessible at all times'),
      alert('MEDIUM', 'Minor patient — parent/guardian consent required for all procedures'),
    ]),
    consentJson: consent('2024-02-05T11:00:00.000Z', false, true),
  },

  // 6 — Middle-aged man, COPD, tobacco history
  {
    mrn: mrn(6),
    title: 'Mr',
    firstName: 'Thomas',
    middleName: 'Patrick',
    lastName: 'Brennan',
    preferredName: 'Tom',
    dateOfBirth: new Date('1966-09-14'),
    sex: 'MALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'A_NEGATIVE',
    heightCm: 182,
    weightKg: 105.3,
    maritalStatus: 'DIVORCED',
    occupation: 'Construction Foreman',
    preferredLanguage: 'English',
    ethnicity: 'White or Caucasian',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('617-555-0601', 'tbrennan@constructco.com', addr('34 Shamrock Way', 'Boston', 'MA', '02101')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Colleen Brennan', relationship: 'Ex-spouse (listed by patient)', phone: '617-555-0602' },
      { name: 'Declan Brennan', relationship: 'Son', phone: '617-555-0603' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'ACE Inhibitors', 'Chronic cough', 'MEDIUM', 'Use ARB instead'),
    ]),
    chronicConditionsJson: JSON.stringify([
      'COPD (GOLD Stage II — moderate)',
      'Hypertension',
      'Obesity (BMI 31.8)',
      'Obstructive Sleep Apnea',
    ]),
    currentMedicationsJson: JSON.stringify([
      'Tiotropium inhaler 18mcg QD',
      'Formoterol/Budesonide inhaler 160/4.5mcg BID',
      'Amlodipine 10mg QD',
      'CPAP therapy nightly',
    ]),
    pastSurgeriesJson: JSON.stringify(['Inguinal hernia repair (2011)']),
    familyHistoryJson: JSON.stringify(['Father: Lung cancer (smoker, deceased 2010)', 'Mother: Hypertension, Stroke']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'Pneumococcal PPSV23 (2022)', 'COVID-19 (2023)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Tufts Health Plan — Commercial', 'THP-TB-0601', 'Thomas P Brennan', '2025-01-01', { groupNumber: 'GRP-CONSTCO-055', copayAmountCents: 3500, deductibleAmountCents: 150000 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('HIGH', 'Former smoker 40 pack-years — annual low-dose CT lung screening recommended'),
    ]),
    consentJson: consent('2025-01-08T08:00:00.000Z', false, true),
  },

  // 7 — Young adult, non-binary, mental health history
  {
    mrn: mrn(7),
    title: null,
    firstName: 'Jordan',
    middleName: null,
    lastName: 'Blake',
    preferredName: 'J',
    dateOfBirth: new Date('1999-02-17'),
    sex: 'UNKNOWN',
    genderIdentity: 'NON_BINARY',
    pronouns: 'they/them',
    photoUrl: null,
    bloodType: 'B_NEGATIVE',
    heightCm: 170,
    weightKg: 65.0,
    maritalStatus: 'SINGLE',
    occupation: 'Barista / Freelance Artist',
    preferredLanguage: 'English',
    ethnicity: 'Multiracial',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('312-555-0701', 'jordan.blake.art@proton.me', addr('1450 N Milwaukee Ave Apt 2', 'Chicago', 'IL', '60622')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Avery Blake', relationship: 'Parent', phone: '312-555-0702' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'Lithium', 'Toxic at therapeutic levels — blood dyscrasias', 'HIGH', 'Failed trial 2022 — use alternatives'),
    ]),
    chronicConditionsJson: JSON.stringify(['Bipolar I Disorder', 'Generalized Anxiety Disorder', 'Migraines']),
    currentMedicationsJson: JSON.stringify([
      'Lamotrigine 200mg QD',
      'Quetiapine 50mg QHS',
      'Escitalopram 10mg QD',
      'Sumatriptan 50mg PRN',
    ]),
    pastSurgeriesJson: JSON.stringify([]),
    familyHistoryJson: JSON.stringify(['Parent: Bipolar II', 'Grandparent: Major depression']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'COVID-19 (2024)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Illinois Medicaid — HFS', 'ILMED-JB-0701', 'Jordan Blake', '2023-09-01', { copayAmountCents: 0, deductibleAmountCents: 0 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('HIGH', 'Psychotropic medications — verify no interactions before any new Rx'),
      alert('MEDIUM', 'Patient prefers they/them pronouns — please note in all communications'),
    ]),
    consentJson: consent('2023-09-15T13:00:00.000Z', false, true),
  },

  // 8 — Retiree, Medicare + supplemental, cardiac history
  {
    mrn: mrn(8),
    title: 'Mrs',
    firstName: 'Diane',
    middleName: 'Louise',
    lastName: 'Fletcher',
    preferredName: null,
    dateOfBirth: new Date('1952-08-29'),
    sex: 'FEMALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'A_POSITIVE',
    heightCm: 163,
    weightKg: 68.1,
    maritalStatus: 'MARRIED',
    occupation: 'Retired RN',
    preferredLanguage: 'English',
    ethnicity: 'White or Caucasian',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('602-555-0801', 'diane.fletcher@aol.com', addr('4890 E Camelback Rd', 'Scottsdale', 'AZ', '85251')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Gerald Fletcher', relationship: 'Spouse', phone: '602-555-0802' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'Contrast dye (iodine-based)', 'Urticaria and bronchospasm', 'HIGH', 'Pre-medicate per protocol if imaging required'),
      allergy('DRUG', 'Metoprolol', 'Severe bradycardia', 'MEDIUM'),
    ]),
    chronicConditionsJson: JSON.stringify([
      'Coronary artery disease (2-vessel)',
      'Post-CABG (2020)',
      'Hypertension',
      'Hyperlipidemia',
      'Type 2 Diabetes — well controlled',
      'Peripheral neuropathy',
    ]),
    currentMedicationsJson: JSON.stringify([
      'Rosuvastatin 40mg QD',
      'Aspirin 81mg QD',
      'Clopidogrel 75mg QD',
      'Ramipril 10mg QD',
      'Metformin 500mg BID',
      'Gabapentin 300mg TID',
    ]),
    pastSurgeriesJson: JSON.stringify([
      'CABG x2 (2020)',
      'Carotid endarterectomy left (2018)',
      'Appendectomy (1975)',
    ]),
    familyHistoryJson: JSON.stringify(['Father: MI at 58', 'Mother: T2DM, Stroke', 'Sister: CAD']),
    immunizationLogJson: JSON.stringify(['High-dose Influenza (2025)', 'Pneumococcal PCV20 (2024)', 'Shingrix series (2023)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Medicare Part B', 'MCR-0152-AZ-DLF', 'Diane L Fletcher', '2017-08-01', { copayAmountCents: 2000, deductibleAmountCents: 22600 }),
      insurance('BCBS Medicare Supplement Plan N', 'BCBS-AZ-SUP-0801', 'Diane L Fletcher', '2017-08-01', { isPrimary: false, copayAmountCents: 2000, deductibleAmountCents: 0 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('HIGH', 'Iodine contrast allergy — pre-medication protocol required for any contrast imaging'),
      alert('MEDIUM', 'On dual antiplatelet therapy — bleeding risk, notify cardiologist before invasive procedures'),
    ]),
    consentJson: consent('2021-03-02T09:00:00.000Z', true, true),
  },

  // 9 — Arabic-speaking patient, VIP flag
  {
    mrn: mrn(9),
    title: 'Mr',
    firstName: 'Hassan',
    middleName: null,
    lastName: 'Al-Rashid',
    preferredName: null,
    dateOfBirth: new Date('1980-01-05'),
    sex: 'MALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'O_POSITIVE',
    heightCm: 176,
    weightKg: 88.0,
    maritalStatus: 'MARRIED',
    occupation: 'International Trade Consultant',
    preferredLanguage: 'Arabic',
    ethnicity: 'Middle Eastern or North African',
    isVip: true,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('313-555-0901', 'hassan.alrashid@tradeconsult.ae', addr('1200 Renaissance Dr', 'Detroit', 'MI', '48243'), '313-555-0902'),
    emergencyContactsJson: emergencyContacts([
      { name: 'Fatima Al-Rashid', relationship: 'Spouse', phone: '313-555-0903' },
    ]),
    allergiesJson: JSON.stringify([]),
    chronicConditionsJson: JSON.stringify(['Hypertension', 'Dyslipidemia']),
    currentMedicationsJson: JSON.stringify(['Olmesartan 40mg QD', 'Rosuvastatin 20mg QD']),
    pastSurgeriesJson: JSON.stringify([]),
    familyHistoryJson: JSON.stringify(['Father: Hypertension, T2DM']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'Typhoid (2024)', 'Hepatitis A series (2023)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Blue Care Network PPO', 'BCN-HAR-0901', 'Hassan Al-Rashid', '2025-01-01', { groupNumber: 'GRP-TRDCONS-01', copayAmountCents: 2000, deductibleAmountCents: 100000 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('MEDIUM', 'Arabic-preferred — professional interpreter required for clinical discussions'),
      alert('LOW', 'VIP patient — coordinate with patient relations before scheduling'),
    ]),
    consentJson: consent('2025-01-20T11:00:00.000Z', false, true),
  },

  // 10 — Post-partum, new mother
  {
    mrn: mrn(10),
    title: 'Ms',
    firstName: 'Amara',
    middleName: 'Joy',
    lastName: 'Johnson',
    preferredName: null,
    dateOfBirth: new Date('1995-05-08'),
    sex: 'FEMALE',
    genderIdentity: 'WOMAN',
    pronouns: 'she/her',
    photoUrl: null,
    bloodType: 'A_NEGATIVE',
    heightCm: 167,
    weightKg: 72.0,
    maritalStatus: 'DOMESTIC_PARTNER',
    occupation: 'Registered Nurse',
    preferredLanguage: 'English',
    ethnicity: 'Black or African American',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('773-555-1001', 'amara.johnson.rn@northwesthealth.org', addr('3122 N Clark St', 'Chicago', 'IL', '60657')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Marcus Johnson', relationship: 'Partner', phone: '773-555-1002' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'Erythromycin', 'GI intolerance — severe nausea and vomiting', 'LOW'),
    ]),
    chronicConditionsJson: JSON.stringify(['Gestational hypertension (resolved post-partum)', 'Iron deficiency anemia (resolving)']),
    currentMedicationsJson: JSON.stringify(['Ferrous sulfate 325mg BID', 'Prenatal vitamins QD', 'Docusate sodium 100mg BID']),
    pastSurgeriesJson: JSON.stringify(['Primary cesarean section (2026-02)']),
    familyHistoryJson: JSON.stringify(['Mother: Hypertension', 'Maternal aunt: SLE']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'COVID-19 (2025)', 'Tdap (2025 — during pregnancy)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('BCBS Illinois PPO', 'BCBS-IL-AJJ-1001', 'Amara J Johnson', '2024-08-01', { groupNumber: 'GRP-NWHLTH-RN', copayAmountCents: 2000, deductibleAmountCents: 125000 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('MEDIUM', 'Post-partum (cesarean Feb 2026) — wound check and mental health screen at each visit'),
    ]),
    consentJson: consent('2024-08-10T10:00:00.000Z', true, true),
  },

  // 11 — Asian Pacific Islander, menopause management
  {
    mrn: mrn(11),
    title: 'Ms',
    firstName: 'Mei-Ling',
    middleName: null,
    lastName: 'Santos',
    preferredName: 'Mei',
    dateOfBirth: new Date('1972-10-19'),
    sex: 'FEMALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'AB_POSITIVE',
    heightCm: 156,
    weightKg: 54.0,
    maritalStatus: 'SINGLE',
    occupation: 'Hospitality Manager',
    preferredLanguage: 'English',
    ethnicity: 'Asian — Filipino / Pacific Islander',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('808-555-1101', 'meilings@pacifichotel.com', addr('1520 Kapiolani Blvd Apt 12', 'Honolulu', 'HI', '96814')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Rosario Santos', relationship: 'Sister', phone: '808-555-1102' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'Aspirin', 'Hypersensitivity — urticaria', 'MEDIUM', 'Use acetaminophen for analgesia'),
    ]),
    chronicConditionsJson: JSON.stringify(['Perimenopause', 'Osteopenia', 'GERD']),
    currentMedicationsJson: JSON.stringify([
      'Estradiol patch 0.05mg/24h (twice weekly)',
      'Progesterone 200mg QHS (cyclic)',
      'Omeprazole 20mg QD',
      'Calcium 600mg + D3 BID',
    ]),
    pastSurgeriesJson: JSON.stringify(['Ovarian cyst removal, laparoscopic (2001)']),
    familyHistoryJson: JSON.stringify(['Mother: Osteoporosis, Breast cancer (BRCA negative)', 'Father: T2DM']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'COVID-19 (2024)', 'Shingrix series (2023)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('HMSA Blue Cross Blue Shield Hawaii', 'HMSA-MLS-1101', 'Mei-Ling Santos', '2024-01-01', { copayAmountCents: 1500, deductibleAmountCents: 75000 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([]),
    consentJson: consent('2024-01-22T15:30:00.000Z', false, true),
  },

  // 12 — College student, sports injury
  {
    mrn: mrn(12),
    title: null,
    firstName: 'Caleb',
    middleName: null,
    lastName: 'Murphy',
    preferredName: null,
    dateOfBirth: new Date('2003-07-11'),
    sex: 'MALE',
    genderIdentity: 'MAN',
    pronouns: 'he/him',
    photoUrl: null,
    bloodType: 'O_POSITIVE',
    heightCm: 188,
    weightKg: 85.0,
    maritalStatus: 'SINGLE',
    occupation: 'Student (University of Oregon)',
    preferredLanguage: 'English',
    ethnicity: 'White or Caucasian',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('541-555-1201', 'caleb.murphy@uoregon.edu', addr('1860 E 15th Ave Apt 6', 'Eugene', 'OR', '97403')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Kathleen Murphy', relationship: 'Mother', phone: '541-555-1202' },
    ]),
    allergiesJson: JSON.stringify([]),
    chronicConditionsJson: JSON.stringify(['ACL reconstruction — right knee (recovery ongoing)']),
    currentMedicationsJson: JSON.stringify(['Naproxen 500mg BID PRN', 'Vitamin C 1000mg QD']),
    pastSurgeriesJson: JSON.stringify(['Right ACL reconstruction with patellar tendon graft (2025-11)']),
    familyHistoryJson: JSON.stringify(['No significant family history reported']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'COVID-19 (2024)', 'Meningococcal ACWY (2021)', 'HPV series complete (2020)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Oregon Health Plan (OHP)', 'OHP-CM-1201', 'Caleb Murphy', '2025-09-01', { copayAmountCents: 0, deductibleAmountCents: 0 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([]),
    consentJson: consent('2025-09-05T11:00:00.000Z', false, true),
  },

  // 13 — Transgender man, HRT
  {
    mrn: mrn(13),
    title: 'Mr',
    firstName: 'Ezra',
    middleName: null,
    lastName: 'Torres',
    preferredName: null,
    dateOfBirth: new Date('1990-04-25'),
    sex: 'FEMALE',
    genderIdentity: 'TRANSGENDER_MAN',
    pronouns: 'he/him',
    photoUrl: null,
    bloodType: 'B_POSITIVE',
    heightCm: 165,
    weightKg: 78.0,
    maritalStatus: 'SINGLE',
    occupation: 'Librarian',
    preferredLanguage: 'English',
    ethnicity: 'Hispanic or Latino',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('505-555-1301', 'ezra.torres.lib@abqlibrary.org', addr('800 Marquette Ave NW', 'Albuquerque', 'NM', '87102')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Carmen Torres', relationship: 'Mother', phone: '505-555-1302' },
    ]),
    allergiesJson: JSON.stringify([]),
    chronicConditionsJson: JSON.stringify([
      'Gender dysphoria — on HRT (testosterone therapy)',
      'Depression (well-controlled)',
    ]),
    currentMedicationsJson: JSON.stringify([
      'Testosterone cypionate 100mg/mL IM every 2 weeks',
      'Sertraline 100mg QD',
    ]),
    pastSurgeriesJson: JSON.stringify(['Bilateral mastectomy (2022)']),
    familyHistoryJson: JSON.stringify(['Father: Hypertension', 'Mother: Anxiety, Depression']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'COVID-19 (2024)', 'Hepatitis B series (2020)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Presbyterian Health Plan NM', 'PHP-NM-ET-1301', 'Ezra Torres', '2024-03-01', { copayAmountCents: 2000, deductibleAmountCents: 75000 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('MEDIUM', 'Transgender patient — use legal name Ezra and he/him pronouns in all communications'),
    ]),
    consentJson: consent('2024-03-08T14:00:00.000Z', false, true),
  },

  // 14 — Occupational health patient, chemical exposure
  {
    mrn: mrn(14),
    title: 'Ms',
    firstName: 'Gloria',
    middleName: 'Jean',
    lastName: 'Washington',
    preferredName: 'Glo',
    dateOfBirth: new Date('1968-02-14'),
    sex: 'FEMALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'A_POSITIVE',
    heightCm: 170,
    weightKg: 82.0,
    maritalStatus: 'MARRIED',
    occupation: 'Industrial Hygienist',
    preferredLanguage: 'English',
    ethnicity: 'Black or African American',
    isVip: false,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('404-555-1401', 'gloria.washington@safeworkga.com', addr('1720 Peachtree Rd NE', 'Atlanta', 'GA', '30309'), '404-555-1402'),
    emergencyContactsJson: emergencyContacts([
      { name: 'Derrick Washington', relationship: 'Spouse', phone: '404-555-1403' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('ENVIRONMENTAL', 'Formaldehyde', 'Asthma exacerbation, contact dermatitis', 'HIGH', 'Occupational exposure documented — employer notified'),
      allergy('LATEX', 'Natural rubber latex', 'Contact urticaria', 'MEDIUM', 'Use only non-latex gloves'),
    ]),
    chronicConditionsJson: JSON.stringify([
      'Occupational asthma (formaldehyde-induced)',
      'Allergic contact dermatitis',
      'Hypertension',
    ]),
    currentMedicationsJson: JSON.stringify([
      'Beclomethasone inhaler 200mcg BID',
      'Albuterol PRN',
      'Hydrocortisone cream 1% topical PRN',
      'Hydrochlorothiazide 25mg QD',
    ]),
    pastSurgeriesJson: JSON.stringify(['LASIK (2010)']),
    familyHistoryJson: JSON.stringify(['Mother: Hypertension, T2DM', 'Brother: Asthma']),
    immunizationLogJson: JSON.stringify(['Influenza (2025)', 'COVID-19 (2024)', 'Hepatitis B (occupational, 2015)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Aetna HMO — Employer', 'AETNA-GJW-1401', 'Gloria J Washington', '2025-01-01', { groupNumber: 'GRP-SWGA-2025', copayAmountCents: 2000, deductibleAmountCents: 100000 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('HIGH', 'LATEX ALLERGY — non-latex gloves required for all procedures'),
      alert('MEDIUM', 'Occupational asthma — formaldehyde exposure must be documented and reported'),
    ]),
    consentJson: consent('2025-01-06T09:00:00.000Z', true, true),
  },

  // 15 — High-functioning older adult, minimal conditions
  {
    mrn: mrn(15),
    title: 'Dr',
    firstName: 'Leonard',
    middleName: 'Alan',
    lastName: 'Howell',
    preferredName: 'Len',
    dateOfBirth: new Date('1948-11-30'),
    sex: 'MALE',
    genderIdentity: null,
    pronouns: null,
    photoUrl: null,
    bloodType: 'O_NEGATIVE',
    heightCm: 180,
    weightKg: 76.0,
    maritalStatus: 'MARRIED',
    occupation: 'Retired Professor (Biochemistry)',
    preferredLanguage: 'English',
    ethnicity: 'White or Caucasian',
    isVip: true,
    isArchived: false,
    archivedAt: null,
    contactJson: contact('617-555-1501', 'lahowell@harvard.edu', addr('52 Brattle St', 'Cambridge', 'MA', '02138')),
    emergencyContactsJson: emergencyContacts([
      { name: 'Margaret Howell', relationship: 'Spouse', phone: '617-555-1502' },
      { name: 'Elizabeth Howell-Park', relationship: 'Daughter', phone: '617-555-1503' },
    ]),
    allergiesJson: JSON.stringify([
      allergy('DRUG', 'Penicillin', 'Maculopapular rash (1968)', 'MEDIUM', 'Historical — may not be true allergy; consider formal allergy testing'),
    ]),
    chronicConditionsJson: JSON.stringify(['Benign prostatic hyperplasia', 'Age-related hearing loss (mild bilateral)']),
    currentMedicationsJson: JSON.stringify(['Tamsulosin 0.4mg QD', 'Fish oil 1g QD']),
    pastSurgeriesJson: JSON.stringify(['Cholecystectomy (1990)', 'TURP (2021)']),
    familyHistoryJson: JSON.stringify(['Father: CAD, deceased at 85', 'Mother: Alzheimer\'s, deceased at 91']),
    immunizationLogJson: JSON.stringify(['High-dose Influenza (2025)', 'Pneumococcal PCV20 (2024)', 'Shingrix series (2022)', 'COVID-19 bivalent (2024)']),
    insurancePoliciesJson: JSON.stringify([
      insurance('Medicare Part B', 'MCR-0148-MA-LAH', 'Leonard A Howell', '2013-11-01', { copayAmountCents: 2000, deductibleAmountCents: 22600 }),
      insurance('Harvard Pilgrim Medigap Plan F', 'HPHP-MA-SUPF-1501', 'Leonard A Howell', '2013-11-01', { isPrimary: false, copayAmountCents: 0, deductibleAmountCents: 0 }),
    ]),
    documentsJson: JSON.stringify([]),
    alertsJson: JSON.stringify([
      alert('LOW', 'Penicillin allergy reported — historical, consider formal testing at next visit'),
    ]),
    consentJson: consent('2021-08-01T10:00:00.000Z', false, true),
  },
];

// ─── appointment types ───────────────────────────────────────────────────────

const APPOINTMENT_TYPES = [
  { name: 'New Patient Visit',  defaultDurationMinutes: 45, bufferAfterMinutes: 0, color: '#1976D2' },
  { name: 'Follow-Up Visit',    defaultDurationMinutes: 15, bufferAfterMinutes: 0, color: '#00897B' },
  { name: 'Annual Physical',    defaultDurationMinutes: 60, bufferAfterMinutes: 0, color: '#388E3C' },
  { name: 'Urgent Care',        defaultDurationMinutes: 30, bufferAfterMinutes: 0, color: '#D32F2F' },
  { name: 'Procedure',          defaultDurationMinutes: 90, bufferAfterMinutes: 15, color: '#7B1FA2' },
];

const STAFF_USERS = [
  { email: 'admin@clinova.health',      password: 'Admin@2026',      firstName: 'Alex',    lastName: 'Rivera',   role: 'ADMIN' },
  { email: 'dr.chen@clinova.health',    password: 'Doctor@2026',     firstName: 'Wei',     lastName: 'Chen',     role: 'PHYSICIAN' },
  { email: 'dr.patel@clinova.health',   password: 'Doctor@2026',     firstName: 'Ananya',  lastName: 'Patel',    role: 'PHYSICIAN' },
  { email: 'nurse.kim@clinova.health',  password: 'Nurse@2026',      firstName: 'Ji-Yeon', lastName: 'Kim',      role: 'NURSE' },
  { email: 'reception@clinova.health',  password: 'Staff@2026',      firstName: 'Marcus',  lastName: 'Grant',    role: 'STAFF' },
];

async function main() {
  console.log('🗑  Clearing existing data…');
  await prisma.appointment.deleteMany({});
  await prisma.appointmentType.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.staff.deleteMany({});

  console.log(`🌱 Seeding ${patients.length} patients…\n`);
  for (const data of patients) {
    const row = await prisma.patient.create({ data });
    const allergyCount = JSON.parse(row.allergiesJson).length;
    const alertCount = JSON.parse(row.alertsJson).filter((a: any) => a.isActive).length;
    console.log(
      `  ✓ ${row.mrn}  ${row.firstName} ${row.lastName}  ` +
      `DOB ${row.dateOfBirth.toISOString().slice(0, 10)}  ` +
      (allergyCount ? `⚠ ${allergyCount} allerg${allergyCount > 1 ? 'ies' : 'y'}  ` : '') +
      (alertCount ? `🔔 ${alertCount} alert${alertCount > 1 ? 's' : ''}` : ''),
    );
  }

  console.log(`\n✅ Seeded ${patients.length} patients successfully.`);

  console.log('\n👥 Seeding staff users…\n');
  for (const u of STAFF_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.staff.create({ data: { email: u.email, passwordHash, firstName: u.firstName, lastName: u.lastName, role: u.role } });
    console.log(`  ✓ [${u.role.padEnd(9)}]  ${u.firstName} ${u.lastName}  <${u.email}>  pw: ${u.password}`);
  }
  console.log(`\n✅ Seeded ${STAFF_USERS.length} staff users successfully.`);

  // ─── appointment types ───────────────────────────────────────────────────
  console.log('\n📋 Seeding appointment types…\n');
  const seededTypes: Array<{ id: string; name: string }> = [];
  for (const at of APPOINTMENT_TYPES) {
    const row = await prisma.appointmentType.create({ data: at });
    seededTypes.push({ id: row.id, name: row.name });
    console.log(`  ✓ [${row.name}]  ${row.defaultDurationMinutes}min  ${row.color}`);
  }
  console.log(`\n✅ Seeded ${seededTypes.length} appointment types.`);

  // ─── sample appointments ─────────────────────────────────────────────────
  console.log('\n📅 Seeding sample appointments…\n');

  const chen  = await prisma.staff.findUnique({ where: { email: 'dr.chen@clinova.health' } });
  const patel = await prisma.staff.findUnique({ where: { email: 'dr.patel@clinova.health' } });
  const allPatients = await prisma.patient.findMany({ take: 8, orderBy: { createdAt: 'asc' }, select: { id: true, firstName: true, lastName: true } });

  if (!chen || !patel) throw new Error('Physicians not found — run staff seed first');
  if (allPatients.length < 6) throw new Error('Not enough patients found');

  const typeMap: Record<string, string> = {};
  for (const t of seededTypes) typeMap[t.name] = t.id;

  function slot(dateStr: string, startHour: number, startMin: number, durationMin: number) {
    const start = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`);
    const end   = new Date(start.getTime() + durationMin * 60_000);
    return { slotStart: start, slotEnd: end };
  }

  const sampleAppointments = [
    // Monday 2026-05-11
    { patientId: allPatients[0].id, providerId: chen.id,  appointmentTypeId: typeMap['New Patient Visit'],  ...slot('2026-05-11', 9,  0, 45), status: 'COMPLETED',  completedAt: new Date('2026-05-11T10:00:00'), reasonForVisit: 'Initial consultation for diabetes management' },
    { patientId: allPatients[1].id, providerId: patel.id, appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot('2026-05-11', 9,  0, 15), status: 'COMPLETED',  completedAt: new Date('2026-05-11T09:20:00'), reasonForVisit: 'Asthma follow-up' },
    { patientId: allPatients[2].id, providerId: chen.id,  appointmentTypeId: typeMap['Annual Physical'],    ...slot('2026-05-11', 10, 0, 60), status: 'COMPLETED',  completedAt: new Date('2026-05-11T11:10:00'), reasonForVisit: 'Annual wellness exam' },

    // Tuesday 2026-05-12
    { patientId: allPatients[3].id, providerId: patel.id, appointmentTypeId: typeMap['New Patient Visit'],  ...slot('2026-05-12', 9,  0, 45), status: 'CHECKED_IN', checkedInAt:  new Date('2026-05-12T08:55:00'), reasonForVisit: 'Evaluation of heart failure symptoms' },
    { patientId: allPatients[4].id, providerId: chen.id,  appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot('2026-05-12', 9,  0, 15), status: 'CONFIRMED',  reasonForVisit: 'Post-surgery knee check' },
    { patientId: allPatients[5].id, providerId: patel.id, appointmentTypeId: typeMap['Urgent Care'],        ...slot('2026-05-12', 10, 0, 30), status: 'SCHEDULED',  reasonForVisit: 'Acute asthma exacerbation' },

    // Wednesday 2026-05-13
    { patientId: allPatients[6].id, providerId: chen.id,  appointmentTypeId: typeMap['Annual Physical'],    ...slot('2026-05-13', 9,  0, 60), status: 'CONFIRMED',  reasonForVisit: 'Annual physical' },
    { patientId: allPatients[0].id, providerId: patel.id, appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot('2026-05-13', 10, 0, 15), status: 'SCHEDULED',  reasonForVisit: 'Review lab results' },
    { patientId: allPatients[7].id, providerId: chen.id,  appointmentTypeId: typeMap['Procedure'],          ...slot('2026-05-13', 11, 0, 90), status: 'SCHEDULED',  reasonForVisit: 'Minor procedure — wound care' },

    // Thursday 2026-05-14
    { patientId: allPatients[1].id, providerId: patel.id, appointmentTypeId: typeMap['Annual Physical'],    ...slot('2026-05-14', 9,  0, 60), status: 'SCHEDULED',  reasonForVisit: 'Annual wellness exam' },
    { patientId: allPatients[2].id, providerId: chen.id,  appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot('2026-05-14', 10, 0, 15), status: 'SCHEDULED',  reasonForVisit: 'Hypothyroidism medication review' },

    // Friday 2026-05-15
    { patientId: allPatients[3].id, providerId: chen.id,  appointmentTypeId: typeMap['Urgent Care'],        ...slot('2026-05-15', 9,  0, 30), status: 'SCHEDULED',  reasonForVisit: 'Urgent: chest tightness' },
    { patientId: allPatients[4].id, providerId: patel.id, appointmentTypeId: typeMap['New Patient Visit'],  ...slot('2026-05-15', 10, 0, 45), status: 'SCHEDULED',  reasonForVisit: 'New patient — post-ACL recovery' },
  ];

  for (const appt of sampleAppointments) {
    const row = await prisma.appointment.create({ data: appt as any });
    console.log(
      `  ✓ [${row.status.padEnd(10)}]  ${row.slotStart.toISOString().slice(0, 16)}  patient:${row.patientId.slice(-6)}  provider:${row.providerId.slice(-6)}`,
    );
  }
  console.log(`\n✅ Seeded ${sampleAppointments.length} appointments.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
