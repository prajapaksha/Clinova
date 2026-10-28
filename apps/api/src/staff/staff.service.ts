import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import type { Prisma, Staff, StaffCredential as CredentialRow } from '@prisma/client';
import {
  AuditAction,
  canManageAccount,
  hasAccess,
  isPasswordExpired,
  passwordPolicyErrors,
} from '@clinova/identity/domain';
import type {
  CredentialId,
  CredentialType,
  DaySchedule,
  ExpiringCredential,
  StaffCredential,
  StaffId,
  StaffProfile,
  StaffSummary,
} from '@clinova/staff/domain';
import {
  credentialExpiryStatus,
  daysUntil,
  defaultWeeklySchedule,
  displayName,
  mostUrgentStatus,
  scheduleErrors,
} from '@clinova/staff/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import { CreateStaffDto, CredentialDto, UpdateAccountDto, UpdateStaffProfileDto } from './dto/staff.dto';

export type PublicStaff = Omit<Staff, 'passwordHash'>;
type StaffWithCredentials = Staff & { credentials: CredentialRow[] };

const PROFILE_FIELDS = ['title', 'suffix', 'firstName', 'lastName', 'phone', 'officeLocation', 'npi', 'specialties', 'bio'] as const;
const BCRYPT_ROUNDS = 10;
const DAY_MS = 86_400_000;

/** A random password that satisfies the policy (shown to the admin once). */
export function generateTemporaryPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%&*?-'];
  const all = sets.join('');
  const chars = [...sets.map(s => s[randomInt(s.length)]), ...Array.from({ length: 10 }, () => all[randomInt(all.length)])];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Lookups used by authentication ─────────────────────────────────────────

  findByEmail(email: string): Promise<Staff | null> {
    return this.prisma.staff.findUnique({ where: { email } });
  }

  findById(id: string): Promise<Staff | null> {
    return this.prisma.staff.findUnique({ where: { id } });
  }

  // ── Directory & profiles ───────────────────────────────────────────────────

  async findAll(filters: { role?: string; status?: string; specialty?: string; search?: string }, now = new Date()): Promise<StaffSummary[]> {
    const where: Prisma.StaffWhereInput = {};
    if (filters.role) where.role = filters.role;
    if (filters.status !== 'all') where.isActive = filters.status !== 'inactive';
    const search = filters.search?.trim();
    if (search) {
      where.OR = [{ firstName: { contains: search } }, { lastName: { contains: search } }, { email: { contains: search } }];
    }
    const rows = await this.prisma.staff.findMany({
      where,
      include: { credentials: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const summaries = rows.map(r => this.toSummary(r, now));
    const specialty = filters.specialty?.trim().toLowerCase();
    return specialty ? summaries.filter(s => s.specialties.some(x => x.toLowerCase() === specialty)) : summaries;
  }

  async findProfile(id: string, viewer: AuditContext['user'], now = new Date()): Promise<StaffProfile> {
    const row = await this.getRow(id);
    const showSecurity = viewer?.id === id || hasAccess(viewer?.role, 'identity:users', 'write');
    return this.toProfile(row, showSecurity, now);
  }

  async create(dto: CreateStaffDto, ctx: AuditContext): Promise<{ profile: StaffProfile; temporaryPassword: string }> {
    if (!canManageAccount(ctx.user?.role, dto.role, dto.role)) {
      throw new ForbiddenException('You cannot create accounts with this role.');
    }
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.staff.findUnique({ where: { email } })) {
      throw new ConflictException('A staff account with this email already exists.');
    }
    const temporaryPassword = dto.temporaryPassword ?? generateTemporaryPassword();
    const errors = passwordPolicyErrors(temporaryPassword);
    if (errors.length) throw new BadRequestException(`Password needs: ${errors.join(', ').toLowerCase()}.`);

    const row = await this.prisma.staff.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        role: dto.role,
        title: dto.title?.trim() || null,
        phone: dto.phone?.trim() || null,
        passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
        // Forces a password change at first sign-in.
        passwordChangedAt: new Date(0),
        scheduleJson: JSON.stringify(defaultWeeklySchedule()),
      },
      include: { credentials: true },
    });
    await this.audit.log(ctx, { action: AuditAction.Create, resourceType: 'Staff', resourceId: row.id, newValue: { email, role: dto.role } });
    return { profile: this.toProfile(row, true), temporaryPassword };
  }

  async updateProfile(id: string, dto: UpdateStaffProfileDto, ctx: AuditContext): Promise<StaffProfile> {
    this.assertCanEditProfile(id, ctx);
    const before = await this.getRow(id);
    const data: Prisma.StaffUpdateInput = {};
    for (const key of PROFILE_FIELDS) {
      const value = dto[key];
      if (value === undefined) continue;
      if (key === 'specialties') data.specialtiesJson = JSON.stringify([...new Set((value as string[]).map(s => s.trim()).filter(Boolean))]);
      else if (key === 'firstName' || key === 'lastName') data[key] = (value as string).trim();
      else data[key] = typeof value === 'string' ? value.trim() || null : null;
    }
    const after = await this.prisma.staff.update({ where: { id }, data, include: { credentials: true } });
    await this.audit.logFieldChanges(ctx, { resourceType: 'Staff', resourceId: id }, this.profileValues(before), this.profileValues(after), [...PROFILE_FIELDS]);
    return this.toProfile(after, ctx.user?.id === id || hasAccess(ctx.user?.role, 'identity:users', 'write'));
  }

  async updateAccount(id: string, dto: UpdateAccountDto, ctx: AuditContext): Promise<StaffProfile> {
    const target = await this.getRow(id);
    if (!canManageAccount(ctx.user?.role, target.role, dto.role)) {
      throw new ForbiddenException('You cannot manage this account.');
    }
    if (ctx.user?.id === id && (dto.role !== undefined || dto.isActive === false)) {
      throw new BadRequestException('You cannot change your own role or deactivate your own account.');
    }
    const after = await this.prisma.staff.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { credentials: true },
    });
    if (dto.role !== undefined && dto.role !== target.role) {
      await this.audit.log(ctx, { action: AuditAction.RoleChanged, resourceType: 'Staff', resourceId: id, oldValue: target.role, newValue: dto.role });
    }
    if (dto.isActive !== undefined && dto.isActive !== target.isActive) {
      await this.audit.log(ctx, { action: AuditAction.AccountStatusChanged, resourceType: 'Staff', resourceId: id, oldValue: target.isActive ? 'active' : 'inactive', newValue: dto.isActive ? 'active' : 'inactive' });
    }
    return this.toProfile(after, true);
  }

  async resetPassword(id: string, ctx: AuditContext): Promise<{ temporaryPassword: string }> {
    const target = await this.getRow(id);
    if (!canManageAccount(ctx.user?.role, target.role)) throw new ForbiddenException('You cannot manage this account.');
    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.staff.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
        passwordChangedAt: new Date(0),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.audit.log(ctx, { action: AuditAction.PasswordReset, resourceType: 'Staff', resourceId: id });
    return { temporaryPassword };
  }

  async unlock(id: string, ctx: AuditContext): Promise<StaffProfile> {
    const target = await this.getRow(id);
    if (!canManageAccount(ctx.user?.role, target.role)) throw new ForbiddenException('You cannot manage this account.');
    const after = await this.prisma.staff.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      include: { credentials: true },
    });
    await this.audit.log(ctx, { action: AuditAction.AccountStatusChanged, resourceType: 'Staff', resourceId: id, newValue: 'unlocked' });
    return this.toProfile(after, true);
  }

  async updateSchedule(id: string, schedule: DaySchedule[], ctx: AuditContext): Promise<StaffProfile> {
    this.assertCanEditProfile(id, ctx);
    const normalized = [...schedule]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map(d => ({
        dayOfWeek: d.dayOfWeek,
        isWorking: d.isWorking,
        hours: d.isWorking ? d.hours ?? null : null,
        lunchBreak: d.isWorking ? d.lunchBreak ?? null : null,
      }));
    const errors = scheduleErrors(normalized);
    if (errors.length) throw new BadRequestException(errors.join(' '));
    const before = await this.getRow(id);
    const after = await this.prisma.staff.update({
      where: { id }, data: { scheduleJson: JSON.stringify(normalized) }, include: { credentials: true },
    });
    await this.audit.log(ctx, { action: AuditAction.Update, resourceType: 'Staff', resourceId: id, fieldName: 'schedule', oldValue: before.scheduleJson, newValue: after.scheduleJson });
    return this.toProfile(after, ctx.user?.id === id || hasAccess(ctx.user?.role, 'identity:users', 'write'));
  }

  // ── Credentials ────────────────────────────────────────────────────────────

  async addCredential(staffId: string, dto: CredentialDto, ctx: AuditContext): Promise<StaffCredential> {
    this.assertCanEditProfile(staffId, ctx);
    await this.getRow(staffId);
    const row = await this.prisma.staffCredential.create({ data: { staffId, ...this.credentialData(dto, ctx) } });
    await this.audit.log(ctx, { action: AuditAction.Create, resourceType: 'StaffCredential', resourceId: row.id, newValue: { type: row.type, expirationDate: row.expirationDate } });
    return this.toCredential(row);
  }

  async updateCredential(staffId: string, credentialId: string, dto: CredentialDto, ctx: AuditContext): Promise<StaffCredential> {
    this.assertCanEditProfile(staffId, ctx);
    await this.getCredential(staffId, credentialId);
    const row = await this.prisma.staffCredential.update({ where: { id: credentialId }, data: this.credentialData(dto, ctx) });
    await this.audit.log(ctx, { action: AuditAction.Update, resourceType: 'StaffCredential', resourceId: row.id, newValue: { type: row.type, expirationDate: row.expirationDate } });
    return this.toCredential(row);
  }

  async removeCredential(staffId: string, credentialId: string, ctx: AuditContext): Promise<void> {
    this.assertCanEditProfile(staffId, ctx);
    await this.getCredential(staffId, credentialId);
    await this.prisma.staffCredential.delete({ where: { id: credentialId } });
    await this.audit.log(ctx, { action: AuditAction.Delete, resourceType: 'StaffCredential', resourceId: credentialId });
  }

  /** Credentials expiring within `days` (and already expired) for active staff, soonest first. */
  async expiringCredentials(days = 90, now = new Date()): Promise<ExpiringCredential[]> {
    const rows = await this.prisma.staffCredential.findMany({
      where: { expirationDate: { lte: new Date(now.getTime() + days * DAY_MS) }, staff: { isActive: true } },
      include: { staff: true },
      orderBy: { expirationDate: 'asc' },
    });
    return rows.map(r => ({ ...this.toCredential(r, now), staffName: displayName(r.staff), staffRole: r.staff.role }));
  }

  // ── Mapping & helpers ──────────────────────────────────────────────────────

  private assertCanEditProfile(targetId: string, ctx: AuditContext): void {
    if (ctx.user?.id === targetId || hasAccess(ctx.user?.role, 'staff:profiles', 'full')) return;
    throw new ForbiddenException('You can only edit your own staff profile.');
  }

  private async getRow(id: string): Promise<StaffWithCredentials> {
    const row = await this.prisma.staff.findUnique({ where: { id }, include: { credentials: true } });
    if (!row) throw new NotFoundException(`Staff member ${id} not found`);
    return row;
  }

  private async getCredential(staffId: string, credentialId: string): Promise<CredentialRow> {
    const row = await this.prisma.staffCredential.findUnique({ where: { id: credentialId } });
    if (!row || row.staffId !== staffId) throw new NotFoundException(`Credential ${credentialId} not found`);
    return row;
  }

  /** Only managers verify credentials; a self-edited credential needs re-verification. */
  private credentialData(dto: CredentialDto, ctx: AuditContext) {
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : null;
    const expirationDate = dto.expirationDate ? new Date(dto.expirationDate) : null;
    if (issueDate && expirationDate && issueDate > expirationDate) {
      throw new BadRequestException('The expiration date must be after the issue date.');
    }
    return {
      type: dto.type,
      number: dto.number.trim(),
      issuingState: dto.issuingState?.trim() || null,
      issuingAuthority: dto.issuingAuthority?.trim() || null,
      issueDate,
      expirationDate,
      isVerified: hasAccess(ctx.user?.role, 'staff:profiles', 'full') ? dto.isVerified ?? false : false,
    };
  }

  private profileValues(row: Staff): Record<string, unknown> {
    return {
      title: row.title, suffix: row.suffix, firstName: row.firstName, lastName: row.lastName, phone: row.phone,
      officeLocation: row.officeLocation, npi: row.npi, specialties: JSON.parse(row.specialtiesJson), bio: row.bio,
    };
  }

  private toCredential(row: CredentialRow, now = new Date()): StaffCredential {
    return {
      id: row.id as CredentialId,
      staffId: row.staffId as StaffId,
      type: row.type as CredentialType,
      number: row.number,
      issuingState: row.issuingState,
      issuingAuthority: row.issuingAuthority,
      issueDate: row.issueDate,
      expirationDate: row.expirationDate,
      isVerified: row.isVerified,
      status: credentialExpiryStatus(row.expirationDate, now),
      daysUntilExpiry: daysUntil(row.expirationDate, now),
    };
  }

  private toSummary(row: StaffWithCredentials, now = new Date()): StaffSummary {
    return {
      id: row.id as StaffId,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      title: row.title,
      suffix: row.suffix,
      displayName: displayName(row),
      role: row.role,
      isActive: row.isActive,
      phone: row.phone,
      officeLocation: row.officeLocation,
      npi: row.npi,
      specialties: JSON.parse(row.specialtiesJson),
      credentialStatus: mostUrgentStatus(row.credentials.map(c => credentialExpiryStatus(c.expirationDate, now))),
    };
  }

  private toProfile(row: StaffWithCredentials, showSecurity: boolean, now = new Date()): StaffProfile {
    const schedule: DaySchedule[] = JSON.parse(row.scheduleJson);
    return {
      ...this.toSummary(row, now),
      bio: row.bio,
      schedule: schedule.length ? schedule : defaultWeeklySchedule(),
      credentials: [...row.credentials]
        .sort((a, b) => (a.expirationDate?.getTime() ?? Infinity) - (b.expirationDate?.getTime() ?? Infinity))
        .map(c => this.toCredential(c, now)),
      createdAt: row.createdAt,
      ...(showSecurity
        ? {
            security: {
              lastLoginAt: row.lastLoginAt,
              lockedUntil: row.lockedUntil && row.lockedUntil > now ? row.lockedUntil : null,
              failedLoginAttempts: row.failedLoginAttempts,
              passwordChangedAt: row.passwordChangedAt,
              passwordExpired: isPasswordExpired(row.passwordChangedAt, now),
              mfaEnabled: row.mfaEnabled,
            },
          }
        : {}),
    };
  }
}
