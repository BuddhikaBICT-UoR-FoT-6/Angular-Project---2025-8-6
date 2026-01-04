import { Component, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { Toast } from './shared/toast/toast';

@Component({
  selector: 'app-root',
  // Global imports for the root shell (nav + router outlet + toasts)
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, Toast],
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
    private router: Router
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
}
