import { HttpErrorResponse } from '@angular/common/http';

/** Extracts the server's message from a NestJS error response. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    const msg = err.error?.message;
    if (Array.isArray(msg)) return msg.join(' ');
    if (typeof msg === 'string') return msg;
    if (err.status === 403) return 'You do not have permission to perform this action.';
  }
  return fallback;
}
