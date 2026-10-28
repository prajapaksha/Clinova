import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionRule } from '@clinova/identity/domain';
import { STAFF_ROLES, UserRole, satisfiesAny } from '@clinova/identity/domain';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMIT_KEY } from '../decorators/permit.decorator';
import { PATIENT_ROUTE_KEY } from '../decorators/patient-route.decorator';
import type { AuthUser } from '../auth.service';

/**
 * Global authorization guard (runs after JwtAuthGuard). Routes without @Permit are
 * open to any authenticated staff role; @Permit rules are checked against the
 * permission matrix in @clinova/identity/domain. @PatientRoute routes are for patients only.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (this.reflector.getAllAndOverride<boolean>(PATIENT_ROUTE_KEY, targets)) {
      if (user?.role === UserRole.Patient && user.patientId) return true;
      throw new ForbiddenException('This area is for patients.');
    }
    const rules = this.reflector.getAllAndOverride<PermissionRule[] | undefined>(PERMIT_KEY, targets);

    const allowed = rules?.length
      ? satisfiesAny(user?.role, rules)
      : STAFF_ROLES.includes(user?.role as UserRole);
    if (allowed) return true;
    throw new ForbiddenException('You do not have permission to perform this action.');
  }
}
