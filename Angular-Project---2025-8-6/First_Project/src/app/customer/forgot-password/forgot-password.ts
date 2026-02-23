import { Component, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { OtpInput } from '../../shared/otp-input/otp-input';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule, RouterLink, OtpInput],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  @ViewChild(OtpInput) otpComponent!: OtpInput;

  // Steps: 'email' -> 'otp' -> 'reset'
  currentStep = signal<'email' | 'otp' | 'reset'>('email');

  email = '';
  otp = '';
  newPassword = '';
  confirmPassword = '';
  resetToken = '';

  isLoading = false;
  error = '';
  success = '';

  constructor(
    private router: Router,
    private http: HttpClient
  ) { }

  // Step 1: Request OTP
  onRequestOtp() {
    if (!this.email) {
      this.error = 'Please enter your email address';
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.success = '';

    this.http.post('/api/auth/forgot-password', {
      email: this.email
    }).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.currentStep.set('otp');
        this.success = 'Verification code sent to your email!';
      },
      error: (error) => {
        this.isLoading = false;
        this.error = error.error?.error || 'Failed to send verification code. Please try again.';
      }
    });
  }

  // Step 2: Verify OTP
  onVerifyOtp(otp: string) {
    this.error = '';

    this.http.post('/api/auth/verify-reset-otp', {
      email: this.email,
      otp: otp
    }).subscribe({
      next: (response: any) => {
        if (this.otpComponent) {
          this.otpComponent.resetVerifying();
        }

        this.resetToken = response.resetToken;
        this.currentStep.set('reset');
        this.success = 'OTP verified! Now set your new password.';
      },
      error: (error) => {
        if (this.otpComponent) {
          this.otpComponent.setError(error.error?.error || 'Invalid OTP. Please try again.');
        }
      }
    });
  }

  // Step 3: Reset password
  onResetPassword() {
    if (!this.newPassword || !this.confirmPassword) {
      this.error = 'Please fill in all fields';
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(this.newPassword)) {
      this.error = 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.http.post('/api/auth/reset-password', {
      resetToken: this.resetToken,
      newPassword: this.newPassword
    }).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.router.navigate(['/login'], {
          queryParams: {
            message: 'Password reset successful! You can now login with your new password.'
          }
        });
      },
      error: (error) => {
        this.isLoading = false;
        this.error = error.error?.error || 'Failed to reset password. Please try again.';
      }
    });
  }

  onResendOtp() {
    this.http.post('/api/auth/forgot-password', {
      email: this.email
    }).subscribe({
      next: (response: any) => {
        this.success = 'New verification code sent!';
        setTimeout(() => this.success = '', 3000);
      },
      error: (error) => {
        this.error = error.error?.error || 'Failed to resend code. Please try again.';
      }
    });
  }

  backToEmail() {
    this.currentStep.set('email');
    this.error = '';
    this.success = '';
  }

  backToOtp() {
    this.currentStep.set('otp');
    this.error = '';
    this.success = '';
  }
}
