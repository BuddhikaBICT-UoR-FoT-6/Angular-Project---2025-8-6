import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  userData = {
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'customer'
  };
  isLoading = false;
  error = '';
  success = '';

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit() {
    if (!this.userData.full_name || !this.userData.email || !this.userData.password) {
      this.error = 'Please fill in all required fields';
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.success = '';

    this.authService.register(this.userData).subscribe({
      next: (response) => {
        this.router.navigate(['/registration-result'], {
          queryParams: {
            success: 'true',
            message: 'Registration successful! You can now login with your credentials.'
          }
        });
      },
      error: (error) => {
        const errorMessage = error.error?.error || 'Registration failed. Please try again.';
        this.router.navigate(['/registration-result'], {
          queryParams: {
            success: 'false',
            message: 'Registration Unsuccessful! Only one email can have one account!.'
          }
        });
      }
    });
  }
}