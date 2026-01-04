import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReviewService } from '../../services/review.service';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import type { ReviewSummary } from '../../models/review.model';
import {
  Observable,
  Subject,
  catchError,
  delay,
  defer,
  map,
  of,
  retry,
  shareReplay,
  startWith,
  switchMap,
  timeout
} from 'rxjs';


@Component({
  selector: 'app-showroom',
  imports: [CommonModule, RouterLink],
  templateUrl: './showroom.html',
  styleUrl: './showroom.css'
})

export class Showroom {
  private readonly refreshTrigger$ = new Subject<void>();
  private autoRetryDone = false;
  private scrollInterval: any;
  private scrollDirection = 1; // 1 for right, -1 for left
  isAutoScrollActive = true;
  private isDragging = false;
  private startX = 0;
  private scrollLeft = 0;

  private reviewSummariesByProductId: Record<string, ReviewSummary> = {};

  readonly vm$: Observable<{ loading: boolean; featuredProducts: any[]; errorMessage?: string }> =
    this.refreshTrigger$.pipe(
      startWith(void 0),
      switchMap(() => this.loadVm$()),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  categories = ['Shirts', 'Pants', 'Dresses', 'Accessories'];

  constructor(
  private apiService: ApiService,
  private authService: AuthService,
  private toast: ToastService,
  private reviewService: ReviewService
) {}

  ngOnInit(): void {
    // No-op: vm$ starts loading via startWith.
  }

  ngOnDestroy(): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
    }
  }

  ngAfterViewInit(): void {
    // Start auto-scroll after a brief delay if active
    setTimeout(() => {
      if (this.isAutoScrollActive) {
        this.startAutoScroll();
      }
    }, 1000);
  }

  startAutoScroll(): void {
    this.scrollInterval = setInterval(() => {
      const container = document.querySelector('.products-scroll-container') as HTMLElement;
      if (container) {
        const maxScroll = container.scrollWidth - container.clientWidth;
        const currentScroll = container.scrollLeft;
        
        // Change direction at edges
        if (currentScroll >= maxScroll) {
          this.scrollDirection = -1;
        } else if (currentScroll <= 0) {
          this.scrollDirection = 1;
        }
        
        // Smooth scroll
        container.scrollBy({
          left: this.scrollDirection * 2,
          behavior: 'smooth'
        });
      }
    }, 30); // Adjust speed by changing interval
  }

  stopAutoScroll(): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
    }
  }

  resumeAutoScroll(): void {
    this.stopAutoScroll();
    this.startAutoScroll();
  }

  toggleAutoScroll(): void {
    this.isAutoScrollActive = !this.isAutoScrollActive;
    if (this.isAutoScrollActive) {
      this.startAutoScroll();
    } else {
      this.stopAutoScroll();
    }
  }

  onDragStart(e: MouseEvent): void {
    const container = e.currentTarget as HTMLElement;
    this.isDragging = true;
    this.startX = e.pageX - container.offsetLeft;
    this.scrollLeft = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    // Stop auto-scroll while dragging
    if (this.isAutoScrollActive) {
      this.stopAutoScroll();
    }
  }

  onDrag(e: MouseEvent): void {
    if (!this.isDragging) return;
    e.preventDefault();
    const container = e.currentTarget as HTMLElement;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - this.startX) * 2; // Scroll speed multiplier
    container.scrollLeft = this.scrollLeft - walk;
  }

  onDragEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    const container = document.querySelector('.products-scroll-container') as HTMLElement;
    if (container) {
      container.style.cursor = 'grab';
      container.style.userSelect = 'auto';
    }
    // Resume auto-scroll if it was active
    if (this.isAutoScrollActive) {
      this.startAutoScroll();
    }
  }

  onProductCardClick(event: MouseEvent): void {
    // Prevent accidental navigation when the user is dragging the horizontal scroller.
    if (this.isDragging) {
      event.preventDefault();
      event.stopPropagation();
      (event as any)?.stopImmediatePropagation?.();
    }
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  private loadVm$(): Observable<{ loading: boolean; featuredProducts: any[]; errorMessage?: string }> {
    return defer(() =>
      this.apiService.waitForDbReady(120000).pipe(
        delay(1000),
        switchMap(() => this.apiService.getProducts()),
        timeout({ first: 20000 }),
        retry({ count: 1, delay: 1500 }),
        switchMap((products) => {
          const featured = (products || []).slice(0, 8);
          const ids = featured.map((p: any) => String(p?._id || '')).filter(Boolean);

          if (!ids.length) {
            this.reviewSummariesByProductId = {};
            return of({ loading: false, featuredProducts: featured });
          }

          return this.reviewService.getSummaries(ids).pipe(
            map((summaries) => {
              this.reviewSummariesByProductId = summaries || {};
              return { loading: false, featuredProducts: featured };
            }),
            catchError((err) => {
              console.error('Showroom: failed to load review summaries', err);
              this.reviewSummariesByProductId = {};
              return of({ loading: false, featuredProducts: featured });
            })
          );
        }),
        catchError((error) => {
          console.error('Error fetching products:', error);
          this.toast.error('😕 Oops! Having trouble loading products. Give us a moment and we\'ll try again!');

          // One automatic retry after a short delay.
          if (!this.autoRetryDone && (globalThis as any)?.setTimeout) {
            this.autoRetryDone = true;
            globalThis.setTimeout(() => this.refresh(), 1500);
          }

          return of({
            loading: false,
            featuredProducts: [],
            errorMessage: '😕 Oops! Having trouble loading products. Please refresh the page or try again in a moment.'
          });
        }),
        startWith({ loading: true, featuredProducts: [] })
      )
    );
  }

  getAverageRating(productId: string): number {
    return Number(this.reviewSummariesByProductId?.[productId]?.average || 0);
  }

  getReviewCount(productId: string): number {
    return Number(this.reviewSummariesByProductId?.[productId]?.count || 0);
  }

  starsFor(productId: string): boolean[] {
    const avg = this.getAverageRating(productId);
    const filled = Math.round(avg);
    return [1, 2, 3, 4, 5].map((n) => n <= filled);
  }

  refresh() {
    this.refreshTrigger$.next();
  }
}
