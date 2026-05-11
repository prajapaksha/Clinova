import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  // Check token synchronously — user may not be loaded yet if navigating directly
  if (auth.getToken()) return true;
  return router.createUrlTree(['/auth/login']);
};
