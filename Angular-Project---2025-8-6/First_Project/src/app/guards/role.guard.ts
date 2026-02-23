import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const authService = inject(AuthService);

    const currentUser = authService.currentUserValue;

    if (currentUser) {
        // Check if route is restricted by role
        const { roles } = route.data as { roles: string[] };

        if (roles && roles.indexOf(currentUser.role) === -1) {
            // Role not authorized, redirect to home page
            router.navigate(['/']);
            return false;
        }

        // Authorized
        return true;
    }

    // Not logged in, redirect to login page
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
};
