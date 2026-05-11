import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { StaffService } from '../staff/staff.service';
import type { JwtPayload } from './strategies/jwt.strategy';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly staff: StaffService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<AuthUser | null> {
    const staffMember = await this.staff.findByEmail(email);
    if (!staffMember || !staffMember.isActive) return null;
    const match = await bcrypt.compare(password, staffMember.passwordHash);
    if (!match) return null;
    return { id: staffMember.id, email: staffMember.email, role: staffMember.role, firstName: staffMember.firstName, lastName: staffMember.lastName };
  }

  login(user: AuthUser): { accessToken: string; user: AuthUser } {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName };
    return { accessToken: this.jwt.sign(payload), user };
  }

  async me(id: string): Promise<AuthUser | null> {
    const staffMember = await this.staff.findById(id);
    if (!staffMember || !staffMember.isActive) return null;
    return { id: staffMember.id, email: staffMember.email, role: staffMember.role, firstName: staffMember.firstName, lastName: staffMember.lastName };
  }
}
