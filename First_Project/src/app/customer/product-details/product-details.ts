import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, delay, of, switchMap } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { ReviewService } from '../../services/review.service';
import { ToastService } from '../../shared/toast/toast.service';
import type { Product } from '../../models/product.model';
import { isSize } from '../../models/product.model';
import type { Size, StockBySize } from '../../models/inventory.model';
import type { Review } from '../../models/review.model';

@Component({
  selector: 'app-product-details',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css'
})
export class ProductDetails {

  loading = true;
  errorMessage = '';

  product: Product | null = null;
  selectedImageUrl = '';

  availableSizes: Size[] = ['S', 'M', 'L', 'XL'];
  selectedSize: Size | null = null;
  quantity = 1;

  showSizeGuide = false;

  relatedProducts: Product[] = [];

  reviews: Review[] = [];
  averageRating = 0;
  newReviewRating: 1 | 2 | 3 | 4 | 5 = 5;
  newReviewComment = '';

  zoomActive = false;
  zoomX = 50;
  zoomY = 50;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private cartService: CartService,
    private reviewService: ReviewService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          if (!id) {
            this.loading = false;
            this.errorMessage = 'Missing product id.';
            return of(null);
          }

          this.loading = true;
          this.errorMessage = '';
          this.product = null;
          this.relatedProducts = [];
          this.selectedSize = null;
          this.quantity = 1;

          return this.apiService.waitForDbReady(120000).pipe(
            delay(150),
            switchMap(() => this.apiService.getProductById(id)),
            catchError((err) => {
              console.error('ProductDetails: failed to load product', err);
              this.errorMessage = 'Unable to load product details. Please try again.';
              return of(null);
            })
          );
        })
      )
      .subscribe((product) => {
        this.loading = false;
        if (!product) return;

        this.product = this.normalizeProduct(product);
        this.selectedImageUrl = this.product.image?.[0] || '';

        this.rebuildAvailableSizes();
        this.loadRelatedProducts();
        this.loadReviews();
      });
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  selectImage(url: string): void {
    this.selectedImageUrl = url;
  }

  toggleSizeGuide(): void {
    this.showSizeGuide = !this.showSizeGuide;
  }

  stockFor(size: Size): number {
    return this.product?.stock?.[size] ?? 0;
  }

  selectSize(size: Size): void {
    if (this.stockFor(size) <= 0) return;
    this.selectedSize = size;
    this.quantity = 1;
  }

  incrementQty(): void {
    if (!this.selectedSize) return;
    const max = this.stockFor(this.selectedSize);
    this.quantity = Math.min(max || 1, this.quantity + 1);
  }

  decrementQty(): void {
    this.quantity = Math.max(1, this.quantity - 1);
  }

  addOneToCart(): void {
    this.addToCartInternal(1);
  }

  addSelectedQtyToCart(): void {
    this.addToCartInternal(this.quantity);
  }

  private addToCartInternal(qty: number): void {
    if (!this.isLoggedIn()) {
      this.toast.info('Please login to add items to your cart.');
      return;
    }
    if (!this.product) return;
    if (!this.selectedSize) {
      this.toast.warning('Please select a size first.');
      return;
    }

    const safeQty = Math.max(1, Math.floor(Number(qty || 1)));
    const available = this.stockFor(this.selectedSize);
    if (available <= 0) {
      this.toast.error('This size is currently out of stock.');
      return;
    }
    if (safeQty > available) {
      this.toast.warning(`Only ${available} left in stock for size ${this.selectedSize}.`);
      return;
    }

    // No confirmation prompt: just inform the user what will be added.
    this.toast.info(`Adding ${safeQty} item${safeQty === 1 ? '' : 's'} (size ${this.selectedSize}) to your cart...`);

    this.cartService.addProduct(this.product, this.selectedSize, safeQty).subscribe({
      next: () => this.toast.success(`Added ${safeQty} item${safeQty === 1 ? '' : 's'} to cart!`),
      error: (err) => {
        console.error('ProductDetails: add to cart failed', err);
        const msg = String(err?.error?.error || err?.error?.message || '').trim();
        this.toast.error(msg || 'Unable to add to cart. Please try again.');
      }
    });
  }

  onZoomEnter(): void {
    this.zoomActive = true;
  }

  onZoomLeave(): void {
    this.zoomActive = false;
    this.zoomX = 50;
    this.zoomY = 50;
  }

  onZoomMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.zoomX = Math.max(0, Math.min(100, x));
    this.zoomY = Math.max(0, Math.min(100, y));
  }

  submitReview(): void {
    if (!this.product) return;
    if (!this.isLoggedIn()) {
      this.toast.info('Please login to write a review.');
      return;
    }
    const comment = (this.newReviewComment || '').trim();
    if (!comment) {
      this.toast.warning('Please write a short review comment.');
      return;
    }

    this.reviewService.addOrUpdateReview(this.product._id, this.newReviewRating, comment).subscribe({
      next: () => {
        this.newReviewComment = '';
        this.newReviewRating = 5;
        this.loadReviews();
        this.toast.success('Thanks! Your review was saved.');
      },
      error: (err) => {
        console.error('ProductDetails: submit review failed', err);
        const msg = String(err?.error?.error || err?.error?.message || '').trim();
        this.toast.error(msg || 'Unable to submit review. Please try again.');
      }
    });
  }

  private loadReviews(): void {
    if (!this.product) return;
    this.reviewService.getReviews(this.product._id).subscribe({
      next: (reviews) => (this.reviews = reviews || []),
      error: (err) => {
        console.error('ProductDetails: failed to load reviews', err);
        this.reviews = [];
      }
    });

    this.reviewService.getSummary(this.product._id).subscribe({
      next: (summary) => (this.averageRating = Number(summary?.average || 0)),
      error: (err) => {
        console.error('ProductDetails: failed to load review summary', err);
        this.averageRating = 0;
      }
    });
  }

  private loadRelatedProducts(): void {
    if (!this.product) return;
    this.apiService.getProducts().subscribe({
      next: (products) => {
        const all = (products || []).map((p: any) => this.normalizeProduct(p));
        const currentId = this.product?._id;
        const category = this.product?.category;
        const sub = this.product?.sub_category;

        const related = all
          .filter((p) => p._id !== currentId)
          .filter((p) => (sub ? p.sub_category === sub : p.category === category))
          .slice(0, 4);

        this.relatedProducts = related;
      },
      error: (err) => {
        console.error('ProductDetails: failed to load related products', err);
        this.relatedProducts = [];
      }
    });
  }

  private rebuildAvailableSizes(): void {
    if (!this.product) return;

    const fromProduct = (this.product.sizes || [])
      .map((s) => String(s).trim().toUpperCase())
      .filter((s) => isSize(s)) as Size[];

    const stockKeys: Size[] = ['S', 'M', 'L', 'XL'];
    const fromStock = stockKeys.filter((s) => this.stockFor(s) > 0);

    const merged = (fromProduct.length ? fromProduct : fromStock.length ? fromStock : stockKeys);
    this.availableSizes = Array.from(new Set(merged));
  }

  private normalizeProduct(raw: any): Product {
    const stock: StockBySize = {
      S: Number(raw?.stock?.S ?? 0),
      M: Number(raw?.stock?.M ?? 0),
      L: Number(raw?.stock?.L ?? 0),
      XL: Number(raw?.stock?.XL ?? 0)
    };

    return {
      _id: String(raw?._id ?? ''),
      name: String(raw?.name ?? 'Unnamed Product'),
      description: raw?.description ?? '',
      category: String(raw?.category ?? ''),
      sub_category: raw?.sub_category ?? '',
      price: Number(raw?.price ?? 0),
      discount: Number(raw?.discount ?? 0),
      image: Array.isArray(raw?.image) ? raw.image : [],
      sizes: Array.isArray(raw?.sizes) ? raw.sizes : [],
      colors: Array.isArray(raw?.colors) ? raw.colors : [],
      stock
    };
  }
}
