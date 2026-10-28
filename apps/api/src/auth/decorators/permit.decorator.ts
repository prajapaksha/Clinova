import { SetMetadata } from '@nestjs/common';
import type { CapabilityKey, PermissionRule } from '@clinova/identity/domain';

export const PERMIT_KEY = 'permit';

/**
 * Restricts a route (or controller) to roles that satisfy any of the given rules
 * from the PRD §3.2 permission matrix. Method-level rules override class-level ones.
 */
export const Permit = (...rules: PermissionRule[]) => SetMetadata(PERMIT_KEY, rules);

/** Any access (full, limited, or read-only). */
export const read = (capability: CapabilityKey): PermissionRule => ({ capability, access: 'read' });
/** Full or limited access. */
export const write = (capability: CapabilityKey): PermissionRule => ({ capability, access: 'write' });
/** Full access only. */
export const full = (capability: CapabilityKey): PermissionRule => ({ capability, access: 'full' });
