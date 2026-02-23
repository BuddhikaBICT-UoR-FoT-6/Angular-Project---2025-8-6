import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

interface User {
  userId: string;
  role: string;
  full_name: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        this.currentUserSubject.next(JSON.parse(savedUser));
      }
    }
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post('/api/auth/login', { email, password });
  }

  register(userData: any): Observable<any> {
    return this.http.post('/api/auth/register', userData);
  }

  setCurrentUser(user: User) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    }
    this.currentUserSubject.next(user);
    // Don't auto-redirect here anymore, let login component handle it
  }

  setToken(token: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('token', token);
    }
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  logout() {
    // Attempt to blacklist the token on the server
    this.http.post('/api/auth/logout', {}).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession() // Even if server fails (e.g., token already invalid), clear local
    });
  }

  private clearSession() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('token');
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getCurrentUser();
  }

  private redirectToDashboard(role: string) {
    switch (role) {
      case 'superadmin':
        this.router.navigate(['/superadmin/dashboard']);
        break;
      case 'admin':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'customer':
        this.router.navigate(['/customer/dashboard']);
        break;
      default:
        this.router.navigate(['/']);
    }
  }
}