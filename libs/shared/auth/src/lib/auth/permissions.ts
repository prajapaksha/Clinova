import { computed, inject, Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { AccessKind, CapabilityKey, PermissionRule } from '@clinova/identity/domain';
import { hasAccess, isProviderRole, ROLE_LABELS, satisfiesAny, UserRole } from '@clinova/identity/domain';
import { AuthService } from './auth';

/**
 * Role-based access checks for the staff app, driven by the PRD §3.2 permission
 * matrix in @clinova/identity/domain (the API enforces the same rules).
 * Reads the current-user signal, so calls inside templates and computeds are reactive.
 */
@Injectable({ providedIn: 'root' })
export class Permissions {
  private readonly auth = inject(AuthService);

  readonly role = computed(() => this.auth.currentUser()?.role ?? null);
  readonly roleLabel = computed(() => ROLE_LABELS[this.role() as UserRole] ?? this.role() ?? '');
  /** Treating providers (sign notes, prescribe). */
  readonly isProvider = computed(() => isProviderRole(this.role()));

  can(capability: CapabilityKey, access: AccessKind = 'read'): boolean {
    return hasAccess(this.role(), capability, access);
  }

  canAny(rules: ReadonlyArray<PermissionRule>): boolean {
    return satisfiesAny(this.role(), rules);
  }
}

/** Route guard: allows navigation when the user satisfies any rule, else redirects to the dashboard. */
export function requirePermission(...rules: PermissionRule[]): CanActivateFn {
  return () => inject(Permissions).canAny(rules) || inject(Router).createUrlTree(['/dashboard']);
}
