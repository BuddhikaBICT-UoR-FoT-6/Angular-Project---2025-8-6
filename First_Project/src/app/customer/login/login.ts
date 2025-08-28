import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = '';
  password = '';
  isLoading = false;
  error = '';

  constructor(private authService: AuthService) {}

  onSubmit() {
    if (!this.email || !this.password) {
      this.error = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.authService.setCurrentUser({
          userId: response.userId,
          role: response.role,
          full_name: response.user.full_name,
          email: response.user.email
        });
      },
      error: (error) => {
        this.error = error.error?.error || 'Login failed';
        this.isLoading = false;
      }
    });
  }
}