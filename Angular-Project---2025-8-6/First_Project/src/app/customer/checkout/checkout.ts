import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { CheckoutService, type CheckoutSummary, type PaymentMethod, type ShippingAddress } from '../../services/checkout.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-checkout',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class Checkout {
  loading = true;
  errorMessage = '';

  summary: CheckoutSummary | null = null;

  couponCode = '';
  couponApplied = '';

  paymentMethod: PaymentMethod = 'credit_card';

  shipping: ShippingAddress = {
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  };

  placingOrder = false;
  confirmation: null | { orderId: string; total: number } = null;

  otpCode = '';
  otpSending = false;
  otpVerifying = false;
  otpVerified = false;
  checkoutToken = '';

  private readonly OTP_TOKEN_KEY = 'checkoutOtpToken';
  private readonly OTP_VERIFIED_KEY = 'checkoutOtpVerified';

  constructor(
    private auth: AuthService,
    private checkout: CheckoutService,
    private route: ActivatedRoute,
    private toast: ToastService
  ) { }

  isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  ngOnInit(): void {
    this.checkoutToken = sessionStorage.getItem(this.OTP_TOKEN_KEY) || '';
    this.otpVerified = sessionStorage.getItem(this.OTP_VERIFIED_KEY) === 'true';

    this.route.queryParamMap.subscribe((qp) => {
      const status = qp.get('status');
      const sessionId = qp.get('session_id');
      const token = qp.get('token');

      if (status === 'success' && sessionId) {
        // Stripe success redirect
        this.confirmAfterProviderReturn('credit_card', sessionId);
      } else if (status === 'paypal_success' && token) {
        // PayPal success redirect (token = orderId)
        this.confirmAfterProviderReturn('paypal', token);
      }
    });

    this.refreshSummary();
  }

  sendOtp(): void {
    if (!this.isLoggedIn()) {
      this.toast.error('Please login to request OTP.');
      return;
    }

    this.otpSending = true;
    this.checkout.sendOtp().subscribe({
      next: (r) => {
        this.otpSending = false;
        this.checkoutToken = r.checkoutToken;
        this.otpVerified = false;
        sessionStorage.setItem(this.OTP_TOKEN_KEY, this.checkoutToken);
        sessionStorage.removeItem(this.OTP_VERIFIED_KEY);
        this.toast.success(r?.message || 'OTP sent. Please check your email.');
      },
      error: (err) => {
        this.otpSending = false;
        const msg = err?.error?.error || 'Failed to send OTP.';
        this.toast.error(msg);
      }
    });
  }

  verifyOtp(): void {
    if (!this.isLoggedIn()) {
      this.toast.error('Please login to verify OTP.');
      return;
    }

    const otp = (this.otpCode || '').trim();
    if (!otp) {
      this.toast.error('Enter the OTP code.');
      return;
    }
    if (!this.checkoutToken) {
      this.toast.error('Request an OTP first.');
      return;
    }

    this.otpVerifying = true;
    this.checkout.verifyOtp({ otp, checkoutToken: this.checkoutToken }).subscribe({
      next: (r) => {
        this.otpVerifying = false;
        this.otpVerified = true;
        sessionStorage.setItem(this.OTP_VERIFIED_KEY, 'true');
        this.toast.success(r?.message || 'OTP verified. You can place the order now.');
      },
      error: (err) => {
        this.otpVerifying = false;
        const msg = err?.error?.error || 'Failed to verify OTP.';
        this.toast.error(msg);
      }
    });
  }

  refreshSummary(): void {
    this.loading = true;
    this.errorMessage = '';

    this.checkout.getSummary(this.couponApplied || undefined).subscribe({
      next: (s) => {
        this.summary = s;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.summary = null;
        this.errorMessage = err?.error?.error || 'Unable to load checkout summary.';
      }
    });
  }

  applyCoupon(): void {
    const code = (this.couponCode || '').trim();
    if (!code) {
      this.couponApplied = '';
      this.refreshSummary();
      return;
    }

    this.couponApplied = code;
    this.refreshSummary();
  }

  private validateShipping(): string {
    if (!this.shipping.line1.trim()) return 'Address line 1 is required.';
    if (!this.shipping.city.trim()) return 'City is required.';
    if (!this.shipping.country.trim()) return 'Country is required.';

    // Validate phone if present
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    if (this.shipping.phone && !phoneRegex.test(this.shipping.phone)) {
      return 'Invalid phone number format.';
    }

    return '';
  }

  placeOrder(): void {
    if (!this.isLoggedIn()) {
      this.toast.error('Please login to checkout.');
      return;
    }

    if (!this.summary || this.summary.items.length === 0) {
      this.toast.error('Your cart is empty.');
      return;
    }

    const shipErr = this.validateShipping();
    if (shipErr) {
      this.toast.error(shipErr);
      return;
    }

    if (!this.otpVerified || !this.checkoutToken) {
      this.toast.error('OTP verification is required to checkout.');
      return;
    }

    this.placingOrder = true;
    this.errorMessage = '';

    const couponCode = this.couponApplied || undefined;

    if (this.paymentMethod === 'cash_on_delivery') {
      this.checkout
        .confirm({ paymentMethod: 'cash_on_delivery', shippingAddress: this.shipping, couponCode, checkoutToken: this.checkoutToken })
        .subscribe({
          next: (r) => {
            this.placingOrder = false;
            this.confirmation = { orderId: r.orderId, total: r.total };
            this.toast.success('Order placed successfully.');
            sessionStorage.removeItem(this.OTP_TOKEN_KEY);
            sessionStorage.removeItem(this.OTP_VERIFIED_KEY);
            this.checkoutToken = '';
            this.otpVerified = false;
            this.otpCode = '';
            this.refreshSummary();
          },
          error: (err) => {
            this.placingOrder = false;
            this.errorMessage = err?.error?.error || 'Failed to place order.';
            this.toast.error(this.errorMessage);
          }
        });
      return;
    }

    if (this.paymentMethod === 'credit_card') {
      this.checkout.createStripeSession({ shippingAddress: this.shipping, couponCode, checkoutToken: this.checkoutToken }).subscribe({
        next: (r) => {
          this.placingOrder = false;
          if (r.url) window.location.href = r.url;
          else this.toast.error('Stripe did not return a redirect URL.');
        },
        error: (err) => {
          this.placingOrder = false;
          this.errorMessage = err?.error?.error || 'Failed to start Stripe checkout.';
          this.toast.error(this.errorMessage);
        }
      });
      return;
    }

    // PayPal
    this.checkout.createPayPalOrder({ shippingAddress: this.shipping, couponCode, checkoutToken: this.checkoutToken }).subscribe({
      next: (r) => {
        this.placingOrder = false;
        if (r.approvalUrl) window.location.href = r.approvalUrl;
        else this.toast.error('PayPal did not return an approval URL.');
      },
      error: (err) => {
        this.placingOrder = false;
        this.errorMessage = err?.error?.error || 'Failed to start PayPal checkout.';
        this.toast.error(this.errorMessage);
      }
    });
  }

  private confirmAfterProviderReturn(method: PaymentMethod, providerRef: string): void {
    if (!this.isLoggedIn()) return;

    const token = sessionStorage.getItem(this.OTP_TOKEN_KEY) || this.checkoutToken;
    if (!token) {
      this.errorMessage = 'OTP verification is required to confirm your order.';
      return;
    }

    this.placingOrder = true;
    this.checkout.confirm({ paymentMethod: method, providerRef, checkoutToken: token }).subscribe({
      next: (r) => {
        this.placingOrder = false;
        this.confirmation = { orderId: r.orderId, total: r.total };
        this.toast.success('Payment confirmed and order created.');
        sessionStorage.removeItem(this.OTP_TOKEN_KEY);
        sessionStorage.removeItem(this.OTP_VERIFIED_KEY);
        this.checkoutToken = '';
        this.otpVerified = false;
        this.otpCode = '';
        this.refreshSummary();
      },
      error: (err) => {
        this.placingOrder = false;
        this.errorMessage = err?.error?.error || 'Unable to confirm payment.';
        this.toast.error(this.errorMessage);
      }
    });
  }
}
