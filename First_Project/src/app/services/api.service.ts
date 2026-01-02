import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, filter, map, of, switchMap, take, timeout, timer } from 'rxjs';
import { InventoryAuditEntry, InventoryItem, LowStockItem, StockBySize } from '../models/inventory.model';
import { FulfillRestockResponse, RestockRequest } from '../models/restock-request.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Always use relative /api so dev proxy + SSR/prod behave consistently.
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  // --- Health / readiness ---
  getHealth(): Observable<{ ok: boolean; dbReady: boolean }> {
    return this.http.get<{ ok: boolean; dbReady: boolean }>(`${this.baseUrl}/health`);
  }

  // Wait until the backend reports MongoDB is ready.
  // This prevents "infinite loading" on first page load while the DB is still connecting.
  waitForDbReady(maxWaitMs = 120000): Observable<void> {
    return timer(0, 1000).pipe(
      switchMap(() =>
        this.getHealth().pipe(
          catchError(() => of({ ok: false, dbReady: false }))
        )
      ),
      filter((h) => !!h.dbReady),
      take(1),
      timeout({ first: maxWaitMs }),
      map(() => void 0)
    );
  }

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

  // GET /api/inventory
  getInventory(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.baseUrl}/inventory`);
  }

  // GET /api/inventory/low-stock
  getLowStockInventory(): Observable<LowStockItem[]> {
    return this.http.get<LowStockItem[]>(`${this.baseUrl}/inventory/low-stock`);
  }

  // POST /api/inventory/:id/restock
  // Payload: { add: {S,M,L,XL}, supplier?: string, supplier_email?: string, note?: string }
  restockInventory(
    inventoryId: string,
    payload: { add: Partial<StockBySize>; supplier?: string; supplier_email?: string; note?: string }
  ): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.baseUrl}/inventory/${inventoryId}/restock`, payload);
  }

  // POST /api/inventory/:id/adjust
  // Payload: { delta: {S,M,L,XL}, reason: string }
  adjustInventory(
    inventoryId: string,
    payload: { delta: Partial<StockBySize>; reason: string }
  ): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.baseUrl}/inventory/${inventoryId}/adjust`, payload);
  }

  // GET /api/inventory/:id/history?limit=50
  getInventoryHistory(inventoryId: string, limit = 50): Observable<InventoryAuditEntry[]> {
    return this.http.get<InventoryAuditEntry[]>(
      `${this.baseUrl}/inventory/${inventoryId}/history?limit=${encodeURIComponent(String(limit))}`
    );
  }

  // Restock request workflow (supplier fulfillment via 7-day code)
  createRestockRequest(payload: {
    inventoryId: string;
    requested_by_size: Partial<StockBySize>;
    supplier_name?: string;
    supplier_email?: string;
    note?: string;
  }): Observable<RestockRequest> {
    return this.http.post<RestockRequest>(`${this.baseUrl}/restock-requests`, payload);
  }

  listRestockRequests(status: 'pending' | 'fulfilled' | 'all' = 'all', limit = 50): Observable<RestockRequest[]> {
    return this.http.get<RestockRequest[]>(
      `${this.baseUrl}/restock-requests?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(String(limit))}`
    );
  }

  getMyRestockRequests(): Observable<RestockRequest[]> {
    return this.http.get<RestockRequest[]>(`${this.baseUrl}/restock-requests/my`);
  }

  fulfillRestockRequest(code: string): Observable<FulfillRestockResponse> {
    return this.http.post<FulfillRestockResponse>(`${this.baseUrl}/restock-requests/fulfill`, { code });
  }

  listRestockRequestsForInventory(
    inventoryId: string,
    status: 'pending' | 'fulfilled' | 'cancelled' | 'expired' | 'all' = 'all',
    limit = 50
  ): Observable<RestockRequest[]> {
    return this.http.get<RestockRequest[]>(
      `${this.baseUrl}/restock-requests?inventoryId=${encodeURIComponent(inventoryId)}&status=${encodeURIComponent(
        status
      )}&limit=${encodeURIComponent(String(limit))}`
    );
  }

  cancelRestockRequest(
    requestId: string,
    reason = ''
  ): Observable<{ success: boolean; request: RestockRequest; emailStatus?: { attempted?: boolean; success?: boolean; skipped?: boolean; error?: string } }> {
    return this.http.post<{ success: boolean; request: RestockRequest; emailStatus?: { attempted?: boolean; success?: boolean; skipped?: boolean; error?: string } }>(
      `${this.baseUrl}/restock-requests/${requestId}/cancel`,
      { reason }
    );
  }

  // Financial-related API calls
  getFinancials(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/financials`);
  }
}