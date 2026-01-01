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

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

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
