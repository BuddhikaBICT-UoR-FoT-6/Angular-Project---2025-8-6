import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, Observable } from 'rxjs';

import { CartItem, CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import type { Size } from '../../models/inventory.model';

@Component({
  selector: 'app-cart',
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class Cart {
  readonly items$: Observable<CartItem[]>;
  readonly total$: Observable<number>;
  readonly availableSizes: Size[] = ['S', 'M', 'L', 'XL'];
  private readonly destroyRef = inject(DestroyRef);

  constructor(private cartService: CartService, private authService: AuthService, private toast: ToastService) {
    this.items$ = this.cartService.items$;
    this.total$ = this.items$.pipe(map((items) => this.cartService.getTotal(items)));
  }

  ngOnInit(): void {
    // Refresh immediately if logged in.
    if (this.authService.isLoggedIn()) {
      this.cartService.refresh().subscribe({
        error: (err) => {
          console.error('Cart: failed to load cart', err);
          this.toast.error('Unable to load your cart.');
        }
      });
    }

    // Refresh whenever the user logs in/out.
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        if (user) {
          this.cartService.refresh().subscribe({
            error: (err) => {
              console.error('Cart: failed to load cart after login', err);
              this.toast.error('Unable to load your cart.');
            }
          });
        }
      });
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  maxFor(item: CartItem): number {
    const stock = item?.stock?.[item.size];
    const max = Number(stock ?? 0);
    return Number.isFinite(max) && max > 0 ? max : 1;
  }

  canInc(item: CartItem): boolean {
    return item.quantity < this.maxFor(item);
  }

  onSizeChange(item: CartItem, raw: string): void {
    const nextSize = String(raw || '').toUpperCase() as Size;
    if (nextSize === item.size) return;
    if (!this.availableSizes.includes(nextSize)) return;

    const available = Number(item?.stock?.[nextSize] ?? 0);
    if (available <= 0) {
      this.toast.warning('That size is out of stock.');
      return;
    }

    const desiredQty = Math.max(1, Math.min(item.quantity, available));

    // Add new size first (so we don't lose the item if add fails), then remove old size.
    this.cartService.addItem(item.productId, nextSize, desiredQty).subscribe({
      next: () => {
        this.cartService.remove(item.productId, item.size).subscribe({
          next: () => this.toast.success('Size updated.'),
          error: (err) => {
            console.error('Cart: remove old size failed after size change', err);
            this.toast.error('Size updated, but cleanup failed. Refresh the cart.');
          }
        });
      },
      error: (err) => {
        console.error('Cart: size change failed', err);
        const msg = String(err?.error?.error || err?.error?.message || '').trim();
        this.toast.error(msg || 'Unable to change size.');
      }
    });
  }

  clear(): void {
    if (!this.isLoggedIn()) {
      this.toast.info('Please login to view your cart.');
      return;
    }
    this.cartService.clear().subscribe({
      next: () => this.toast.info('Cart cleared.'),
      error: (err) => {
        console.error('Cart: clear failed', err);
        this.toast.error('Unable to clear cart.');
      }
    });
  }

  remove(item: CartItem): void {
    if (!this.isLoggedIn()) {
      this.toast.info('Please login to view your cart.');
      return;
    }
    this.cartService.remove(item.productId, item.size).subscribe({
      next: () => this.toast.info('Removed from cart.'),
      error: (err) => {
        console.error('Cart: remove failed', err);
        this.toast.error('Unable to remove item.');
      }
    });
  }

  dec(item: CartItem): void {
    if (!this.isLoggedIn()) {
      this.toast.info('Please login to view your cart.');
      return;
    }
    this.cartService.updateQuantity(item.productId, item.size, item.quantity - 1).subscribe({
      error: (err) => {
        console.error('Cart: update quantity failed', err);
        this.toast.error('Unable to update quantity.');
      }
    });
  }

  inc(item: CartItem): void {
    if (!this.isLoggedIn()) {
      this.toast.info('Please login to view your cart.');
      return;
    }
    if (!this.canInc(item)) return;
    this.cartService.updateQuantity(item.productId, item.size, item.quantity + 1).subscribe({
      error: (err) => {
        console.error('Cart: update quantity failed', err);
        this.toast.error('Unable to update quantity.');
      }
    });
  }
}
