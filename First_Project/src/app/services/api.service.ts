import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // All API calls go through Angular's dev proxy (see proxy.conf.json)
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  // User-related API calls
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/users`);
  }

  createUser(user: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/users`, user);
  }

  updateUser(id: string, user: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/users/${id}`, user);
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/users/${id}`);
  }

  // Product-related API calls
  getProducts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/products`);
  }

  getProductById(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/products/${id}`);
  }

  createProduct(product: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/products`, product);
  }

  updateProduct(id: string, product: any):Observable<any> {
    // Update existing product by MongoDB _id
    return this.http.put<any>(`${this.baseUrl}/products/${id}`, product);
  }

  deleteProduct(id: string): Observable<any> { 
    return this.http.delete<any>(`${this.baseUrl}/products/${id}`);
  }

  // Upload product images to Cloudinary (through backend)
  uploadImages(files: File[]): Observable<{ urls: string[] }> {
    const formData = new FormData();
    for (const f of files) formData.append('images', f);
    return this.http.post<{ urls: string[] }>(`${this.baseUrl}/uploads/images`, formData);
  }

  // Export products as CSV (download)
  exportProductsCsv(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/products/export/csv`, { responseType: 'blob' });
  }

  // Import products from CSV (upload + upsert)
  importProductsCsv(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.baseUrl}/products/import/csv`, formData);
  }


  // Order-related API calls
  getOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders`);
  }

  // Inventory-related API calls
  getInventory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/inventory`);
  }

  // Financial-related API calls
  getFinancials(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/financials`);
  }
}