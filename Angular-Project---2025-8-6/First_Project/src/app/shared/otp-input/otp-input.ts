import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-otp-input',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="otp-container">
      <h3>{{ title }}</h3>
      <p class="otp-description">{{ description }}</p>
      
      <div class="otp-input-group">
        <input
          *ngFor="let digit of otpDigits; let i = index"
          #otpInput
          type="text"
          maxlength="1"
          class="otp-digit"
          [(ngModel)]="otpDigits[i]"
          (input)="onDigitInput($event, i)"
          (keydown)="onKeyDown($event, i)"
          (paste)="onPaste($event)"
          [attr.data-index]="i"
          inputmode="numeric"
          pattern="[0-9]"
        />
      </div>

      <div *ngIf="error" class="error-message">{{ error }}</div>
      
      <div class="otp-timer" *ngIf="timeRemaining > 0">
        ⏱️ Code expires in {{ formatTime(timeRemaining) }}
      </div>

      <div class="otp-actions">
        <button 
          class="verify-btn" 
          [disabled]="isVerifying || !isOtpComplete()"
          (click)="handleVerify()"
        >
          {{ isVerifying ? 'Verifying...' : 'Verify OTP' }}
        </button>
        
        <button 
          class="resend-btn" 
          [disabled]="canResend === false"
          (click)="handleResend()"
        >
          {{ canResend ? 'Resend OTP' : 'Resend in ' + resendTimer + 's' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .otp-container {
      max-width: 400px;
      margin: 0 auto;
      padding: 30px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h3 {
      text-align: center;
      margin-bottom: 10px;
      color: #333;
    }

    .otp-description {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }

    .otp-input-group {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
    }

    .otp-digit {
      width: 50px;
      height: 60px;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      border: 2px solid #ddd;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .otp-digit:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .error-message {
      color: #e74c3c;
      text-align: center;
      margin-bottom: 15px;
      font-size: 14px;
    }

    .otp-timer {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
    }

    .otp-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .verify-btn, .resend-btn {
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .verify-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .verify-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .verify-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .resend-btn {
      background: transparent;
      color: #667eea;
      border: 2px solid #667eea;
    }

    .resend-btn:hover:not(:disabled) {
      background: #667eea;
      color: white;
    }

    .resend-btn:disabled {
      color: #ccc;
      border-color: #ccc;
      cursor: not-allowed;
    }
  `]
})
export class OtpInput {
  @Input() title = 'Enter Verification Code';
  @Input() description = 'We sent a 6-digit code to your email';
  @Input() expirySeconds = 600; // 10 minutes
  @Input() resendDelay = 60; // 60 seconds before can resend

  @Output() verify = new EventEmitter<string>();
  @Output() resend = new EventEmitter<void>();

  otpDigits: string[] = ['', '', '', '', '', ''];
  error = '';
  isVerifying = false;
  timeRemaining = this.expirySeconds;
  canResend = false;
  resendTimer = this.resendDelay;

  private expiryInterval: any;
  private resendInterval: any;

  ngOnInit() {
    this.startExpiryTimer();
    this.startResendTimer();
  }

  ngOnDestroy() {
    if (this.expiryInterval) clearInterval(this.expiryInterval);
    if (this.resendInterval) clearInterval(this.resendInterval);
  }

  onDigitInput(event: any, index: number) {
    const value = event.target.value;
    
    // Only allow numbers
    if (value && !/^\d$/.test(value)) {
      this.otpDigits[index] = '';
      return;
    }

    // Move to next input if digit entered
    if (value && index < 5) {
      const nextInput = document.querySelector(`input[data-index="${index + 1}"]`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }

    // Auto-verify when all digits entered
    if (this.isOtpComplete()) {
      this.error = '';
    }
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    // Handle backspace
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      const prevInput = document.querySelector(`input[data-index="${index - 1}"]`) as HTMLInputElement;
      if (prevInput) {
        prevInput.focus();
        this.otpDigits[index - 1] = '';
      }
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    
    for (let i = 0; i < digits.length; i++) {
      this.otpDigits[i] = digits[i];
    }

    // Focus last filled input
    const lastIndex = Math.min(digits.length, 5);
    const lastInput = document.querySelector(`input[data-index="${lastIndex}"]`) as HTMLInputElement;
    if (lastInput) lastInput.focus();
  }

  isOtpComplete(): boolean {
    return this.otpDigits.every(digit => digit !== '');
  }

  handleVerify() {
    if (!this.isOtpComplete()) {
      this.error = 'Please enter all 6 digits';
      return;
    }

    this.isVerifying = true;
    this.error = '';
    const otp = this.otpDigits.join('');
    this.verify.emit(otp);
  }

  handleResend() {
    if (!this.canResend) return;
    
    this.otpDigits = ['', '', '', '', '', ''];
    this.error = '';
    this.timeRemaining = this.expirySeconds;
    this.canResend = false;
    this.resendTimer = this.resendDelay;
    
    this.startResendTimer();
    this.resend.emit();
  }

  resetVerifying() {
    this.isVerifying = false;
  }

  setError(message: string) {
    this.error = message;
    this.isVerifying = false;
  }

  private startExpiryTimer() {
    this.expiryInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        clearInterval(this.expiryInterval);
        this.error = 'OTP has expired. Please request a new one.';
      }
    }, 1000);
  }

  private startResendTimer() {
    this.resendInterval = setInterval(() => {
      this.resendTimer--;
      if (this.resendTimer <= 0) {
        clearInterval(this.resendInterval);
        this.canResend = true;
      }
    }, 1000);
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
