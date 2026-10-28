import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@clinova/identity/domain';
import { AuthService, AuthUser } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  /** 'patient' for portal sessions; absent for staff. */
  typ?: 'patient';
  patientId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] ?? 'fallback-secret',
    });
  }

  /** Re-reads the account so deactivation and role changes take effect on the next request. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = payload.typ === 'patient' ? await this.patient(payload.sub) : await this.auth.activeUser(payload.sub);
    if (!user) throw new UnauthorizedException('Your account is no longer active.');
    return user;
  }

  private async patient(accountId: string): Promise<AuthUser | null> {
    const account = await this.prisma.patientAccount.findUnique({ where: { id: accountId }, include: { patient: true } });
    if (!account || account.status !== 'ACTIVE' || account.patient.isArchived) return null;
    return {
      id: account.id,
      email: account.email,
      role: UserRole.Patient,
      firstName: account.patient.firstName,
      lastName: account.patient.lastName,
      patientId: account.patientId,
    };
  }
}