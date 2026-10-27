import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EncounterStatus, emptySoapNote } from '@clinova/clinical/domain';
import type { AuthUser } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import { EncountersService, mergeNote } from './encounters.service';

// The in-memory Prisma fake handles arbitrary row shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Where = Record<string, any>;

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(row[key]);
      if ('gte' in cond || 'lte' in cond) {
        return (!cond.gte || row[key] >= cond.gte) && (!cond.lte || row[key] <= cond.lte);
      }
    }
    return row[key] === cond;
  });
}

let seq = 0;
function table(rows: Row[] = [], defaults: () => Row = () => ({})) {
  return {
    rows,
    findUnique: jest.fn(async ({ where }: { where: Where }) => rows.find(r => matches(r, where)) ?? null),
    findMany: jest.fn(async ({ where }: { where?: Where } = {}) => rows.filter(r => matches(r, where))),
    count: jest.fn(async ({ where }: { where?: Where } = {}) => rows.filter(r => matches(r, where)).length),
    create: jest.fn(async ({ data }: { data: Row }) => {
      const row = { id: `id-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...data };
      rows.push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: { where: Where; data: Row }) => {
      const row = rows.find(r => matches(r, where));
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    }),
    delete: jest.fn(async ({ where }: { where: Where }) => {
      const i = rows.findIndex(r => matches(r, where));
      return rows.splice(i, 1)[0];
    }),
  };
}

function createFakePrisma() {
  const prescription = table([], () => ({ status: 'ACTIVE', issuedAt: new Date(), instructions: null, pharmacyNotes: null }));
  const encounter = table([], () => ({
    vitalsJson: '[]', serviceCodesJson: '[]', addendaJson: '[]', signedBy: null, signedAt: null, templateId: null,
  }));
  // Mimic `include: { prescriptions: true }`.
  const withRx = (row: Row | null) => row && { ...row, prescriptions: prescription.rows.filter(p => p.encounterId === row['id']) };
  const encFindUnique = encounter.findUnique;
  const encFindMany = encounter.findMany;
  encounter.findUnique = jest.fn(async (args: { where: Where }) => withRx(await encFindUnique(args)));
  encounter.findMany = jest.fn(async (args?: { where?: Where }) => (await encFindMany(args)).map(withRx) as Row[]);

  const prisma: Record<string, unknown> = {
    patient: table([{
      id: 'pat-1', firstName: 'Ruth', lastName: 'Abernathy', mrn: 'CLV-1',
      allergiesJson: JSON.stringify([{ allergen: 'Penicillin', type: 'DRUG', severity: 'HIGH', reaction: 'Hives' }]),
      currentMedicationsJson: JSON.stringify(['Warfarin 5 mg daily']),
    }]),
    staff: table([
      { id: 'doc-1', firstName: 'Wei', lastName: 'Chen' },
      { id: 'nurse-1', firstName: 'Ji-Yeon', lastName: 'Kim' },
    ]),
    appointment: table([
      { id: 'appt-checked-in', patientId: 'pat-1', providerId: 'doc-1', status: 'CHECKED_IN', reasonForVisit: 'Headache' },
      { id: 'appt-scheduled', patientId: 'pat-1', providerId: 'doc-1', status: 'SCHEDULED', reasonForVisit: null },
    ]),
    encounter,
    prescription,
    encounterTemplate: table([{
      id: 'tpl-1', name: 'Headache', defaultNoteJson: JSON.stringify({ subjective: { chiefComplaint: 'Headache' } }),
    }]),
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>): Promise<unknown> => cb(prisma)),
  };
  return prisma as {
    patient: ReturnType<typeof table>;
    staff: ReturnType<typeof table>;
    appointment: ReturnType<typeof table>;
    encounter: typeof encounter;
    prescription: typeof prescription;
    encounterTemplate: ReturnType<typeof table>;
    $transaction: jest.Mock;
  };
}

const doctor: AuthUser = { id: 'doc-1', email: 'd@x', role: 'PHYSICIAN', firstName: 'Wei', lastName: 'Chen' };
const nurse: AuthUser = { id: 'nurse-1', email: 'n@x', role: 'NURSE', firstName: 'Ji-Yeon', lastName: 'Kim' };

const readyNote = {
  subjective: { chiefComplaint: 'Headache for 3 days' },
  assessment: { diagnoses: [{ code: { code: 'R51.9', description: 'Headache, unspecified' }, isPrimary: false }] },
};

describe('EncountersService', () => {
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: EncountersService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new EncountersService(prisma as unknown as PrismaService);
  });

  describe('start', () => {
    it('starts from a checked-in appointment and marks the appointment in progress', async () => {
      const enc = await service.start({ patientId: 'pat-1', appointmentId: 'appt-checked-in' }, nurse);

      expect(enc.status).toBe(EncounterStatus.InProgress);
      expect(enc.providerId).toBe('doc-1');
      expect(enc.patientName).toBe('Ruth Abernathy');
      expect(enc.reasonForVisit).toBe('Headache');
      expect(prisma.appointment.rows[0]['status']).toBe('IN_PROGRESS');
    });

    it('is idempotent for an appointment that already has an encounter', async () => {
      const first = await service.start({ patientId: 'pat-1', appointmentId: 'appt-checked-in' }, doctor);
      const second = await service.start({ patientId: 'pat-1', appointmentId: 'appt-checked-in' }, doctor);
      expect(second.id).toBe(first.id);
      expect(prisma.encounter.rows).toHaveLength(1);
    });

    it('rejects appointments that are not checked in', async () => {
      await expect(service.start({ patientId: 'pat-1', appointmentId: 'appt-scheduled' }, doctor))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('starts a walk-in encounter for the signed-in physician and applies a template', async () => {
      const enc = await service.start({ patientId: 'pat-1', templateId: 'tpl-1' }, doctor);
      expect(enc.appointmentId).toBeNull();
      expect(enc.providerId).toBe('doc-1');
      expect(enc.note.subjective.chiefComplaint).toBe('Headache');
    });

    it('requires a provider when a nurse starts a walk-in', async () => {
      await expect(service.start({ patientId: 'pat-1' }, nurse)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('merges note sections and stamps vitals with the recorder', async () => {
      const enc = await service.start({ patientId: 'pat-1' }, doctor);
      await service.update(enc.id, { note: { subjective: { chiefComplaint: 'Cough' } } }, doctor);
      const updated = await service.update(
        enc.id,
        { note: { plan: { treatmentPlan: 'Rest' } }, vitals: [{ type: 'HEART_RATE', value: 72, unit: 'bpm' }] },
        nurse,
      );

      expect(updated.note.subjective.chiefComplaint).toBe('Cough');
      expect(updated.note.plan.treatmentPlan).toBe('Rest');
      expect(updated.vitals[0]).toEqual(expect.objectContaining({ type: 'HEART_RATE', value: 72, recordedBy: 'nurse-1' }));
    });
  });

  describe('sign', () => {
    it('only allows physicians to sign', async () => {
      const enc = await service.start({ patientId: 'pat-1', appointmentId: 'appt-checked-in' }, doctor);
      await expect(service.sign(enc.id, nurse)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lists missing required content', async () => {
      const enc = await service.start({ patientId: 'pat-1' }, doctor);
      await expect(service.sign(enc.id, doctor)).rejects.toThrow(/Chief complaint is required.*diagnosis is required/);
    });

    it('locks the note, sets a primary diagnosis, and completes the appointment', async () => {
      const enc = await service.start({ patientId: 'pat-1', appointmentId: 'appt-checked-in' }, doctor);
      await service.update(enc.id, { note: readyNote }, doctor);

      const signed = await service.sign(enc.id, doctor);

      expect(signed.status).toBe(EncounterStatus.Signed);
      expect(signed.signedByName).toBe('Wei Chen');
      expect(signed.note.assessment.diagnoses[0].isPrimary).toBe(true);
      expect(prisma.appointment.rows[0]['status']).toBe('COMPLETED');
      await expect(service.update(enc.id, { note: { plan: { treatmentPlan: 'x' } } }, doctor))
        .rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('addenda', () => {
    it('are rejected on unsigned notes', async () => {
      const enc = await service.start({ patientId: 'pat-1' }, doctor);
      await expect(service.addAddendum(enc.id, 'More info', doctor)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('are appended to signed notes and mark them amended', async () => {
      const enc = await service.start({ patientId: 'pat-1' }, doctor);
      await service.update(enc.id, { note: readyNote }, doctor);
      await service.sign(enc.id, doctor);

      const amended = await service.addAddendum(enc.id, '  Lab results reviewed.  ', doctor);

      expect(amended.status).toBe(EncounterStatus.Amended);
      expect(amended.addenda).toEqual([expect.objectContaining({ content: 'Lab results reviewed.', addedByName: 'Wei Chen' })]);
    });
  });

  describe('discard', () => {
    it('deletes the draft and returns the appointment to checked in', async () => {
      const enc = await service.start({ patientId: 'pat-1', appointmentId: 'appt-checked-in' }, doctor);
      await service.discard(enc.id);
      expect(prisma.encounter.rows).toHaveLength(0);
      expect(prisma.appointment.rows[0]['status']).toBe('CHECKED_IN');
    });
  });

  describe('prescriptions', () => {
    const rx = (medicationName: string, acknowledgeWarnings?: boolean) => ({
      drug: { medicationName, strength: '500 mg', form: 'Tablet', route: 'Oral', dosageAmount: '1 tablet', frequency: 'BID' },
      refillsAllowed: 1,
      acknowledgeWarnings,
    });

    it('blocks prescribing with unacknowledged safety alerts', async () => {
      const enc = await service.start({ patientId: 'pat-1' }, doctor);
      await expect(service.issuePrescription(enc.id, rx('Amoxicillin'), doctor)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.prescription.rows).toHaveLength(0);
    });

    it('records failed checks when the prescriber acknowledges alerts', async () => {
      const enc = await service.start({ patientId: 'pat-1' }, doctor);
      const issued = await service.issuePrescription(enc.id, rx('Naproxen', true), doctor);
      expect(issued.allergyCheckPassed).toBe(true);
      expect(issued.drugInteractionCheckPassed).toBe(false);
      expect(issued.refillsRemaining).toBe(1);
    });

    it('issues a clean prescription without acknowledgement', async () => {
      const enc = await service.start({ patientId: 'pat-1' }, doctor);
      const issued = await service.issuePrescription(enc.id, rx('Acetaminophen'), doctor);
      expect(issued.allergyCheckPassed && issued.drugInteractionCheckPassed).toBe(true);
    });

    it('only allows physicians to prescribe', async () => {
      const enc = await service.start({ patientId: 'pat-1' }, doctor);
      await expect(service.issuePrescription(enc.id, rx('Acetaminophen'), nurse)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('reference search', () => {
    it('ranks exact code matches first', async () => {
      const results = await service.searchIcd10('I10');
      expect(results[0].code).toBe('I10');
    });

    it('finds diagnoses by description words', async () => {
      const results = await service.searchIcd10('hypertension');
      expect(results.map(r => r.code)).toContain('I10');
    });

    it('expands drug strengths', () => {
      const results = service.searchDrugs('lisino');
      expect(results.map(r => r.strength)).toEqual(['5 mg', '10 mg', '20 mg', '40 mg']);
    });
  });

  it('mergeNote keeps untouched sections', () => {
    const merged = mergeNote(emptySoapNote(), { plan: { treatmentPlan: 'Hydrate' } } as never);
    expect(merged.plan.treatmentPlan).toBe('Hydrate');
    expect(merged.subjective.chiefComplaint).toBe('');
  });
});
