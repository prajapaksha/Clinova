import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PortalSession } from '@clinova/portal/data-access';

export const signedIn: CanActivateFn = (_, state) =>
  inject(PortalSession).isAuthenticated() || inject(Router).createUrlTree(['/sign-in'], { queryParams: state.url !== '/' ? { returnUrl: state.url } : {} });

/** Sign-in pages redirect to home when a session already exists. */
export const signedOut: CanActivateFn = () => !inject(PortalSession).isAuthenticated() || inject(Router).createUrlTree(['/']);