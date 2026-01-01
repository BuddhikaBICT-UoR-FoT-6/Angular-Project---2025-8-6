import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = '';
  password = '';
  isLoading = false;
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.error = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        // Store JWT token using auth service
        if (response.token) {
          this.authService.setToken(response.token);
        }
        
        this.authService.setCurrentUser({
          userId: response.user.userId,
          role: response.user.role,
          full_name: response.user.full_name,
          email: response.user.email
        });
        
        // Redirect to success page instead of direct dashboard
        this.router.navigate(['/login-result'], {
          queryParams: {
            success: 'true',
            message: `Welcome back, ${response.user.full_name}! Login successful.`,
            role: response.user.role
          }
        });
      },
      error: (error) => {
        const errorMessage = error.error?.error || 'Login failed. Please check your credentials.';
        this.router.navigate(['/login-result'], {
          queryParams: {
            success: 'false',
            message: 'Login Unsuccessful! Please check your credentials and try again.'
          }
        });
      }
    });
  }
}