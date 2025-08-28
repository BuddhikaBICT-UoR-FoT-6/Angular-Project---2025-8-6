import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule],
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

  constructor(private authService: AuthService) {}

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
        this.success = 'Registration successful! Please login.';
        this.isLoading = false;
      },
      error: (error) => {
        this.error = error.error?.error || 'Registration failed';
        this.isLoading = false;
      }
    });
  }
}