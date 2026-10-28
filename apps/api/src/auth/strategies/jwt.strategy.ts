import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] ?? 'fallback-secret',
    });
  }

  /** Re-reads the account so deactivation and role changes take effect on the next request. */
  async validate(payload: JwtPayload) {
    const user = await this.auth.activeUser(payload.sub);
    if (!user) throw new UnauthorizedException('Your account is no longer active.');
    return user;
  }
}