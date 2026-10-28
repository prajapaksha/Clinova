import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthedRequest } from '../../audit/audited';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { auditContextFrom } from '../../audit/audited';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(req: AuthedRequest, email: string, password: string) {
    const user = await this.auth.validateUser(email, password, auditContextFrom(req));
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}
