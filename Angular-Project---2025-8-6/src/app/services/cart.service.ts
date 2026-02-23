import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { catchError, map, of, tap, throwError } from 'rxjs';
import type { Product } from '../models/product.model';
import type { Size, StockBySize } from '../models/inventory.model';

export interface CartItem {
  productId: string;
  name: string;
  imageUrl?: string;
  unitPrice: number;
  size: Size;
  quantity: number;
  stock?: StockBySize;
}

interface CartResponse {
  items: CartItem[];
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly itemsSubject = new BehaviorSubject<CartItem[]>([]);
  readonly items$ = this.itemsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getItemsSnapshot(): CartItem[] {
    return this.itemsSubject.value;
  }

  getTotal(items: CartItem[] = this.itemsSubject.value): number {
    return (items || []).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  refresh() {
    return this.http.get<CartResponse>('/api/cart').pipe(
      map((res) => res?.items ?? []),
      tap((items) => this.itemsSubject.next(items)),
      catchError((err) => {
        // If not logged in, API will 401; treat as empty cart.
        if (err?.status === 401) {
          this.itemsSubject.next([]);
          return of([]);
        }
        return throwError(() => err);
      })
    );
  }

  clear() {
    return this.http.delete<CartResponse>('/api/cart').pipe(
      map((res) => res?.items ?? []),
      tap((items) => this.itemsSubject.next(items))
    );
  }

  remove(productId: string, size: Size) {
    return this.http
      .request<CartResponse>('delete', '/api/cart/items', { body: { productId, size } })
      .pipe(
        map((res) => res?.items ?? []),
        tap((items) => this.itemsSubject.next(items))
      );
  }

  updateQuantity(productId: string, size: Size, quantity: number) {
    const safeQty = Math.max(1, Math.floor(quantity || 1));
    return this.http.put<CartResponse>('/api/cart/items', { productId, size, quantity: safeQty }).pipe(
      map((res) => res?.items ?? []),
      tap((items) => this.itemsSubject.next(items))
    );
  }

  addProduct(product: Product, size: Size, quantity: number) {
    const safeQty = Math.max(1, Math.floor(quantity || 1));
    return this.http.post<CartResponse>('/api/cart/items', { productId: product._id, size, quantity: safeQty }).pipe(
      map((res) => res?.items ?? []),
      tap((items) => this.itemsSubject.next(items))
    );
  }

  addItem(productId: string, size: Size, quantity: number) {
    const safeQty = Math.max(1, Math.floor(quantity || 1));
    return this.http.post<CartResponse>('/api/cart/items', { productId, size, quantity: safeQty }).pipe(
      map((res) => res?.items ?? []),
      tap((items) => this.itemsSubject.next(items))
    );
  }
}
