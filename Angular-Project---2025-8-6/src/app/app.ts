import { Component, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { Toast } from './shared/toast/toast';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import { ApiService } from './services/api.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-root',
  // Global imports for the root shell (nav + router outlet + toasts)
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, Toast, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('First_Project');
  sidebarCollapsed = true; // Start collapsed, show only on hover

  theme: 'dark' | 'light' = 'dark';
  private readonly THEME_KEY = 'theme';

  constructor(
    private authService: AuthService,
    private router: Router,
    private apiService: ApiService
  ) {
    this.initTheme();
  }

  private initTheme(): void {
    const saved = (localStorage.getItem(this.THEME_KEY) || '').toLowerCase();
    if (saved === 'light' || saved === 'dark') {
      this.setTheme(saved as 'light' | 'dark');
      return;
    }

    const prefersLight = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: light)').matches;

    this.setTheme(prefersLight ? 'light' : 'dark');
  }

  private setTheme(theme: 'dark' | 'light'): void {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.THEME_KEY, theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  }

  onSidebarMouseEnter() {
    this.sidebarCollapsed = false;
  }

  onSidebarMouseLeave() {
    this.sidebarCollapsed = true;
  }

  isAdminRoute(): boolean {
    const url = this.router.url || '';
    return url.startsWith('/admin') || url.startsWith('/superadmin');
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  getCurrentUser() {
    return this.authService.getCurrentUser();
  }

  getCurrentRole(): string {
    return this.getCurrentUser()?.role || '';
  }

  isAdmin(): boolean {
    return this.getCurrentRole() === 'admin';
  }

  isSuperAdmin(): boolean {
    return this.getCurrentRole() === 'superadmin';
  }

  isCustomer(): boolean {
    return this.getCurrentRole() === 'customer';
  }

  // Home page is the Showroom; don't show the CTA there.
  isShowroomRoute(): boolean {
    const url = this.router.url || '';
    return url === '/' || url.startsWith('/?');
  }

  logout() {
    this.authService.logout();
  }

  getDashboardRoute(): string {
    const role = this.getCurrentRole();
    switch (role) {
      case 'superadmin':
        return '/superadmin/dashboard';
      case 'admin':
        return '/admin/dashboard';
      case 'customer':
        return '/customer/dashboard';
      default:
        return '/';
    }
  }

  getSidebarDashboardRoute(): string {
    const url = this.router.url || '';
    if (url.startsWith('/admin')) return '/admin/dashboard';
    if (url.startsWith('/superadmin')) return '/superadmin/dashboard';
    return this.getDashboardRoute();
  }

  searchControl = new FormControl('', { nonNullable: true });
  searchOpen = false;

  searchResults$ = this.searchControl.valueChanges.pipe(
    startWith(this.searchControl.value),
    debounceTime(200),
    distinctUntilChanged(),
    switchMap((raw) => {
      const q = (raw || '').trim();
      if (q.length < 2) return of([]);
      return this.apiService.searchProducts(q, 8).pipe(catchError(() => of([])));
    })
  );

  openSearch(): void {
    this.searchOpen = true;
  }

  closeSearch(): void {
    this.searchOpen = false;
  }

  goToProduct(id: string): void {
    this.closeSearch();
    this.searchControl.setValue('', { emitEvent: false });
    this.router.navigate(['/product', id]);
  }
  
}
