import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { PortalSession } from '@clinova/portal/data-access';

export const portalInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(PortalSession);
  const token = session.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError(err => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !req.url.includes('/auth/')) session.end('expired');
      return throwError(() => err);
    }),
  );
};