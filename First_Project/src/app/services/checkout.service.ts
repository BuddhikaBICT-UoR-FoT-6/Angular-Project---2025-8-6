import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type PaymentMethod = 'credit_card' | 'paypal' | 'cash_on_delivery';

export interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CheckoutItem {
  productId: string;
  name: string;
  size: 'S' | 'M' | 'L' | 'XL';
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

export interface CheckoutSummary {
  items: CheckoutItem[];
  subtotal: number;
  discount: number;
  total: number;
  coupon: null | { code: string; type: 'percent' | 'fixed'; amount: number };
}

export interface CheckoutOtpSendResponse {
  success: boolean;
  message: string;
  expiresIn: number;
  checkoutToken: string;
}

export interface CheckoutOtpVerifyResponse {
  success: boolean;
  message: string;
  checkoutToken: string;
  attemptsLeft?: number;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  constructor(private http: HttpClient) {}

  getSummary(couponCode?: string): Observable<CheckoutSummary> {
    let params = new HttpParams();
    if (couponCode) params = params.set('coupon', couponCode);
    return this.http.get<CheckoutSummary>('/api/checkout/summary', { params });
  }

  validateCoupon(code: string, subtotal: number): Observable<{ valid: boolean; code: string; discount: number; total: number }>{
    return this.http.post<{ valid: boolean; code: string; discount: number; total: number }>('/api/checkout/validate-coupon', {
      code,
      subtotal
    });
  }

  sendOtp(): Observable<CheckoutOtpSendResponse> {
    return this.http.post<CheckoutOtpSendResponse>('/api/checkout/send-otp', {});
  }

  verifyOtp(payload: { otp: string; checkoutToken: string }): Observable<CheckoutOtpVerifyResponse> {
    return this.http.post<CheckoutOtpVerifyResponse>('/api/checkout/verify-otp', payload);
  }

  createStripeSession(payload: { shippingAddress: ShippingAddress; couponCode?: string; checkoutToken: string }): Observable<{ provider: 'stripe'; providerRef: string; url: string }>{
    return this.http.post<{ provider: 'stripe'; providerRef: string; url: string }>('/api/checkout/stripe/create-session', payload);
  }

  createPayPalOrder(payload: { shippingAddress: ShippingAddress; couponCode?: string; checkoutToken: string }): Observable<{ provider: 'paypal'; providerRef: string; approvalUrl?: string }>{
    return this.http.post<{ provider: 'paypal'; providerRef: string; approvalUrl?: string }>('/api/checkout/paypal/create-order', payload);
  }

  confirm(payload: {
    paymentMethod: PaymentMethod;
    providerRef?: string;
    shippingAddress?: ShippingAddress;
    couponCode?: string;
    checkoutToken: string;
  }): Observable<{ ok: boolean; orderId: string; total: number; provider?: string }>{
    return this.http.post<{ ok: boolean; orderId: string; total: number; provider?: string }>('/api/checkout/confirm', payload);
  }
}
