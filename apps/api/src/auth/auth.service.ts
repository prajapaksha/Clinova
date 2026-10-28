import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  AuditAction,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  isPasswordExpired,
  passwordPolicyErrors,
} from '@clinova/identity/domain';
import { PrismaService } from '../prisma/prisma.service';
import { StaffService } from '../staff/staff.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import type { JwtPayload } from './strategies/jwt.strategy';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export interface SessionUser extends AuthUser {
  /** True when the password is older than the 90-day rotation policy (or was set by an admin). */
  passwordExpired: boolean;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
}

export const BCRYPT_ROUNDS = 10;

const toAuthUser = (s: { id: string; email: string; role: string; firstName: string; lastName: string }): AuthUser =>
  ({ id: s.id, email: s.email, role: s.role, firstName: s.firstName, lastName: s.lastName });

@Injectable()
export class AuthService {
  constructor(
    private readonly staff: StaffService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Verifies credentials with brute-force protection (PRD §5.1): after
   * MAX_FAILED_LOGINS failures the account locks for LOCKOUT_MINUTES.
   */
  async validateUser(email: string, password: string, ctx: AuditContext, now = new Date()): Promise<AuthUser | null> {
    const staffMember = await this.staff.findByEmail(email.trim().toLowerCase());
    const failed = (reason: string) => this.audit.log(ctx, {
      action: AuditAction.LoginFailed, resourceType: 'Session', resourceId: staffMember?.id ?? null, userName: email, newValue: reason,
    });

    if (!staffMember || !staffMember.isActive) {
      await failed(staffMember ? 'inactive account' : 'unknown email');
      return null;
    }

    if (staffMember.lockedUntil && staffMember.lockedUntil > now) {
      await failed('account locked');
      const minutes = Math.ceil((staffMember.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new UnauthorizedException(`Account locked after too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }

    const match = await bcrypt.compare(password, staffMember.passwordHash);
    if (!match) {
      const attempts = staffMember.failedLoginAttempts + 1;
      const lock = attempts >= MAX_FAILED_LOGINS;
      await this.prisma.staff.update({
        where: { id: staffMember.id },
        data: lock
          ? { failedLoginAttempts: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) }
          : { failedLoginAttempts: attempts },
      });
      await failed(`wrong password (attempt ${attempts})`);
      if (lock) {
        await this.audit.log(ctx, {
          action: AuditAction.AccountLocked, resourceType: 'Staff', resourceId: staffMember.id, userName: email,
        });
      }
      return null;
    }

    await this.prisma.staff.update({
      where: { id: staffMember.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    const user = toAuthUser(staffMember);
    await this.audit.log({ ...ctx, user }, { action: AuditAction.Login, resourceType: 'Session', resourceId: user.id });
    return user;
  }

  async login(user: AuthUser): Promise<{ accessToken: string; user: SessionUser }> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName };
    const session = await this.me(user.id);
    if (!session) throw new UnauthorizedException();
    return { accessToken: this.jwt.sign(payload), user: session };
  }

  /** Current active user, re-read from the database (role changes and deactivation apply immediately). */
  async activeUser(id: string): Promise<AuthUser | null> {
    const staffMember = await this.staff.findById(id);
    return staffMember?.isActive ? toAuthUser(staffMember) : null;
  }

  async me(id: string): Promise<SessionUser | null> {
    const staffMember = await this.staff.findById(id);
    if (!staffMember || !staffMember.isActive) return null;
    return {
      ...toAuthUser(staffMember),
      passwordExpired: isPasswordExpired(staffMember.passwordChangedAt),
      lastLoginAt: staffMember.lastLoginAt,
      mfaEnabled: staffMember.mfaEnabled,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, ctx: AuditContext): Promise<void> {
    const staffMember = await this.staff.findById(userId);
    if (!staffMember) throw new UnauthorizedException();
    if (!(await bcrypt.compare(currentPassword, staffMember.passwordHash))) {
      throw new BadRequestException('Your current password is incorrect.');
    }
    const errors = passwordPolicyErrors(newPassword);
    if (errors.length) throw new BadRequestException(`New password needs: ${errors.join(', ').toLowerCase()}.`);
    if (await bcrypt.compare(newPassword, staffMember.passwordHash)) {
      throw new BadRequestException('Choose a password you have not used before.');
    }

    await this.prisma.staff.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), passwordChangedAt: new Date() },
    });
    await this.audit.log(ctx, { action: AuditAction.PasswordChanged, resourceType: 'Staff', resourceId: userId });
  }

  async logout(ctx: AuditContext): Promise<void> {
    await this.audit.log(ctx, { action: AuditAction.Logout, resourceType: 'Session', resourceId: ctx.user?.id ?? null });
  }
}
