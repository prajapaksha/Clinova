import {
  CallHandler,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { AuditAction } from '@clinova/identity/domain';
import { AuditContext, AuditService } from './audit.service';

/** The parts of the (Express) HTTP request used for auditing. */
export interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  user?: AuditContext['user'];
}
type Resolver = (req: AuthedRequest, result: unknown) => string | null | undefined;

export interface AuditSpec {
  action: AuditAction;
  resourceType: string;
  /** Defaults to `:id` route param, then `result.id`. */
  resourceId?: Resolver;
  /** Defaults to `result.patientId`, then `?patientId=`. */
  patientId?: Resolver;
  fieldName?: string;
}

export const AUDITED_KEY = 'audited';

/** Records an audit entry after the handler succeeds (PHI access logging). */
export const Audited = (spec: AuditSpec) => SetMetadata(AUDITED_KEY, spec);

export function auditContextFrom(req: AuthedRequest): AuditContext {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) ?? req.ip ?? null;
  return {
    user: req.user ? { id: req.user.id, firstName: req.user.firstName, lastName: req.user.lastName, role: req.user.role } : null,
    ipAddress: ip?.trim() || null,
    userAgent: (req.headers['user-agent'] as string | undefined)?.slice(0, 300) ?? null,
  };
}

/** Injects the AuditContext (user, IP, user agent) for service-level audit entries. */
export const AuditCtx = createParamDecorator((_: unknown, ctx: ExecutionContext): AuditContext =>
  auditContextFrom(ctx.switchToHttp().getRequest<AuthedRequest>()));

const field = (obj: unknown, key: string): string | undefined => {
  const value = obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' ? value : undefined;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const spec = this.reflector.get<AuditSpec | undefined>(AUDITED_KEY, context.getHandler());
    if (!spec) return next.handle();

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    return next.handle().pipe(
      tap(result => {
        const resourceId = spec.resourceId?.(req, result) ?? field(req.params, 'id') ?? field(result, 'id') ?? null;
        const patientId = spec.patientId?.(req, result) ?? field(result, 'patientId') ?? field(req.query, 'patientId') ?? null;
        void this.audit.log(auditContextFrom(req), {
          action: spec.action,
          resourceType: spec.resourceType,
          resourceId,
          patientId,
          fieldName: spec.fieldName ?? null,
        });
      }),
    );
  }
}
