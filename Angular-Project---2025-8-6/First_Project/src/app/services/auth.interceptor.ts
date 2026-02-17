import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Get the token from localStorage (only in browser)
  let token: string | null = null;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    token = localStorage.getItem('token');
  }

  // Clone the request and add the Authorization header if token exists
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

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
