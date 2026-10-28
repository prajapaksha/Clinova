import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditAction, MAX_FAILED_LOGINS, UserRole, passwordPolicyErrors } from '@clinova/identity/domain';
import { CredentialType, DaySchedule } from '@clinova/staff/domain';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestDatabase } from '../testing/test-database';
import { AuditContext, AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { PatientsService } from '../patients/patients.service';
import { StaffService, generateTemporaryPassword } from './staff.service';

const DAY_MS = 86_400_000;

describe('Staff management, authentication & audit (integration)', () => {
  let prisma: PrismaService;
  let cleanup: () => Promise<void>;
  let audit: AuditService;
  let staff: StaffService;
  let auth: AuthService;
  let superAdmin: AuditContext;
  let practiceAdmin: AuditContext;
  let nurse: AuditContext;

  const ctxFor = (row: { id: string; firstName: string; lastName: string; role: string }): AuditContext => ({
    user: { id: row.id, firstName: row.firstName, lastName: row.lastName, role: row.role },
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  });
  const anonymous: AuditContext = { user: null, ipAddress: '127.0.0.1', userAgent: 'jest' };

  const seedStaff = async (email: string, role: string, password = 'Seed-Password-1') =>
    prisma.staff.create({
      data: { email, role, firstName: role, lastName: 'User', passwordHash: await bcrypt.hash(password, 4) },
    });

  beforeAll(async () => {
    ({ prisma, cleanup } = await createTestDatabase());
    audit = new AuditService(prisma);
    staff = new StaffService(prisma, audit);
    auth = new AuthService(staff, new JwtService({ secret: 'test' }), prisma, audit);
    superAdmin = ctxFor(await seedStaff('root@test.health', UserRole.SuperAdmin));
    practiceAdmin = ctxFor(await seedStaff('admin@test.health', UserRole.Admin));
    nurse = ctxFor(await seedStaff('nurse@test.health', UserRole.Nurse));
  });

  afterAll(async () => cleanup());

  it('generates temporary passwords that satisfy the policy', () => {
    for (let i = 0; i < 25; i++) expect(passwordPolicyErrors(generateTemporaryPassword())).toEqual([]);
  });

  describe('accounts', () => {
    it('creates an account whose temporary password works once and must be changed', async () => {
      const { profile, temporaryPassword } = await staff.create(
        { email: 'New.Doctor@Test.health', firstName: 'Nia', lastName: 'Okafor', role: UserRole.Doctor, title: 'Dr.' },
        practiceAdmin,
      );
      expect(profile.email).toBe('new.doctor@test.health');
      expect(profile.displayName).toBe('Dr. Nia Okafor');
      expect(profile.schedule).toHaveLength(7);

      const user = await auth.validateUser('new.doctor@test.health', temporaryPassword, anonymous);
      expect(user?.id).toBe(profile.id);
      expect((await auth.me(profile.id))?.passwordExpired).toBe(true);

      const ctx = ctxFor({ ...profile, role: profile.role });
      await expect(auth.changePassword(profile.id, temporaryPassword, 'short', ctx)).rejects.toBeInstanceOf(BadRequestException);
      await auth.changePassword(profile.id, temporaryPassword, 'Brand-New-Pass-9', ctx);
      expect((await auth.me(profile.id))?.passwordExpired).toBe(false);

      await expect(
        staff.create({ email: 'new.doctor@test.health', firstName: 'X', lastName: 'Y', role: UserRole.Nurse }, practiceAdmin),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('keeps practice admins away from super-admin accounts', async () => {
      await expect(
        staff.create({ email: 'root2@test.health', firstName: 'R', lastName: 'Two', role: UserRole.SuperAdmin }, practiceAdmin),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const root = await prisma.staff.findUniqueOrThrow({ where: { email: 'root@test.health' } });
      await expect(staff.resetPassword(root.id, practiceAdmin)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(staff.updateAccount(nurse.user!.id, { role: UserRole.SuperAdmin }, practiceAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('records role and status changes, and blocks self role changes', async () => {
      const { profile } = await staff.create({ email: 'temp@test.health', firstName: 'Tem', lastName: 'Porary', role: UserRole.FrontDesk }, superAdmin);
      await staff.updateAccount(profile.id, { role: UserRole.BillingSpecialist, isActive: false }, superAdmin);

      const { entries } = await audit.findMany({ resourceType: 'Staff', userId: superAdmin.user!.id });
      const actions = entries.filter(e => e.resourceId === profile.id).map(e => e.action);
      expect(actions).toEqual(expect.arrayContaining([AuditAction.Create, AuditAction.RoleChanged, AuditAction.AccountStatusChanged]));

      await expect(staff.updateAccount(practiceAdmin.user!.id, { role: UserRole.Nurse }, practiceAdmin)).rejects.toBeInstanceOf(BadRequestException);
      await expect(auth.validateUser('temp@test.health', 'whatever', anonymous)).resolves.toBeNull();
    });
  });

  describe('login protection', () => {
    it(`locks the account after ${MAX_FAILED_LOGINS} failed attempts and lets an admin unlock it`, async () => {
      const row = await seedStaff('lockme@test.health', UserRole.FrontDesk, 'Correct-Pass-1');
      for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
        await expect(auth.validateUser('lockme@test.health', 'wrong', anonymous)).resolves.toBeNull();
      }
      await expect(auth.validateUser('lockme@test.health', 'Correct-Pass-1', anonymous)).rejects.toBeInstanceOf(UnauthorizedException);

      const { entries } = await audit.findMany({ action: AuditAction.AccountLocked });
      expect(entries.some(e => e.resourceId === row.id)).toBe(true);

      const profile = await staff.unlock(row.id, practiceAdmin);
      expect(profile.security?.lockedUntil).toBeNull();
      await expect(auth.validateUser('lockme@test.health', 'Correct-Pass-1', anonymous)).resolves.toMatchObject({ id: row.id });
    });
  });

  describe('profiles, schedules & credentials', () => {
    it('lets staff edit their own profile but not colleagues', async () => {
      const updated = await staff.updateProfile(nurse.user!.id, { phone: '555-0100', specialties: ['Triage', ' Triage ', 'Wound care'] }, nurse);
      expect(updated.specialties).toEqual(['Triage', 'Wound care']);
      await expect(staff.updateProfile(practiceAdmin.user!.id, { phone: '1' }, nurse)).rejects.toBeInstanceOf(ForbiddenException);

      const { entries } = await audit.findMany({ resourceType: 'Staff', userId: nurse.user!.id });
      expect(entries.map(e => e.fieldName)).toEqual(expect.arrayContaining(['phone', 'specialties']));
    });

    it('only shows security details to the account owner and managers', async () => {
      expect((await staff.findProfile(nurse.user!.id, nurse.user)).security).toBeDefined();
      expect((await staff.findProfile(nurse.user!.id, practiceAdmin.user)).security).toBeDefined();
      expect((await staff.findProfile(practiceAdmin.user!.id, nurse.user)).security).toBeUndefined();
    });

    it('validates schedules', async () => {
      const days: DaySchedule[] = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, isWorking: false, hours: null, lunchBreak: null }));
      days[1] = { dayOfWeek: 1, isWorking: true, hours: { start: '17:00', end: '09:00' }, lunchBreak: null };
      await expect(staff.updateSchedule(nurse.user!.id, days, nurse)).rejects.toBeInstanceOf(BadRequestException);
      days[1] = { dayOfWeek: 1, isWorking: true, hours: { start: '09:00', end: '17:00' }, lunchBreak: { start: '12:00', end: '12:30' } };
      const profile = await staff.updateSchedule(nurse.user!.id, days, nurse);
      expect(profile.schedule.filter(d => d.isWorking)).toHaveLength(1);
    });

    it('tracks credential expiry and lists expiring credentials', async () => {
      const now = new Date();
      const soon = await staff.addCredential(nurse.user!.id, {
        type: CredentialType.BLS, number: 'BLS-1', expirationDate: new Date(now.getTime() + 5 * DAY_MS).toISOString(),
      }, nurse);
      expect(soon.status).toBe('DUE_7');
      await staff.addCredential(nurse.user!.id, {
        type: CredentialType.MedicalLicense, number: 'RN-1', expirationDate: new Date(now.getTime() + 400 * DAY_MS).toISOString(),
      }, practiceAdmin);
      await expect(staff.addCredential(practiceAdmin.user!.id, { type: CredentialType.BLS, number: 'X' }, nurse))
        .rejects.toBeInstanceOf(ForbiddenException);
      await expect(staff.addCredential(nurse.user!.id, {
        type: CredentialType.DEA, number: 'D', issueDate: '2026-05-01', expirationDate: '2026-01-01',
      }, nurse)).rejects.toBeInstanceOf(BadRequestException);

      const expiring = await staff.expiringCredentials(90, now);
      expect(expiring.map(c => c.number)).toEqual(['BLS-1']);
      expect(expiring[0].staffName).toBe('NURSE User');

      const [summary] = await staff.findAll({ search: 'nurse@test' }, now);
      expect(summary.credentialStatus).toBe('DUE_7');

      await staff.removeCredential(nurse.user!.id, soon.id, nurse);
      expect(await staff.expiringCredentials(90, now)).toEqual([]);
    });
  });

  describe('patient field-level access', () => {
    it('stops limited roles from changing medical fields and audits each changed field', async () => {
      const patients = new PatientsService(prisma, audit);
      const frontDesk = ctxFor(await seedStaff('desk@test.health', UserRole.FrontDesk));
      const doctor = ctxFor(await seedStaff('doc@test.health', UserRole.Doctor));
      const patient = await patients.create({
        firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1980-01-01', sex: 'FEMALE',
        contact: { primaryPhone: '555-0101', mailingAddress: { street1: '1 Main', city: 'Town', state: 'CA', postalCode: '90000' } },
        consent: { marketingConsent: false, telehealthConsent: true },
      } as Parameters<PatientsService['create']>[0]);

      await expect(patients.update(patient.id, { bloodType: 'O_POS' }, frontDesk)).rejects.toBeInstanceOf(ForbiddenException);
      // Unchanged medical values sent alongside demographics are fine.
      await patients.update(patient.id, { preferredName: 'Countess', bloodType: patient.bloodType }, frontDesk);
      await patients.update(patient.id, { bloodType: 'O_POS' }, doctor);

      const { entries } = await audit.findMany({ patientId: patient.id });
      expect(entries.map(e => [e.userId, e.fieldName])).toEqual(expect.arrayContaining([
        [frontDesk.user!.id, 'preferredName'],
        [doctor.user!.id, 'bloodType'],
      ]));
      expect(entries.some(e => e.userId === frontDesk.user!.id && e.fieldName === 'bloodType')).toBe(false);
    });
  });
});
