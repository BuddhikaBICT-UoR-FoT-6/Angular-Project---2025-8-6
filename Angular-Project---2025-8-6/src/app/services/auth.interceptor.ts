import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Prepend environment API URL if it's a relative /api call (fixes hardcoded paths)
  let finalUrl = req.url;
  if (finalUrl.startsWith('/api/')) {
    finalUrl = finalUrl.replace(/^\/api/, environment.apiUrl);
  }

  // Get the token from localStorage (only in browser)
  let token: string | null = null;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    token = localStorage.getItem('token');
  }

  // Clone the request and add the Authorization header if token exists
  // Also update the url to potentially rewritten absolute path
  const authReq = req.clone({
    url: finalUrl,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  // Handle the request and catch 401 errors
  const router = inject(Router);

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status === 401) {
        // Clear invalid token and redirect to login
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
        }
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
