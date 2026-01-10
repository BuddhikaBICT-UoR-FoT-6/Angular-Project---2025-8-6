import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private baseUrl = '/api/user';

  constructor(private http: HttpClient) {}

  getProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/me`);
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/me/profile`, data);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/me/password`, { currentPassword, newPassword });
  }

  getAddresses(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/me/addresses`);
  }

  addAddress(address: any): Observable<any[]> {
    return this.http.post<any[]>(`${this.baseUrl}/me/addresses`, address);
  }

  updateAddress(addressId: string, address: any): Observable<any[]> {
    return this.http.put<any[]>(`${this.baseUrl}/me/addresses/${addressId}`, address);
  }

  deleteAddress(addressId: string): Observable<any[]> {
    return this.http.delete<any[]>(`${this.baseUrl}/me/addresses/${addressId}`);
  }

  getPaymentMethods(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/me/payment-methods`);
  }

  addPaymentMethod(method: any): Observable<any[]> {
    return this.http.post<any[]>(`${this.baseUrl}/me/payment-methods`, method);
  }

  deletePaymentMethod(methodId: string): Observable<any[]> {
    return this.http.delete<any[]>(`${this.baseUrl}/me/payment-methods/${methodId}`);
  }

  getEmailPreferences(): Observable<any> {
    return this.http.get(`${this.baseUrl}/me/email-preferences`);
  }

  updateEmailPreferences(preferences: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/me/email-preferences`, preferences);
  }
}
