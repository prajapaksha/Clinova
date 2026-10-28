import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { createHash, randomUUID } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
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
  { name: 'New Patient Visit',  defaultDurationMinutes: 45, bufferAfterMinutes: 0, color: '#1976D2', defaultServiceCode: '99203', isPatientBookable: true, patientDescription: 'Your first visit with a provider here.' },
  { name: 'Follow-Up Visit',    defaultDurationMinutes: 15, bufferAfterMinutes: 0, color: '#00897B', defaultServiceCode: '99213', isPatientBookable: true, patientDescription: 'Check in on an ongoing condition or a recent visit.' },
  { name: 'Annual Physical',    defaultDurationMinutes: 60, bufferAfterMinutes: 0, color: '#388E3C', defaultServiceCode: '99396', isPatientBookable: true, patientDescription: 'Your yearly preventive check-up.' },
  { name: 'Urgent Care',        defaultDurationMinutes: 30, bufferAfterMinutes: 0, color: '#D32F2F', defaultServiceCode: '99214' },
  { name: 'Procedure',          defaultDurationMinutes: 90, bufferAfterMinutes: 15, color: '#7B1FA2', defaultServiceCode: '10060' },
];

// Common CPT code numbers with plain-language descriptions written for this demo.
// Official CPT descriptors are AMA-licensed; load them from the practice's licensed code set.
const FEE_SCHEDULE_LINES = [
  { cptCode: '10060', description: 'Incision and drainage of abscess, simple', priceCents: 21000 },
  { cptCode: '36415', description: 'Routine venous blood draw', priceCents: 2500 },
  { cptCode: '80053', description: 'Comprehensive metabolic panel', priceCents: 6000 },
  { cptCode: '81002', description: 'Urinalysis, non-automated', priceCents: 2000 },
  { cptCode: '85025', description: 'Complete blood count with differential', priceCents: 4500 },
  { cptCode: '90471', description: 'Immunization administration, first vaccine', priceCents: 3500 },
  { cptCode: '93000', description: 'Electrocardiogram with interpretation', priceCents: 7500 },
  { cptCode: '94640', description: 'Nebulizer inhalation treatment', priceCents: 5500 },
  { cptCode: '99202', description: 'New patient office visit — straightforward', priceCents: 11000 },
  { cptCode: '99203', description: 'New patient office visit — low complexity', priceCents: 16500 },
  { cptCode: '99204', description: 'New patient office visit — moderate complexity', priceCents: 24500 },
  { cptCode: '99212', description: 'Established patient visit — straightforward', priceCents: 8500 },
  { cptCode: '99213', description: 'Established patient visit — low complexity', priceCents: 13000 },
  { cptCode: '99214', description: 'Established patient visit — moderate complexity', priceCents: 18500 },
  { cptCode: '99215', description: 'Established patient visit — high complexity', priceCents: 25500 },
  { cptCode: '99396', description: 'Preventive visit, established patient, age 40–64', priceCents: 24000 },
  { cptCode: '99397', description: 'Preventive visit, established patient, age 65+', priceCents: 26000 },
];

const DAY_MS = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY_MS);

/** Weekly schedule JSON (0 = Sunday). */
function weekly(workDays: number[], start = '08:00', end = '17:00', lunch: [string, string] | null = ['12:00', '13:00']) {
  return JSON.stringify(Array.from({ length: 7 }, (_, d) => {
    const working = workDays.includes(d);
    return {
      dayOfWeek: d,
      isWorking: working,
      hours: working ? { start, end } : null,
      lunchBreak: working && lunch ? { start: lunch[0], end: lunch[1] } : null,
    };
  }));
}

type SeedCredential = { type: string; number: string; issuingState?: string; issuingAuthority?: string; issuedDaysAgo?: number; expiresInDays?: number; isVerified?: boolean };

// Credentials expire at varied offsets so the tracker and dashboard alerts have data.
const STAFF_USERS: Array<{
  email: string; password: string; firstName: string; lastName: string; role: string;
  title?: string; suffix?: string; phone?: string; officeLocation?: string; npi?: string;
  specialties?: string[]; bio?: string; schedule?: string; credentials?: SeedCredential[];
}> = [
  {
    email: 'superadmin@clinova.health', password: 'Super@Admin2026', firstName: 'Jordan', lastName: 'Blake', role: 'SUPER_ADMIN',
    phone: '(555) 010-0001', officeLocation: 'Administration, Suite 100', schedule: weekly([1, 2, 3, 4, 5]),
    bio: 'IT and compliance lead. Owns system configuration, user provisioning, and HIPAA audit reviews.',
  },
  {
    email: 'admin@clinova.health', password: 'Admin@2026', firstName: 'Alex', lastName: 'Rivera', role: 'ADMIN',
    phone: '(555) 010-0002', officeLocation: 'Administration, Suite 100', schedule: weekly([1, 2, 3, 4, 5]),
    bio: 'Practice manager responsible for scheduling, staffing, and front-office operations.',
  },
  {
    email: 'dr.chen@clinova.health', password: 'Doctor@2026', firstName: 'Wei', lastName: 'Chen', role: 'PHYSICIAN',
    title: 'Dr.', suffix: 'MD', phone: '(555) 010-0101', officeLocation: 'Clinic A, Room 204', npi: '1467582930',
    specialties: ['Internal Medicine', 'Cardiology'], schedule: weekly([1, 2, 3, 4, 5], '08:00', '17:00'),
    bio: 'Board-certified internist with a focus on cardiovascular risk management and chronic disease care.',
    credentials: [
      { type: 'MEDICAL_LICENSE', number: 'A-128734', issuingState: 'CA', issuingAuthority: 'Medical Board of California', issuedDaysAgo: 2900, expiresInDays: 410, isVerified: true },
      { type: 'DEA', number: 'BC4829173', issuingAuthority: 'U.S. Drug Enforcement Administration', issuedDaysAgo: 1070, expiresInDays: 25, isVerified: true },
      { type: 'BOARD_CERTIFICATION', number: 'ABIM-339201', issuingAuthority: 'American Board of Internal Medicine', issuedDaysAgo: 2200, expiresInDays: 1450, isVerified: true },
      { type: 'NPI', number: '1467582930', issuingAuthority: 'CMS NPPES', issuedDaysAgo: 4000, isVerified: true },
      { type: 'MALPRACTICE', number: 'MP-55-20931', issuingAuthority: 'Golden State Mutual', issuedDaysAgo: 360, expiresInDays: 5, isVerified: true },
    ],
  },
  {
    email: 'dr.patel@clinova.health', password: 'Doctor@2026', firstName: 'Ananya', lastName: 'Patel', role: 'PHYSICIAN',
    title: 'Dr.', suffix: 'DO', phone: '(555) 010-0102', officeLocation: 'Clinic B, Room 112', npi: '1730594826',
    specialties: ['Family Medicine', 'Pediatrics'], schedule: weekly([2, 3, 4, 5, 6], '09:00', '18:00', ['12:30', '13:30']),
    bio: 'Family physician caring for patients of all ages, with special interest in preventive care and pediatrics.',
    credentials: [
      { type: 'MEDICAL_LICENSE', number: 'O-77412', issuingState: 'CA', issuingAuthority: 'Osteopathic Medical Board of California', issuedDaysAgo: 1400, expiresInDays: 62, isVerified: true },
      { type: 'DEA', number: 'BP7731025', issuingAuthority: 'U.S. Drug Enforcement Administration', issuedDaysAgo: 400, expiresInDays: 690, isVerified: true },
      { type: 'BOARD_CERTIFICATION', number: 'ABFM-118204', issuingAuthority: 'American Board of Family Medicine', issuedDaysAgo: 1800, expiresInDays: 1100, isVerified: true },
      { type: 'NPI', number: '1730594826', issuingAuthority: 'CMS NPPES', issuedDaysAgo: 3000, isVerified: true },
    ],
  },
  {
    email: 'nurse.kim@clinova.health', password: 'Nurse@2026', firstName: 'Ji-Yeon', lastName: 'Kim', role: 'NURSE',
    suffix: 'RN', phone: '(555) 010-0201', officeLocation: 'Clinic A, Nursing station', specialties: ['Triage', 'Chronic Care Management'],
    schedule: weekly([1, 2, 3, 4], '07:00', '17:30', ['11:30', '12:00']),
    bio: 'Registered nurse coordinating triage, vitals, and care-management follow-ups.',
    credentials: [
      { type: 'MEDICAL_LICENSE', number: 'RN-95120384', issuingState: 'CA', issuingAuthority: 'California Board of Registered Nursing', issuedDaysAgo: 600, expiresInDays: 130, isVerified: true },
      { type: 'BLS', number: 'BLS-AHA-662091', issuingAuthority: 'American Heart Association', issuedDaysAgo: 733, expiresInDays: -3, isVerified: true },
    ],
  },
  {
    email: 'reception@clinova.health', password: 'Staff@2026', firstName: 'Marcus', lastName: 'Grant', role: 'STAFF',
    phone: '(555) 010-0301', officeLocation: 'Front desk', schedule: weekly([1, 2, 3, 4, 5], '07:30', '16:30'),
    credentials: [
      { type: 'BLS', number: 'BLS-AHA-710442', issuingAuthority: 'American Heart Association', issuedDaysAgo: 650, expiresInDays: 80 },
    ],
  },
  {
    email: 'billing@clinova.health', password: 'Billing@2026', firstName: 'Bianca', lastName: 'Flores', role: 'BILLING',
    phone: '(555) 010-0401', officeLocation: 'Billing office, Suite 120', specialties: ['Medical Coding', 'Claims'], schedule: weekly([1, 2, 3, 4, 5]),
    credentials: [
      { type: 'OTHER', number: 'CPC-01984425', issuingAuthority: 'AAPC (Certified Professional Coder)', issuedDaysAgo: 500, expiresInDays: 230, isVerified: true },
    ],
  },
];
// ─── encounter templates & sample notes ────────────────────────────────────

const ENCOUNTER_TEMPLATES = [
  {
    name: 'Annual Physical',
    specialty: 'Primary Care',
    note: {
      subjective: {
        chiefComplaint: 'Annual wellness examination',
        historyOfPresentIllness: 'Presents for routine annual exam. Interval history:',
        reviewOfSystems: 'Constitutional: negative\nCardiovascular: negative\nRespiratory: negative\nGI: negative\nGU: negative\nMSK: negative\nNeuro: negative\nPsych: negative',
      },
      objective: {
        physicalExamFindings: 'General: well-appearing, no acute distress\nHEENT: normocephalic, PERRL, TMs clear\nNeck: supple, no lymphadenopathy\nLungs: clear to auscultation bilaterally\nHeart: regular rate and rhythm, no murmurs\nAbdomen: soft, non-tender\nExtremities: no edema\nSkin: no concerning lesions',
      },
      plan: {
        treatmentPlan: 'Age-appropriate screening reviewed. Immunizations updated as indicated.',
        followUpInstructions: 'Return in 12 months for annual exam, sooner as needed.',
      },
    },
  },
  {
    name: 'Follow-Up Visit',
    specialty: 'Primary Care',
    note: {
      subjective: {
        chiefComplaint: 'Follow-up',
        historyOfPresentIllness: 'Here for follow-up of ___. Since last visit:\nMedication adherence:\nSide effects:',
      },
      plan: { followUpInstructions: 'Return in 3 months or sooner if symptoms worsen.' },
    },
  },
  {
    name: 'Headache',
    specialty: 'Primary Care',
    note: {
      subjective: {
        chiefComplaint: 'Headache',
        historyOfPresentIllness: 'Onset:\nLocation:\nCharacter:\nSeverity (0-10):\nAssociated symptoms (nausea, photophobia, aura):\nRed flags (worst ever, thunderclap, fever, neuro deficits): denies',
      },
      objective: { physicalExamFindings: 'Neuro: alert and oriented, cranial nerves II-XII intact, strength 5/5 throughout, gait normal\nFundi: no papilledema' },
      plan: { patientInstructions: 'Headache diary, hydration, regular sleep. Seek urgent care for sudden severe headache, weakness, or vision change.' },
    },
  },
  {
    name: 'Upper Respiratory Infection',
    specialty: 'Primary Care',
    note: {
      subjective: {
        chiefComplaint: 'Cough and congestion',
        historyOfPresentIllness: 'Duration:\nFever:\nSore throat:\nSick contacts:',
      },
      objective: { physicalExamFindings: 'Pharynx: \nTMs: \nLungs: \nLymph: ' },
      plan: { patientInstructions: 'Supportive care: fluids, rest, saline rinses. Return if fever persists >3 days or breathing worsens.' },
    },
  },
  {
    name: 'Well-Child Visit',
    specialty: 'Pediatrics',
    note: {
      subjective: {
        chiefComplaint: 'Well-child check',
        historyOfPresentIllness: 'Diet:\nSleep:\nDevelopment/school:\nSafety (car seat, helmet, water):',
      },
      objective: { physicalExamFindings: 'Growth parameters reviewed on chart.\nGeneral: active, well-appearing' },
      plan: { treatmentPlan: 'Anticipatory guidance provided. Vaccines per schedule.' },
    },
  },
];

const SAMPLE_ENCOUNTERS = [
  {
    note: {
      subjective: {
        chiefComplaint: 'Diabetes management — establishing care',
        historyOfPresentIllness: 'Type 2 diabetes for 8 years. Home glucose 140-190 fasting. Reports good adherence to metformin. No hypoglycemia.',
        reviewOfSystems: 'Denies polyuria, chest pain, vision changes. Occasional foot tingling.',
      },
      objective: {
        physicalExamFindings: 'Well-appearing. Monofilament sensation diminished at both great toes. Pedal pulses 2+.',
        relevantResults: 'HbA1c 8.1% (last month).',
      },
      assessment: {
        diagnoses: [
          { code: { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' }, isPrimary: true, notes: null },
          { code: { code: 'I10', description: 'Essential (primary) hypertension' }, isPrimary: false, notes: null },
        ],
        clinicalReasoning: 'Suboptimal control; early peripheral neuropathy.',
      },
      plan: {
        treatmentPlan: 'Continue metformin. Dietitian referral. Annual eye exam.',
        patientInstructions: 'Daily foot checks; log fasting glucose.',
        followUpInstructions: 'Recheck HbA1c in 3 months.',
        ordersNotes: 'HbA1c, BMP, urine microalbumin.',
      },
    },
    vitals: [
      { type: 'BP_SYSTOLIC', value: 142, unit: 'mmHg' },
      { type: 'BP_DIASTOLIC', value: 88, unit: 'mmHg' },
      { type: 'HEART_RATE', value: 78, unit: 'bpm' },
      { type: 'TEMPERATURE', value: 98.4, unit: '°F' },
    ],
    prescriptions: [],
    addendum: null as string | null,
  },
  {
    note: {
      subjective: {
        chiefComplaint: 'Asthma follow-up',
        historyOfPresentIllness: 'Using rescue inhaler 2-3 times weekly. Night waking once a week. No ED visits.',
        reviewOfSystems: null,
      },
      objective: { physicalExamFindings: 'Lungs with scattered end-expiratory wheeze, good air movement.', relevantResults: null },
      assessment: {
        diagnoses: [{ code: { code: 'J45.909', description: 'Unspecified asthma, uncomplicated' }, isPrimary: true, notes: null }],
        clinicalReasoning: 'Not well controlled on current regimen.',
      },
      plan: {
        treatmentPlan: 'Step up to daily controller. Refill rescue inhaler.',
        patientInstructions: 'Asthma action plan reviewed. Avoid NSAIDs (allergy).',
        followUpInstructions: 'Return in 6 weeks.',
        ordersNotes: null,
      },
    },
    vitals: [
      { type: 'HEART_RATE', value: 84, unit: 'bpm' },
      { type: 'OXYGEN_SATURATION', value: 97, unit: '%' },
      { type: 'RESPIRATORY_RATE', value: 16, unit: '/min' },
    ],
    prescriptions: [
      {
        drug: { medicationName: 'Albuterol HFA', strength: '90 mcg/actuation', form: 'Inhaler', route: 'Inhalation', dosageAmount: '2 puffs', frequency: 'Every 4-6 hours as needed', durationDays: null },
        refills: 2,
        instructions: 'Use for shortness of breath or wheeze.',
      },
      {
        drug: { medicationName: 'Budesonide-Formoterol', strength: '160/4.5 mcg', form: 'Inhaler', route: 'Inhalation', dosageAmount: '2 puffs', frequency: 'Twice daily', durationDays: 30 },
        refills: 5,
        instructions: 'Rinse mouth after each use.',
      },
    ],
    addendum: null as string | null,
  },
  {
    note: {
      subjective: {
        chiefComplaint: 'Annual wellness examination',
        historyOfPresentIllness: 'Feels well. Migraines 1-2 per month, controlled with sumatriptan. Taking levothyroxine daily.',
        reviewOfSystems: 'Negative except as noted in HPI.',
      },
      objective: { physicalExamFindings: 'Normal exam. Thyroid non-enlarged, no nodules.', relevantResults: null },
      assessment: {
        diagnoses: [
          { code: { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings' }, isPrimary: true, notes: null },
          { code: { code: 'E03.9', description: 'Hypothyroidism, unspecified' }, isPrimary: false, notes: null },
        ],
        clinicalReasoning: null,
      },
      plan: {
        treatmentPlan: 'Continue current medications. Check TSH.',
        patientInstructions: null,
        followUpInstructions: 'Annual exam in 12 months.',
        ordersNotes: 'TSH, lipid panel, vitamin D.',
      },
    },
    vitals: [
      { type: 'BP_SYSTOLIC', value: 118, unit: 'mmHg' },
      { type: 'BP_DIASTOLIC', value: 74, unit: 'mmHg' },
      { type: 'HEART_RATE', value: 68, unit: 'bpm' },
      { type: 'TEMPERATURE', value: 98.2, unit: '°F' },
    ],
    prescriptions: [],
    addendum: 'TSH 2.1 mIU/L — within range. Continue levothyroxine 100 mcg.' as string | null,
  },
];

async function main() {
  console.log('🗑  Clearing existing data…');
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.insuranceClaim.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.feeSchedule.deleteMany({});
  await prisma.counter.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.encounter.deleteMany({});
  await prisma.encounterTemplate.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.appointmentType.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.staffNotification.deleteMany({});
  await prisma.notificationTemplate.deleteMany({});
  await prisma.threadMessage.deleteMany({});
  await prisma.messageThread.deleteMany({});
  await prisma.refillRequest.deleteMany({});
  await prisma.profileChangeRequest.deleteMany({});
  await prisma.savedPaymentMethod.deleteMany({});
  await prisma.patientAccount.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.staffCredential.deleteMany({});
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
    await prisma.staff.create({
      data: {
        email: u.email, passwordHash, firstName: u.firstName, lastName: u.lastName, role: u.role,
        title: u.title ?? null, suffix: u.suffix ?? null, phone: u.phone ?? null, officeLocation: u.officeLocation ?? null,
        npi: u.npi ?? null, specialtiesJson: JSON.stringify(u.specialties ?? []), bio: u.bio ?? null,
        scheduleJson: u.schedule ?? weekly([1, 2, 3, 4, 5]),
        credentials: {
          create: (u.credentials ?? []).map(c => ({
            type: c.type, number: c.number, issuingState: c.issuingState ?? null, issuingAuthority: c.issuingAuthority ?? null,
            issueDate: c.issuedDaysAgo !== undefined ? inDays(-c.issuedDaysAgo) : null,
            expirationDate: c.expiresInDays !== undefined ? inDays(c.expiresInDays) : null,
            isVerified: c.isVerified ?? false,
          })),
        },
      },
    });    console.log(`  ✓ [${u.role.padEnd(9)}]  ${u.firstName} ${u.lastName}  <${u.email}>  pw: ${u.password}`);
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

  // Appointments are placed relative to today so the calendar always has current data.
  function slot(dayOffset: number, startHour: number, startMin: number, durationMin: number) {
    const start = new Date();
    start.setDate(start.getDate() + dayOffset);
    start.setHours(startHour, startMin, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60_000);
    return { slotStart: start, slotEnd: end };
  }

  const at = (dayOffset: number, hour: number, min: number) => slot(dayOffset, hour, min, 0).slotStart;

  const sampleAppointments = [
    // Earlier this week — completed visits with signed notes
    { patientId: allPatients[0].id, providerId: chen.id,  appointmentTypeId: typeMap['New Patient Visit'],  ...slot(-3, 9,  0, 45), status: 'COMPLETED',  checkedInAt: at(-3, 8, 50), completedAt: at(-3, 10, 0),  reasonForVisit: 'Initial consultation for diabetes management' },
    { patientId: allPatients[1].id, providerId: patel.id, appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot(-3, 9,  0, 15), status: 'COMPLETED',  checkedInAt: at(-3, 8, 55), completedAt: at(-3, 9, 20),  reasonForVisit: 'Asthma follow-up' },
    { patientId: allPatients[2].id, providerId: chen.id,  appointmentTypeId: typeMap['Annual Physical'],    ...slot(-1, 10, 0, 60), status: 'COMPLETED',  checkedInAt: at(-1, 9, 50), completedAt: at(-1, 11, 10), reasonForVisit: 'Annual wellness exam' },

    // Today
    { patientId: allPatients[3].id, providerId: chen.id,  appointmentTypeId: typeMap['New Patient Visit'],  ...slot(0, 9,  0, 45), status: 'CHECKED_IN', checkedInAt: at(0, 8, 55), reasonForVisit: 'Evaluation of heart failure symptoms' },
    { patientId: allPatients[4].id, providerId: chen.id,  appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot(0, 10, 0, 15), status: 'CONFIRMED',  reasonForVisit: 'Post-surgery knee check' },
    { patientId: allPatients[5].id, providerId: patel.id, appointmentTypeId: typeMap['Urgent Care'],        ...slot(0, 10, 0, 30), status: 'SCHEDULED',  reasonForVisit: 'Acute asthma exacerbation' },
    { patientId: allPatients[6].id, providerId: patel.id, appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot(0, 14, 0, 15), status: 'CHECKED_IN', checkedInAt: at(0, 13, 50), reasonForVisit: 'Migraine follow-up' },

    // Upcoming
    { patientId: allPatients[7].id, providerId: chen.id,  appointmentTypeId: typeMap['Annual Physical'],    ...slot(1, 9,  0, 60), status: 'CONFIRMED',  reasonForVisit: 'Annual physical' },
    { patientId: allPatients[0].id, providerId: patel.id, appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot(1, 10, 0, 15), status: 'SCHEDULED',  reasonForVisit: 'Review lab results' },
    { patientId: allPatients[1].id, providerId: patel.id, appointmentTypeId: typeMap['Annual Physical'],    ...slot(2, 9,  0, 60), status: 'SCHEDULED',  reasonForVisit: 'Annual wellness exam' },
    { patientId: allPatients[2].id, providerId: chen.id,  appointmentTypeId: typeMap['Follow-Up Visit'],    ...slot(2, 10, 0, 15), status: 'SCHEDULED',  reasonForVisit: 'Hypothyroidism medication review' },
    { patientId: allPatients[3].id, providerId: chen.id,  appointmentTypeId: typeMap['Urgent Care'],        ...slot(3, 9,  0, 30), status: 'SCHEDULED',  reasonForVisit: 'Urgent: chest tightness' },
    { patientId: allPatients[4].id, providerId: patel.id, appointmentTypeId: typeMap['Procedure'],          ...slot(3, 11, 0, 90), status: 'SCHEDULED',  reasonForVisit: 'Minor procedure — wound care' },
  ];

  const createdAppointments = [];
  for (const appt of sampleAppointments) {
    const row = await prisma.appointment.create({ data: appt as any });
    createdAppointments.push(row);
    console.log(
      `  ✓ [${row.status.padEnd(10)}]  ${row.slotStart.toISOString().slice(0, 16)}  patient:${row.patientId.slice(-6)}  provider:${row.providerId.slice(-6)}`,
    );
  }
  console.log(`\n✅ Seeded ${sampleAppointments.length} appointments.`);

  // ─── encounter templates ─────────────────────────────────────────────────
  console.log('\n🧩 Seeding encounter templates…\n');
  for (const t of ENCOUNTER_TEMPLATES) {
    await prisma.encounterTemplate.create({
      data: { name: t.name, specialty: t.specialty, defaultNoteJson: JSON.stringify(t.note), createdBy: chen.id },
    });
    console.log(`  ✓ ${t.name}`);
  }

  // ─── signed encounters for completed visits ──────────────────────────────
  console.log('\n🩺 Seeding clinical encounters…\n');
  const completed = createdAppointments.filter(a => a.status === 'COMPLETED');
  for (const [i, appt] of completed.entries()) {
    const sample = SAMPLE_ENCOUNTERS[i];
    const signedAt = appt.completedAt ?? new Date();
    const enc = await prisma.encounter.create({
      data: {
        patientId: appt.patientId,
        providerId: appt.providerId,
        appointmentId: appt.id,
        status: sample.addendum ? 'AMENDED' : 'SIGNED',
        noteJson: JSON.stringify(sample.note),
        vitalsJson: JSON.stringify(sample.vitals.map(v => ({ ...v, recordedAt: appt.checkedInAt, recordedBy: appt.providerId }))),
        addendaJson: JSON.stringify(sample.addendum
          ? [{ addedBy: appt.providerId, addedAt: new Date(signedAt.getTime() + 86_400_000).toISOString(), content: sample.addendum }]
          : []),
        signedBy: appt.providerId,
        signedAt,
        createdAt: appt.checkedInAt ?? signedAt,
      },
    });
    for (const rx of sample.prescriptions) {
      await prisma.prescription.create({
        data: {
          encounterId: enc.id,
          patientId: appt.patientId,
          prescriberId: appt.providerId,
          drugJson: JSON.stringify(rx.drug),
          refillsAllowed: rx.refills,
          refillsRemaining: rx.refills,
          instructions: rx.instructions,
          issuedAt: signedAt,
        },
      });
    }
    console.log(`  ✓ [${enc.status}]  ${sample.note.subjective.chiefComplaint}`);
  }
  console.log(`\n✅ Seeded ${ENCOUNTER_TEMPLATES.length} templates and ${completed.length} encounters.`);

  // ─── visit history (dashboard KPIs, weekly volume, no-show rate) ─────────
  console.log('\n🗂  Seeding visit history…\n');
  let historyCount = 0;
  for (const h of HISTORY_VISITS) {
    const provider = h.provider === 'chen' ? chen : patel;
    const { slotStart, slotEnd } = slot(h.day, h.hour, 0, 30);
    const checkedInAt = new Date(slotStart.getTime() - 5 * 60_000);
    const appt = await prisma.appointment.create({
      data: {
        patientId: allPatients[h.patient].id,
        providerId: provider.id,
        appointmentTypeId: typeMap[h.type],
        slotStart,
        slotEnd,
        status: h.status,
        reasonForVisit: h.chiefComplaint,
        ...(h.status === 'COMPLETED' || h.status === 'IN_PROGRESS' ? { checkedInAt } : {}),
        ...(h.status === 'COMPLETED' ? { completedAt: slotEnd } : {}),
        ...(h.status === 'CANCELLED' ? { cancellationReason: 'PATIENT_REQUEST' } : {}),
      },
    });
    if (h.diagnosis) {
      const signed = h.status === 'COMPLETED';
      await prisma.encounter.create({
        data: {
          patientId: appt.patientId,
          providerId: provider.id,
          appointmentId: appt.id,
          status: signed ? 'SIGNED' : 'IN_PROGRESS',
          noteJson: JSON.stringify({
            subjective: { chiefComplaint: h.chiefComplaint, historyOfPresentIllness: 'Stable since last visit.', reviewOfSystems: null },
            objective: { physicalExamFindings: 'No acute distress.', relevantResults: null },
            assessment: {
              diagnoses: signed ? [{ code: h.diagnosis, isPrimary: true, notes: null }] : [],
              clinicalReasoning: null,
            },
            plan: { treatmentPlan: signed ? 'Continue current management.' : '', patientInstructions: null, followUpInstructions: null, ordersNotes: null },
          }),
          signedBy: signed ? provider.id : null,
          signedAt: signed ? slotEnd : null,
          createdAt: checkedInAt,
        },
      });
    }
    historyCount++;
  }

  // A patient who did not show up this morning.
  await prisma.appointment.create({
    data: {
      patientId: allPatients[2].id, providerId: patel.id, appointmentTypeId: typeMap['Follow-Up Visit'],
      ...slot(0, 8, 0, 15), status: 'NO_SHOW', reasonForVisit: 'Medication review',
    },
  });
  console.log(`✅ Seeded ${historyCount + 1} historical visits (incl. today's no-show and an overdue unsigned note).`);

  await seedBilling(chen.id, patel.id);
  await seedPortal();
  await seedNotifications();
}

const ICD = (code: string, description: string) => ({ code, description });

/** Past visits relative to today: completed with signed notes, plus no-shows, a cancellation, and one stale unsigned note. */
const HISTORY_VISITS: Array<{
  day: number; hour: number; patient: number; provider: 'chen' | 'patel'; type: string;
  status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'IN_PROGRESS';
  chiefComplaint: string; diagnosis: { code: string; description: string } | null;
}> = [
  { day: -2,  hour: 15, patient: 5, provider: 'chen',  type: 'Follow-Up Visit', status: 'IN_PROGRESS', chiefComplaint: 'COPD follow-up', diagnosis: ICD('J44.9', 'Chronic obstructive pulmonary disease, unspecified') },
  { day: -4,  hour: 9,  patient: 5, provider: 'chen',  type: 'Follow-Up Visit', status: 'COMPLETED', chiefComplaint: 'Blood pressure check', diagnosis: ICD('I10', 'Essential (primary) hypertension') },
  { day: -5,  hour: 10, patient: 6, provider: 'patel', type: 'Follow-Up Visit', status: 'COMPLETED', chiefComplaint: 'Migraine follow-up', diagnosis: ICD('G43.909', 'Migraine, unspecified, not intractable, without status migrainosus') },
  { day: -6,  hour: 11, patient: 7, provider: 'chen',  type: 'Follow-Up Visit', status: 'COMPLETED', chiefComplaint: 'Knee pain', diagnosis: ICD('M25.561', 'Pain in right knee') },
  { day: -8,  hour: 9,  patient: 0, provider: 'patel', type: 'Follow-Up Visit', status: 'COMPLETED', chiefComplaint: 'Diabetes follow-up', diagnosis: ICD('E11.9', 'Type 2 diabetes mellitus without complications') },
  { day: -9,  hour: 10, patient: 6, provider: 'patel', type: 'Follow-Up Visit', status: 'NO_SHOW',   chiefComplaint: 'Medication check', diagnosis: null },
  { day: -11, hour: 14, patient: 1, provider: 'chen',  type: 'Urgent Care',     status: 'COMPLETED', chiefComplaint: 'Seasonal allergies', diagnosis: ICD('J30.9', 'Allergic rhinitis, unspecified') },
  { day: -12, hour: 9,  patient: 5, provider: 'chen',  type: 'Follow-Up Visit', status: 'CANCELLED', chiefComplaint: 'Routine follow-up', diagnosis: null },
  { day: -15, hour: 10, patient: 2, provider: 'patel', type: 'Follow-Up Visit', status: 'COMPLETED', chiefComplaint: 'Thyroid follow-up', diagnosis: ICD('E03.9', 'Hypothyroidism, unspecified') },
  { day: -19, hour: 9,  patient: 3, provider: 'chen',  type: 'Follow-Up Visit', status: 'COMPLETED', chiefComplaint: 'Heart failure follow-up', diagnosis: ICD('I50.9', 'Heart failure, unspecified') },
  { day: -24, hour: 11, patient: 4, provider: 'patel', type: 'Follow-Up Visit', status: 'COMPLETED', chiefComplaint: 'Asthma check', diagnosis: ICD('J45.909', 'Unspecified asthma, uncomplicated') },
];

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// --- billing ---------------------------------------------------------------

async function seedBilling(chenId: string, patelId: string) {
  console.log('\n?? Seeding billing�\n');
  const DAY = 86_400_000;
  const now = Date.now();
  const billingUser = await prisma.staff.findUniqueOrThrow({ where: { email: 'billing@clinova.health' } });
  const frontDesk = await prisma.staff.findUniqueOrThrow({ where: { email: 'reception@clinova.health' } });

  await prisma.feeSchedule.create({
    data: {
      name: 'Standard 2026', description: 'Practice default fee schedule', isDefault: true,
      effectiveDate: new Date('2026-01-01'), linesJson: JSON.stringify(FEE_SCHEDULE_LINES),
    },
  });
  await prisma.feeSchedule.create({
    data: {
      name: 'Self-pay discount', description: '30% prompt-pay discount for uninsured patients',
      effectiveDate: new Date('2026-01-01'),
      linesJson: JSON.stringify(FEE_SCHEDULE_LINES.map(l => ({ ...l, priceCents: Math.round((l.priceCents * 0.7) / 100) * 100 }))),
    },
  });
  const fee = (code: string) => {
    const line = FEE_SCHEDULE_LINES.find(l => l.cptCode === code);
    if (!line) throw new Error(`Fee schedule is missing ${code}`);
    return line;
  };

  type Visit = { patientId: string; providerId: string; encounterId: string | null; serviceDate: Date; codes: string[] };
  const visits: Visit[] = [];

  // Signed encounters bill their appointment type's default code.
  const signed = await prisma.encounter.findMany({ where: { status: { in: ['SIGNED', 'AMENDED'] }, appointmentId: { not: null } } });
  for (const enc of signed) {
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: enc.appointmentId as string }, include: { appointmentType: true } });
    visits.push({
      patientId: enc.patientId, providerId: enc.providerId, encounterId: enc.id, serviceDate: appt.slotStart,
      codes: [appt.appointmentType.defaultServiceCode ?? '99213'],
    });
  }

  // Five months of earlier visits (billing history only) for revenue trend and aging.
  const patients = await prisma.patient.findMany({ take: 12, orderBy: { createdAt: 'asc' }, select: { id: true } });
  const CODE_SETS = [['99213'], ['99214', '36415', '85025'], ['99396'], ['99212'], ['99213', '93000']];
  for (let m = 1; m <= 5; m++) {
    const visitsThisMonth = 4 + ((m * 7) % 4);
    for (let k = 0; k < visitsThisMonth; k++) {
      visits.push({
        patientId: patients[(m * 5 + k) % patients.length].id,
        providerId: (m + k) % 2 ? chenId : patelId,
        encounterId: null,
        serviceDate: new Date(now - (m * 30 + k * 4 + 2) * DAY),
        codes: CODE_SETS[(m * 3 + k) % CODE_SETS.length],
      });
    }
  }
  visits.sort((a, b) => a.serviceDate.getTime() - b.serviceDate.getTime());

  const policiesByPatient = new Map(
    (await prisma.patient.findMany({ select: { id: true, insurancePoliciesJson: true } }))
      .map(p => [p.id, JSON.parse(p.insurancePoliciesJson) as Array<{ id: string; isPrimary: boolean; provider: string; policyNumber: string; copayAmountCents: number | null }>]),
  );

  let seq = 0;
  let paymentRef = 4000;
  const balances = new Map<string, number>();

  async function pay(patientId: string, invoiceId: string, amountCents: number, at: Date, method: string, processedBy: string, reference?: string) {
    if (amountCents <= 0) return;
    await prisma.payment.create({
      data: {
        patientId, amountCents, method, processedBy, processedAt: at,
        referenceNumber: reference ?? (method === 'CREDIT_CARD' || method === 'DEBIT_CARD' ? `AUTH-${++paymentRef}` : null),
        checkNumber: method === 'CHECK' ? String(1000 + ++paymentRef) : null,
        allocations: { create: [{ invoiceId, amountCents }] },
      },
    });
    balances.set(invoiceId, (balances.get(invoiceId) ?? 0) - amountCents);
  }

  for (const [i, v] of visits.entries()) {
    const ageDays = (now - v.serviceDate.getTime()) / DAY;
    const lines = v.codes.map(code => {
      const f = fee(code);
      return { id: randomUUID(), serviceCode: code, description: f.description, quantity: 1, unitPriceCents: f.priceCents, totalCents: f.priceCents, notes: null };
    });
    const subtotal = lines.reduce((s, l) => s + l.totalCents, 0);
    const isDraft = ageDays < 2 && v.encounterId !== null;
    const issuedAt = isDraft ? null : new Date(Math.min(v.serviceDate.getTime() + DAY, now - 3_600_000));
    const adjustments: unknown[] = [];

    const invoice = await prisma.invoice.create({
      data: {
        number: `INV-${String(++seq).padStart(6, '0')}`,
        patientId: v.patientId, providerId: v.providerId, encounterId: v.encounterId,
        serviceDate: v.serviceDate, issuedAt, dueDate: issuedAt ? new Date(issuedAt.getTime() + 30 * DAY) : null,
        linesJson: JSON.stringify(lines),
      },
    });
    balances.set(invoice.id, subtotal);
    if (!issuedAt) continue;

    const primary = (policiesByPatient.get(v.patientId) ?? []).find(p => p.isPrimary);
    const copay = primary?.copayAmountCents ?? 0;

    if (primary) {
      const status = ageDays > 40 ? (i % 7 === 3 ? 'DENIED' : 'PAID') : ageDays > 20 ? 'PENDING' : ageDays > 7 ? 'SUBMITTED' : 'DRAFT';
      const submittedAt = status === 'DRAFT' ? null : new Date(issuedAt.getTime() + 2 * DAY);
      let paymentId: string | null = null;
      let paidAmountCents: number | null = null;

      if (copay > 0) await pay(v.patientId, invoice.id, Math.min(copay, subtotal), v.serviceDate, i % 2 ? 'CREDIT_CARD' : 'CASH', frontDesk.id);

      if (status === 'PAID') {
        const remaining = balances.get(invoice.id) ?? 0;
        paidAmountCents = Math.round(remaining * 0.7);
        const paidAt = new Date(issuedAt.getTime() + 24 * DAY);
        const p = await prisma.payment.create({
          data: {
            patientId: v.patientId, amountCents: paidAmountCents, method: 'INSURANCE', referenceNumber: primary.provider,
            processedBy: billingUser.id, processedAt: paidAt,
            allocations: { create: [{ invoiceId: invoice.id, amountCents: paidAmountCents }] },
          },
        });
        paymentId = p.id;
        balances.set(invoice.id, remaining - paidAmountCents);
        const writeDown = Math.round(remaining * 0.15);
        adjustments.push({
          id: randomUUID(), type: 'INSURANCE_CONTRACTUAL', amountCents: writeDown, reason: `${primary.provider} contractual adjustment`,
          appliedBy: billingUser.id, appliedAt: paidAt.toISOString(),
        });
        balances.set(invoice.id, (balances.get(invoice.id) ?? 0) - writeDown);
        // Most patients settle the remainder; a few are left overdue.
        if (i % 5 !== 0) await pay(v.patientId, invoice.id, balances.get(invoice.id) ?? 0, new Date(paidAt.getTime() + 10 * DAY), i % 3 ? 'CREDIT_CARD' : 'CHECK', billingUser.id);
      }

      await prisma.insuranceClaim.create({
        data: {
          invoiceId: invoice.id, patientId: v.patientId, insurancePolicyId: primary.id, payerName: primary.provider,
          policyNumber: primary.policyNumber, billedCents: subtotal, status, submittedAt, paymentId, paidAmountCents,
          paidAt: status === 'PAID' ? new Date(issuedAt.getTime() + 24 * DAY) : null,
          denialReason: status === 'DENIED' ? 'Missing prior authorization' : null,
        },
      });
    } else if (ageDays > 40) {
      // Self-pay: usually paid in full; occasionally left unpaid (ages into 90+).
      if (i % 4 !== 0) await pay(v.patientId, invoice.id, subtotal, new Date(issuedAt.getTime() + 7 * DAY), 'DEBIT_CARD', frontDesk.id);
    } else if (i % 2 === 0) {
      await pay(v.patientId, invoice.id, Math.round(subtotal / 2), v.serviceDate, 'CREDIT_CARD', frontDesk.id);
    }

    if (adjustments.length) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { adjustmentsJson: JSON.stringify(adjustments) } });
    }
  }

  // A couple of balance payments taken at the front desk today.
  const open = [...balances.entries()].filter(([, b]) => b > 0).slice(0, 2);
  for (const [j, [invoiceId, balance]] of open.entries()) {
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (!inv.issuedAt) continue;
    await pay(inv.patientId, invoiceId, Math.min(balance, 5000), new Date(now - (j + 1) * 45 * 60_000), j ? 'CASH' : 'CREDIT_CARD', frontDesk.id);
  }

  await prisma.counter.upsert({ where: { name: 'invoice' }, create: { name: 'invoice', value: seq }, update: { value: seq } });
  const claimCount = await prisma.insuranceClaim.count();
  const paymentCount = await prisma.payment.count();
  console.log(`? Seeded 2 fee schedules, ${seq} invoices, ${paymentCount} payments, ${claimCount} claims.`);
}

// --- patient portal ----------------------------------------------------------

const PORTAL_PASSWORD = 'Portal@Patient2026';
const STORAGE_DIR = process.env['FILE_STORAGE_DIR'] ?? join(process.cwd(), 'storage');
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** A small single-page PDF with text lines (enough for demo lab reports). */
function textPdf(lines: string[]): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, m => `\\${m}`);
  const content = ['BT', '/F1 18 Tf', '56 760 Td', `(${esc(lines[0])}) Tj`, '/F1 11 Tf',
    ...lines.slice(1).flatMap(l => ['0 -20 Td', `(${esc(l)}) Tj`]), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function seedPortal() {
  console.log('\n🌐 Seeding patient portal…\n');
  const DAY = 86_400_000;
  const ago = (days: number, hour = 10) => { const d = new Date(Date.now() - days * DAY); d.setHours(hour, 0, 0, 0); return d; };
  const byName = (firstName: string, lastName: string) => prisma.patient.findFirstOrThrow({ where: { firstName, lastName } });
  const james = await byName('James', 'Okafor');
  const thomas = await byName('Thomas', 'Brennan');
  const diane = await byName('Diane', 'Fletcher');
  const nurse = await prisma.staff.findUniqueOrThrow({ where: { email: 'nurse.kim@clinova.health' } });
  const desk = await prisma.staff.findUniqueOrThrow({ where: { email: 'reception@clinova.health' } });
  const email = (p: { contactJson: string }) => (JSON.parse(p.contactJson).email as string).toLowerCase();
  const passwordHash = await bcrypt.hash(PORTAL_PASSWORD, 10);

  // Accounts: two active, one invited (code FLETCH26), the rest can self-register.
  for (const [p, days] of [[james, 3], [thomas, 12]] as const) {
    await prisma.patientAccount.create({
      data: { patientId: p.id, email: email(p), passwordHash, status: 'ACTIVE', activatedAt: ago(60), lastLoginAt: ago(days, 19) },
    });
    console.log(`  ✓ [ACTIVE ]  ${p.firstName} ${p.lastName}  <${email(p)}>  pw: ${PORTAL_PASSWORD}`);
  }
  await prisma.patientAccount.create({
    data: { patientId: diane.id, email: email(diane), status: 'INVITED', inviteCodeHash: sha256('FLETCH26'), inviteExpiresAt: new Date(Date.now() + 14 * DAY), invitedBy: desk.id },
  });
  console.log(`  ✓ [INVITED]  Diane Fletcher  <${email(diane)}>  invite code: FLET-CH26`);

  await prisma.savedPaymentMethod.create({
    data: { patientId: james.id, brand: 'Visa', last4: '4242', expMonth: 12, expYear: new Date().getFullYear() + 2, cardholderName: 'James Okafor', gatewayToken: `tok_sim_seed_${randomUUID().slice(0, 8)}`, isDefault: true },
  });

  // Documents with real files: a released result, a result awaiting release, a shared care plan.
  rmSync(join(STORAGE_DIR, 'patients', james.id), { recursive: true, force: true });
  const docs = [
    { name: 'Hemoglobin A1c - result.pdf', category: 'LAB_REPORT', days: 6, shared: true, by: 'Dr. Ananya Patel, DO',
      note: 'Your A1c has improved to 7.4% (from 8.1%). Great progress - keep taking metformin as prescribed. We will recheck in 3 months.',
      lines: ['Clinova Health - Laboratory Report', `Patient: James Okafor   MRN: ${james.mrn}`, 'Test: Hemoglobin A1c', 'Result: 7.4 %   (reference < 5.7 %)', 'Previous: 8.1 %', 'Ordering provider: Dr. Ananya Patel, DO'] },
    { name: 'Basic metabolic panel - result.pdf', category: 'LAB_REPORT', days: 1, shared: false, by: null, note: null,
      lines: ['Clinova Health - Laboratory Report', `Patient: James Okafor   MRN: ${james.mrn}`, 'Test: Basic metabolic panel', 'Glucose: 132 mg/dL (H)   Creatinine: 1.1 mg/dL', 'Sodium: 139 mmol/L   Potassium: 4.3 mmol/L'] },
    { name: 'Diabetes care plan.pdf', category: 'OTHER', days: 8, shared: true, by: 'Ji-Yeon Kim, RN', note: null,
      lines: ['Your diabetes care plan', 'Check blood sugar each morning before breakfast.', 'Take metformin 1000 mg with breakfast and dinner.', 'Walk 30 minutes, 5 days a week.', 'Daily foot check; call us about any sores.'] },
  ];
  const documents = docs.map(d => {
    const id = randomUUID();
    const storageKey = `patients/${james.id}/${id}-${d.name.replace(/[^\w.-]+/g, '_')}`;
    const data = textPdf(d.lines);
    mkdirSync(dirname(join(STORAGE_DIR, storageKey)), { recursive: true });
    writeFileSync(join(STORAGE_DIR, storageKey), data);
    return {
      id, patientId: james.id, category: d.category, name: d.name, storageKey, mimeType: 'application/pdf', sizeBytes: data.length,
      uploadedBy: 'Ji-Yeon Kim', uploadedAt: ago(d.days + 1).toISOString(),
      sharedWithPatient: d.shared, sharedAt: d.shared ? ago(d.days).toISOString() : null, sharedByName: d.by, releaseNote: d.note, patientViewedAt: null,
    };
  });
  await prisma.patient.update({ where: { id: james.id }, data: { documentsJson: JSON.stringify(documents) } });
  console.log(`  ✓ ${documents.length} documents for James Okafor (1 result awaiting release)`);

  // A prescription James can request a refill for.
  let rx = await prisma.prescription.findFirst({ where: { patientId: james.id, status: 'ACTIVE' } });
  if (!rx) {
    const enc = await prisma.encounter.findFirst({ where: { patientId: james.id, status: { in: ['SIGNED', 'AMENDED'] } }, orderBy: { createdAt: 'desc' } });
    if (enc) {
      rx = await prisma.prescription.create({
        data: {
          encounterId: enc.id, patientId: james.id, prescriberId: enc.providerId, refillsAllowed: 3, refillsRemaining: 2, issuedAt: enc.createdAt,
          instructions: 'Take with meals.',
          drugJson: JSON.stringify({ medicationName: 'Metformin', strength: '1000 mg', form: 'tablet', route: 'oral', dosageAmount: '1 tablet', frequency: 'twice daily', durationDays: 90 }),
        },
      });
    }
  }

  // Conversations: one answered (unread by James), one waiting for the care team.
  await prisma.messageThread.create({
    data: {
      patientId: james.id, subject: 'Metformin and an upset stomach', category: 'PRESCRIPTION', lastMessageAt: ago(2, 11), patientLastReadAt: ago(3, 9), staffLastReadAt: ago(2, 11),
      messages: { create: [
        { authorType: 'PATIENT', authorId: james.id, authorName: 'James Okafor', body: 'Since my dose went up I get an upset stomach in the mornings. Is that normal? Should I take it differently?', createdAt: ago(3, 9) },
        { authorType: 'STAFF', authorId: nurse.id, authorName: 'Ji-Yeon Kim, RN', body: 'Hi James - that is a common side effect and usually settles in a couple of weeks. Taking it in the middle of a meal helps. If it continues past two weeks, let us know and Dr. Patel can switch you to the extended-release version.', createdAt: ago(2, 11) },
      ] },
    },
  });
  await prisma.messageThread.create({
    data: {
      patientId: thomas.id, subject: 'Question about my last bill', category: 'BILLING', lastMessageAt: ago(0, 8), patientLastReadAt: ago(0, 8),
      messages: { create: [
        { authorType: 'PATIENT', authorId: thomas.id, authorName: 'Thomas Brennan', body: 'Hi, my insurance should have covered my last visit. Could you check whether the claim was submitted? Thanks.', createdAt: ago(0, 8) },
      ] },
    },
  });

  if (rx) {
    await prisma.refillRequest.create({
      data: { patientId: james.id, prescriptionId: rx.id, pharmacy: 'Walgreens - 2200 Westheimer Rd, Houston', note: 'Running low - about 5 days left.', createdAt: ago(0, 7) },
    });
  }

  const thomasContact = JSON.parse(thomas.contactJson);
  await prisma.profileChangeRequest.create({
    data: {
      patientId: thomas.id,
      createdAt: ago(1, 16),
      changesJson: JSON.stringify({
        contact: { old: thomasContact, new: { ...thomasContact, primaryPhone: '617-555-0699', mailingAddress: { ...thomasContact.mailingAddress, street1: '18 Harbor View Dr', postalCode: '02127' } } },
      }),
    },
  });
  console.log(`  ✓ 2 conversations, ${rx ? 1 : 0} refill request, 1 profile update for staff review`);
}
// --- notifications -------------------------------------------------------------

/** A short history of delivered notices plus staff alerts; the worker queues upcoming reminders itself. */
async function seedNotifications() {
  console.log('\n🔔 Seeding notification history…\n');
  const DAY = 86_400_000;
  const ago = (days: number, hour = 10) => { const d = new Date(Date.now() - days * DAY); d.setHours(hour, 0, 0, 0); return d; };
  const find = (firstName: string, lastName: string) => prisma.patient.findFirstOrThrow({ where: { firstName, lastName }, include: { portalAccount: true } });
  const james = await find('James', 'Okafor');
  const thomas = await find('Thomas', 'Brennan');
  const ruth = await find('Ruth', 'Abernathy');
  const footer = '\n\nClinova Health · (555) 010-0100';
  let n = 0;
  const note = async (d: {
    patient: { id: string; contactJson: string; portalAccount?: { id: string } | null }; type: string; channel: 'EMAIL' | 'SMS' | 'PORTAL';
    at: Date; subject: string | null; body: string; status?: string; reason?: string; error?: string; link?: string; read?: boolean;
    relatedType?: string; relatedId?: string;
  }) => {
    const contact = JSON.parse(d.patient.contactJson) as { email?: string | null; primaryPhone?: string };
    const status = d.status ?? 'SENT';
    await prisma.notification.create({
      data: {
        type: d.type, channel: d.channel, patientId: d.patient.id, subject: d.subject, body: d.body, status,
        recipient: d.channel === 'PORTAL' ? d.patient.portalAccount?.id ?? null : d.channel === 'EMAIL' ? contact.email ?? null : contact.primaryPhone ?? null,
        statusReason: d.reason ?? null, lastError: d.error ?? null, attempts: status === 'FAILED' ? 5 : status === 'SENT' && d.channel !== 'PORTAL' ? 1 : 0,
        provider: status === 'SENT' ? (d.channel === 'PORTAL' ? 'portal' : 'dev-outbox') : status === 'FAILED' ? 'dev-outbox' : null,
        scheduledFor: d.at, sentAt: status === 'SENT' ? d.at : null, createdAt: d.at, link: d.link ?? null,
        readAt: d.read ? d.at : null, relatedType: d.relatedType ?? null, relatedId: d.relatedId ?? null,
        dedupeKey: `seed:${n++}:${d.type}:${d.channel}`,
      },
    });
  };

  // James: portal + email history matching his seeded portal data.
  await note({ patient: james, type: 'DOCUMENT_AVAILABLE', channel: 'PORTAL', at: ago(8), subject: 'New document: Diabetes care plan.pdf', body: 'The office shared a document with you.', link: '/records?tab=documents' });
  await note({ patient: james, type: 'DOCUMENT_AVAILABLE', channel: 'EMAIL', at: ago(8), subject: 'A new document is in your patient portal', body: `Hi James,\n\nThe office shared a new document with you. Sign in to view it securely: http://localhost:4300${footer}` });
  await note({ patient: james, type: 'RESULTS_READY', channel: 'PORTAL', at: ago(6), subject: 'New result: Hemoglobin A1c - result.pdf', body: 'Dr. Ananya Patel, DO reviewed and released your result.', link: '/records?tab=documents', read: true });
  await note({ patient: james, type: 'RESULTS_READY', channel: 'EMAIL', at: ago(6), subject: 'Your test results are ready', body: `Hi James,\n\nYour doctor has reviewed and released a test result. Sign in to the patient portal to see it: http://localhost:4300${footer}` });
  await note({ patient: james, type: 'MESSAGE_RECEIVED', channel: 'PORTAL', at: ago(2, 11), subject: 'New reply: Metformin and an upset stomach', body: 'Your care team replied to your message.', link: '/messages' });
  await note({ patient: james, type: 'MESSAGE_RECEIVED', channel: 'EMAIL', at: ago(2, 11), subject: 'You have a new message from Clinova Health', body: `Hi James,\n\nYour care team replied to your message. Sign in to read it securely: http://localhost:4300${footer}` });

  // Delivery problems staff can see and act on.
  await note({ patient: thomas, type: 'APPOINTMENT_CONFIRMATION', channel: 'SMS', at: ago(1, 15), status: 'FAILED', error: "Twilio 400: The 'To' number is not a valid phone number.",
    subject: null, body: "Clinova Health: You're booked with Dr. Ananya Patel, DO. Reply STOP to opt out." });
  await note({ patient: ruth, type: 'APPOINTMENT_CONFIRMATION', channel: 'EMAIL', at: ago(1, 9), status: 'SUPPRESSED', reason: 'No email address on file',
    subject: 'Your appointment is confirmed', body: 'Hi Ruth,\n\nYou are booked with Dr. Wei Chen, MD.' });

  // Staff in-app alerts for the seeded portal activity.
  const staff = await prisma.staff.findMany({ where: { isActive: true } });
  const by = (role: string) => staff.filter(s => s.role === role).map(s => s.id);
  const rx = await prisma.prescription.findFirst({ where: { patientId: james.id, status: 'ACTIVE' } });
  const alerts = [
    ...[...by('STAFF'), ...by('ADMIN')].map(userId => ({ userId, kind: 'PROFILE_UPDATE', title: 'Profile update from Thomas Brennan', body: 'Review contact or insurance changes submitted in the portal.', link: '/messages?tab=updates', createdAt: ago(1, 16) })),
    ...by('ADMIN').concat(by('BILLING')).map(userId => ({ userId, kind: 'PATIENT_MESSAGE', title: 'Message from Thomas Brennan', body: 'Question about my last bill', link: '/messages', createdAt: ago(0, 8) })),
    ...(rx ? [{ userId: rx.prescriberId, kind: 'REFILL_REQUEST', title: 'Refill request from James Okafor', body: 'Metformin 1000 mg', link: '/messages?tab=refills', createdAt: ago(0, 7) }] : []),
  ];
  await prisma.staffNotification.createMany({ data: alerts });
  console.log(`  ✓ ${n} patient notifications (incl. 1 failed text, 1 suppressed email), ${alerts.length} staff alerts`);
  console.log('  → Run the worker (pnpm nx serve worker) to queue reminders for upcoming visits and deliver them.');
}