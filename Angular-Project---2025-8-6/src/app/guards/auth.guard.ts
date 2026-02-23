import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const authService = inject(AuthService);

    const currentUser = authService.currentUserValue;

    if (currentUser) {
        // Logged in, so return true
        return true;
    }

    // Not logged in, redirect to login page with the return url
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
};
