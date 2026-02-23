import { Component, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { OtpInput } from '../../shared/otp-input/otp-input';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink, OtpInput],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  @ViewChild(OtpInput) otpComponent!: OtpInput;

  // Registration steps: 'form' -> 'otp' -> 'complete'
  currentStep = signal<'form' | 'otp' | 'complete'>('form');

  userData = {
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'customer',
    address: {
      country: '',
      nearestLargestCity: '',
      streetName: '',
      houseNo: ''
    }
  };

  profileImageFile: File | null = null;
  profileImagePreviewUrl: string | null = null;

  isLoading = false;
  error = '';
  success = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) { }

  onSubmit() {
    if (!this.userData.full_name || !this.userData.email || !this.userData.password) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (this.userData.password !== this.userData.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(this.userData.password)) {
      this.error = 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.';
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.success = '';

    // Step 1: Send OTP to email
    this.http.post(`${environment.apiUrl}/auth/send-registration-otp`, {
      email: this.userData.email,
      full_name: this.userData.full_name
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

  onVerifyOtp(otp: string) {
    this.error = '';

    // Step 2: Verify OTP and complete registration
    this.http.post(`${environment.apiUrl}/auth/verify-registration-otp`, {
      email: this.userData.email,
      otp: otp,
      password: this.userData.password,
      full_name: this.userData.full_name,
      phone: this.userData.phone,
      address: {
        country: this.userData.address.country,
        city: this.userData.address.nearestLargestCity,
        street: this.userData.address.streetName,
        houseNo: this.userData.address.houseNo
      }
    }).subscribe({
      next: (response: any) => {
        if (this.otpComponent) {
          this.otpComponent.resetVerifying();
        }

        // Store JWT token and user data
        if (response.token) {
          this.authService.setToken(response.token);
          this.authService.setCurrentUser({
            userId: response.user.userId,
            role: response.user.role,
            full_name: response.user.full_name,
            email: response.user.email
          });
        }

        // Optional: upload profile picture after account creation.
        if (this.profileImageFile) {
          const formData = new FormData();
          formData.append('image', this.profileImageFile);
          this.http.post('/api/users/me/profile-image', formData).subscribe({
            next: () => {
              // no-op
            },
            error: () => {
              // ignore upload errors; registration is still successful
            }
          });
        }

        this.router.navigate(['/registration-result'], {
          queryParams: {
            success: 'true',
            message: 'Registration successful! Welcome to Clothing Store.'
          }
        });
      },
      error: (error) => {
        if (this.otpComponent) {
          this.otpComponent.setError(error.error?.error || 'Invalid OTP. Please try again.');
        }
      }
    });
  }

  onProfileImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.profileImageFile = file;

    if (!file) {
      this.profileImagePreviewUrl = null;
      return;
    }

    this.profileImagePreviewUrl = URL.createObjectURL(file);
  }

  onResendOtp() {
    this.http.post(`${environment.apiUrl}/auth/send-registration-otp`, {
      email: this.userData.email,
      full_name: this.userData.full_name
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

  backToForm() {
    this.currentStep.set('form');
    this.error = '';
    this.success = '';
  }
}