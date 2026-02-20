import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { catchError, filter, map, switchMap, take, timeout } from 'rxjs/operators';
import { InventoryAuditEntry, InventoryItem, LowStockItem, StockBySize } from '../models/inventory.model';
import { FulfillRestockResponse, RestockRequest } from '../models/restock-request.model';
import { Supplier } from '../models/supplier.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Always use relative /api so dev proxy + SSR/prod behave consistently.
  private baseUrl = '/api';

  constructor(private http: HttpClient) { }

  // --- Health / readiness ---
  getHealth(): Observable<{ ok: boolean; dbReady: boolean }> {
    return this.http.get<any>(`${this.baseUrl}/health`).pipe(
      map((h) => ({
        ok: typeof h?.ok === 'boolean' ? h.ok : h?.status === 'ok',
        dbReady: typeof h?.dbReady === 'boolean' ? h.dbReady : h?.mongodb === 'connected'
      })),
      catchError(() => of({ ok: false, dbReady: false }))
    );
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
    return this.http.get<any[]>(`${this.baseUrl}/user`);
  }

  createUser(user: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/user`, user);
  }

  updateUser(id: string, user: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/user/${id}`, user);
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/user/${id}`);
  }

  // Product-related API calls
  getProducts(params?: {
    q?: string;
    category?: string;
    sub_category?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
    page?: number;
    limit?: number;
  }): Observable<any[]> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }
    return this.http.get<any[]>(`${this.baseUrl}/products`, { params: httpParams });
  }
  searchProducts(q: string, limit = 8): Observable<any[]> {
    const params = new HttpParams()
      .set('q', q || '')
      .set('limit', String(limit));
    return this.http.get<any[]>(`${this.baseUrl}/products/search`, { params });
  }

  getProductById(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/products/${id}`);
  }

  createProduct(product: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/products`, product);
  }

  updateProduct(id: string, product: any): Observable<any> {
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


  // Categories & Collections
  getCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories`);
  }

  getCollectionsByType(type: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/collections/type/${type}`);
  }

  getCollectionBySlug(slug: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/collections/slug/${slug}`);
  }

  // Admin Categories
  getAdminCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories/admin/all`);
  }

  createCategory(category: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/categories`, category);
  }

  updateCategory(id: string, category: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/categories/${id}`, category);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/categories/${id}`);
  }

  // Admin Collections
  getAdminCollections(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/collections/admin/all`);
  }

  createCollection(collection: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/collections`, collection);
  }

  updateCollection(id: string, collection: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/collections/${id}`, collection);
  }

  deleteCollection(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/collections/${id}`);
  }

  // Order-related API calls

  /**
   * Get all orders (Admin)
   */
  getOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders`);
  }

  /**
   * Get authenticated customer's orders
   */
  getMyOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders/my-orders`);
  }

  /**
   * Get single order by ID
   */
  getOrderById(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/orders/${id}`);
  }

  /**
   * Download invoice PDF for an order
   */
  downloadInvoice(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/orders/${id}/invoice`, { responseType: 'blob' });
  }

  /**
   * Update order status (Admin)
   */
  updateOrderStatus(id: string, status: string): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/orders/${id}/status`, { status });
  }

  /**
   * Process refund (Admin)
   */
  processRefund(id: string, reason: string, amount?: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders/${id}/refund`, { reason, amount });
  }

  /**
   * Cancel order (Customer)
   */
  cancelOrder(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders/${id}/cancel`, {});
  }

  /**
   * Request refund (Customer)
   */
  requestRefund(id: string, reason: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders/${id}/request-refund`, { reason });
  }


  refundOrder(orderId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders/${orderId}/refund`, {});
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


  // Analytics-related API calls
  // Analytics: sales trends (daily revenue)
  getSalesTrends(days = 30): Observable<Array<{ date: string; revenue: number; orders: number }>> {
    return this.http.get<Array<{ date: string; revenue: number; orders: number }>>(
      `${this.baseUrl}/analytics/sales-trends?days=${encodeURIComponent(String(days))}`
    );
  }

  // Suppliers
  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(`${this.baseUrl}/suppliers`);
  }

  getSupplier(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.baseUrl}/suppliers/${id}`);
  }

  createSupplier(data: Partial<Supplier>): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.baseUrl}/suppliers`, data);
  }

  updateSupplier(id: string, data: Partial<Supplier>): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.baseUrl}/suppliers/${id}`, data);
  }

  deleteSupplier(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/suppliers/${id}`);
  }

  // Global Inventory Audit Log
  getGlobalInventoryHistory(limit: number): Observable<InventoryAuditEntry[]> {
    return this.http.get<InventoryAuditEntry[]>(`${this.baseUrl}/inventory/audit-log?limit=${limit}`);
  }
}