import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import type { Patient, PatientAccount } from '@prisma/client';
import { AuditAction, LOCKOUT_MINUTES, MAX_FAILED_LOGINS, UserRole, passwordPolicyErrors } from '@clinova/identity/domain';
import type { PortalAccessSummary, PortalUser, PatientAccountId } from '@clinova/portal/domain';
import { INVITE_VALID_DAYS, PortalAccountStatus, RESET_TOKEN_VALID_MINUTES, formatInviteCode, normalizeInviteCode } from '@clinova/portal/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

const BCRYPT_ROUNDS = 10;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NO_MATCH = "We couldn't match these details to a patient record. Check them, or ask the office for an invite code.";

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
type AccountWithPatient = PatientAccount & { patient: Patient };

/** Patient portal accounts: invites, self-registration, sign-in and password reset (PRD §4.8, §5.1). */
@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  // ── Staff: invites & access ────────────────────────────────────────────────

  async accessSummary(patientId: string, now = new Date()): Promise<PortalAccessSummary> {
    const account = await this.prisma.patientAccount.findUnique({ where: { patientId } });
    if (!account) return { status: 'NONE', email: null, inviteExpiresAt: null, activatedAt: null, lastLoginAt: null, lockedUntil: null };
    return {
      status: account.status as PortalAccountStatus,
      email: account.email,
      inviteExpiresAt: account.status === PortalAccountStatus.Invited ? account.inviteExpiresAt : null,
      activatedAt: account.activatedAt,
      lastLoginAt: account.lastLoginAt,
      lockedUntil: account.lockedUntil && account.lockedUntil > now ? account.lockedUntil : null,
    };
  }

  /** Creates (or renews) an invite. The code is returned once for staff to share; only its hash is stored. */
  async invite(patientId: string, email: string | undefined, ctx: AuditContext, now = new Date()) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId }, include: { portalAccount: true } });
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);
    if (patient.isArchived) throw new BadRequestException('Archived patients cannot be invited to the portal.');
    if (patient.portalAccount?.status === PortalAccountStatus.Active) {
      throw new ConflictException('This patient already has an active portal account.');
    }
    const address = (email ?? (JSON.parse(patient.contactJson) as { email?: string | null }).email ?? '').trim().toLowerCase();
    if (!address) throw new BadRequestException("Add the patient's email address before sending an invite.");
    const other = await this.prisma.patientAccount.findUnique({ where: { email: address } });
    if (other && other.patientId !== patientId) throw new ConflictException('Another portal account already uses this email address.');

    const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    const inviteExpiresAt = new Date(now.getTime() + INVITE_VALID_DAYS * 86_400_000);
    const data = {
      email: address,
      status: PortalAccountStatus.Invited,
      inviteCodeHash: sha256(code),
      inviteExpiresAt,
      invitedBy: ctx.user?.id ?? null,
    };
    await this.prisma.patientAccount.upsert({ where: { patientId }, create: { patientId, ...data }, update: data });
    await this.audit.log(ctx, { action: AuditAction.Create, resourceType: 'PortalInvite', resourceId: patientId, patientId, newValue: { email: address } });
    this.devNotice(`Portal invite for ${address}: code ${formatInviteCode(code)} (expires ${inviteExpiresAt.toISOString()})`);
    return { code: formatInviteCode(code), email: address, expiresAt: inviteExpiresAt };
  }

  async setDisabled(patientId: string, disabled: boolean, ctx: AuditContext): Promise<PortalAccessSummary> {
    const account = await this.prisma.patientAccount.findUnique({ where: { patientId } });
    if (!account) throw new NotFoundException('This patient has no portal account.');
    const status = disabled ? PortalAccountStatus.Disabled : account.passwordHash ? PortalAccountStatus.Active : PortalAccountStatus.Invited;
    await this.prisma.patientAccount.update({ where: { patientId }, data: { status, failedLoginAttempts: 0, lockedUntil: null } });
    await this.audit.log(ctx, {
      action: AuditAction.AccountStatusChanged, resourceType: 'PatientAccount', resourceId: account.id, patientId,
      oldValue: account.status, newValue: status,
    });
    return this.accessSummary(patientId);
  }

  // ── Patients: registration & activation ────────────────────────────────────

  /** Self-registration for existing patients: last name + date of birth + email on file must all match. */
  async register(dto: { lastName: string; dateOfBirth: string; email: string; password: string }, ctx: AuditContext) {
    this.assertPolicy(dto.password);
    const email = dto.email.trim().toLowerCase();
    const day = new Date(`${dto.dateOfBirth}T00:00:00Z`);
    if (Number.isNaN(day.getTime())) throw new BadRequestException(NO_MATCH);
    const candidates = await this.prisma.patient.findMany({
      where: { dateOfBirth: { gte: new Date(day.getTime() - 86_400_000), lt: new Date(day.getTime() + 2 * 86_400_000) }, isArchived: false },
      include: { portalAccount: true },
    });
    const patient = candidates.find(p =>
      p.dateOfBirth.toISOString().slice(0, 10) === dto.dateOfBirth &&
      p.lastName.trim().toLowerCase() === dto.lastName.trim().toLowerCase() &&
      ((JSON.parse(p.contactJson) as { email?: string | null }).email ?? '').trim().toLowerCase() === email);
    if (!patient) {
      await this.audit.log(ctx, { action: AuditAction.LoginFailed, resourceType: 'PortalRegistration', userName: email, newValue: 'no matching patient' });
      throw new BadRequestException(NO_MATCH);
    }
    if (patient.portalAccount?.status === PortalAccountStatus.Active) {
      throw new ConflictException('You already have a portal account. Sign in, or reset your password.');
    }
    if (patient.portalAccount?.status === PortalAccountStatus.Disabled) {
      throw new BadRequestException('Portal access for this record is turned off. Please contact the office.');
    }
    const other = await this.prisma.patientAccount.findUnique({ where: { email } });
    if (other && other.patientId !== patient.id) throw new ConflictException('This email address is already used by another portal account.');

    const data = {
      email,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      status: PortalAccountStatus.Active,
      activatedAt: new Date(),
      inviteCodeHash: null,
      inviteExpiresAt: null,
    };
    const account = await this.prisma.patientAccount.upsert({
      where: { patientId: patient.id },
      create: { patientId: patient.id, ...data },
      update: data,
      include: { patient: true },
    });
    await this.audit.log(this.ctxFor(account, ctx), { action: AuditAction.Create, resourceType: 'PatientAccount', resourceId: account.id, patientId: patient.id, newValue: 'self-registered' });
    return this.session(account, ctx);
  }

  async activate(dto: { email: string; code: string; password: string }, ctx: AuditContext, now = new Date()) {
    this.assertPolicy(dto.password);
    const account = await this.prisma.patientAccount.findUnique({ where: { email: dto.email.trim().toLowerCase() }, include: { patient: true } });
    const valid = account?.status === PortalAccountStatus.Invited &&
      account.inviteCodeHash === sha256(normalizeInviteCode(dto.code)) &&
      !!account.inviteExpiresAt && account.inviteExpiresAt > now;
    if (!account || !valid) throw new BadRequestException('This invite code is invalid or has expired. Ask the office for a new one.');
    const updated = await this.prisma.patientAccount.update({
      where: { id: account.id },
      data: {
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        status: PortalAccountStatus.Active,
        activatedAt: now,
        inviteCodeHash: null,
        inviteExpiresAt: null,
      },
      include: { patient: true },
    });
    await this.audit.log(this.ctxFor(updated, ctx), { action: AuditAction.Update, resourceType: 'PatientAccount', resourceId: account.id, patientId: account.patientId, newValue: 'activated' });
    return this.session(updated, ctx);
  }

  // ── Sign-in ────────────────────────────────────────────────────────────────

  /** Same brute-force protection as staff: lock for LOCKOUT_MINUTES after MAX_FAILED_LOGINS failures. */
  async login(emailInput: string, password: string, ctx: AuditContext, now = new Date()) {
    const email = emailInput.trim().toLowerCase();
    const account = await this.prisma.patientAccount.findUnique({ where: { email }, include: { patient: true } });
    const failed = (reason: string) => this.audit.log(ctx, {
      action: AuditAction.LoginFailed, resourceType: 'PortalSession', resourceId: account?.id ?? null,
      patientId: account?.patientId ?? null, userName: email, newValue: reason,
    });
    const invalid = new UnauthorizedException('Incorrect email or password.');

    if (!account || account.status !== PortalAccountStatus.Active || !account.passwordHash || account.patient.isArchived) {
      await failed(account ? `account ${account.status.toLowerCase()}` : 'unknown email');
      if (account?.status === PortalAccountStatus.Invited) {
        throw new UnauthorizedException('Your account is not activated yet. Use the invite code from the office to set your password.');
      }
      throw invalid;
    }
    if (account.lockedUntil && account.lockedUntil > now) {
      await failed('account locked');
      const minutes = Math.ceil((account.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new UnauthorizedException(`Account locked after too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }
    if (!(await bcrypt.compare(password, account.passwordHash))) {
      const attempts = account.failedLoginAttempts + 1;
      const lock = attempts >= MAX_FAILED_LOGINS;
      await this.prisma.patientAccount.update({
        where: { id: account.id },
        data: lock ? { failedLoginAttempts: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) } : { failedLoginAttempts: attempts },
      });
      await failed(`wrong password (attempt ${attempts})`);
      if (lock) {
        await this.audit.log(ctx, { action: AuditAction.AccountLocked, resourceType: 'PatientAccount', resourceId: account.id, patientId: account.patientId, userName: email });
        throw new UnauthorizedException(`Account locked after too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
      }
      throw invalid;
    }
    const updated = await this.prisma.patientAccount.update({
      where: { id: account.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
      include: { patient: true },
    });
    return this.session(updated, ctx, account.lastLoginAt);
  }

  async me(accountId: string): Promise<PortalUser> {
    const account = await this.prisma.patientAccount.findUnique({ where: { id: accountId }, include: { patient: true } });
    if (!account || account.status !== PortalAccountStatus.Active) throw new UnauthorizedException();
    return this.toUser(account);
  }

  async logout(ctx: AuditContext): Promise<void> {
    await this.audit.log(ctx, { action: AuditAction.Logout, resourceType: 'PortalSession', resourceId: ctx.user?.id ?? null });
  }

  // ── Passwords ──────────────────────────────────────────────────────────────

  /** Always succeeds (no account enumeration). The link goes out by email once notifications ship (Phase 6). */
  async forgotPassword(emailInput: string, ctx: AuditContext, now = new Date()): Promise<void> {
    const account = await this.prisma.patientAccount.findUnique({ where: { email: emailInput.trim().toLowerCase() } });
    if (!account || account.status !== PortalAccountStatus.Active) return;
    const token = randomBytes(32).toString('hex');
    await this.prisma.patientAccount.update({
      where: { id: account.id },
      data: { resetTokenHash: sha256(token), resetExpiresAt: new Date(now.getTime() + RESET_TOKEN_VALID_MINUTES * 60_000) },
    });
    await this.audit.log(ctx, { action: AuditAction.PasswordReset, resourceType: 'PatientAccount', resourceId: account.id, patientId: account.patientId, userName: account.email, newValue: 'reset requested' });
    const portalUrl = process.env['PORTAL_URL'] ?? 'http://localhost:4300';
    this.devNotice(`Password reset link for ${account.email}: ${portalUrl}/reset-password?token=${token}`);
  }

  async resetPassword(token: string, password: string, ctx: AuditContext, now = new Date()) {
    this.assertPolicy(password);
    const account = await this.prisma.patientAccount.findFirst({ where: { resetTokenHash: sha256(token) }, include: { patient: true } });
    if (!account || !account.resetExpiresAt || account.resetExpiresAt < now || account.status !== PortalAccountStatus.Active) {
      throw new BadRequestException('This reset link is invalid or has expired. Request a new one.');
    }
    const updated = await this.prisma.patientAccount.update({
      where: { id: account.id },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), resetTokenHash: null, resetExpiresAt: null, failedLoginAttempts: 0, lockedUntil: null },
      include: { patient: true },
    });
    await this.audit.log(this.ctxFor(updated, ctx), { action: AuditAction.PasswordChanged, resourceType: 'PatientAccount', resourceId: account.id, patientId: account.patientId });
    return this.session(updated, ctx);
  }

  async changePassword(accountId: string, current: string, next: string, ctx: AuditContext): Promise<void> {
    const account = await this.prisma.patientAccount.findUnique({ where: { id: accountId } });
    if (!account?.passwordHash) throw new UnauthorizedException();
    if (!(await bcrypt.compare(current, account.passwordHash))) throw new BadRequestException('Your current password is incorrect.');
    this.assertPolicy(next);
    if (await bcrypt.compare(next, account.passwordHash)) throw new BadRequestException('Choose a password you have not used before.');
    await this.prisma.patientAccount.update({ where: { id: accountId }, data: { passwordHash: await bcrypt.hash(next, BCRYPT_ROUNDS) } });
    await this.audit.log(ctx, { action: AuditAction.PasswordChanged, resourceType: 'PatientAccount', resourceId: accountId, patientId: account.patientId });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private assertPolicy(password: string): void {
    const errors = passwordPolicyErrors(password);
    if (errors.length) throw new BadRequestException(`Password needs: ${errors.join(', ').toLowerCase()}.`);
  }

  private async session(account: AccountWithPatient, ctx: AuditContext, previousLogin?: Date | null) {
    const payload: JwtPayload = {
      sub: account.id, typ: 'patient', patientId: account.patientId, email: account.email,
      role: UserRole.Patient, firstName: account.patient.firstName, lastName: account.patient.lastName,
    };
    await this.audit.log(this.ctxFor(account, ctx), { action: AuditAction.Login, resourceType: 'PortalSession', resourceId: account.id, patientId: account.patientId });
    return { accessToken: this.jwt.sign(payload), user: { ...this.toUser(account), lastLoginAt: previousLogin ?? account.lastLoginAt } };
  }

  private ctxFor(account: AccountWithPatient, ctx: AuditContext): AuditContext {
    return { ...ctx, user: { id: account.id, firstName: account.patient.firstName, lastName: account.patient.lastName, role: UserRole.Patient } };
  }

  private toUser(account: AccountWithPatient): PortalUser {
    return {
      id: account.id as PatientAccountId,
      patientId: account.patientId,
      email: account.email,
      firstName: account.patient.firstName,
      lastName: account.patient.lastName,
      preferredName: account.patient.preferredName,
      lastLoginAt: account.lastLoginAt,
    };
  }

  /**
   * Until email delivery exists (Phase 6), invite codes and reset links are logged outside
   * production. APP_ENV is read at runtime (webpack inlines NODE_ENV at build time).
   */
  private devNotice(message: string): void {
    if ((process.env['APP_ENV'] ?? 'development') !== 'production') this.logger.warn(`[dev only] ${message}`);
  }
}
