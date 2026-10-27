import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restricts a route (or controller) to staff with one of the given roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
