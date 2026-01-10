import { Component, ElementRef, ViewChild } from '@angular/core';
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
  tap,
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
  private scrollInterval: any | null = null;
  private scrollDirection = 1; // 1 for right, -1 for left
  isAutoScrollActive = true;
  private isDragging = false;
  private startX = 0;
  private scrollLeft = 0;
  private autoScrollStartTimer: any | null = null;
  private autoScrollStartAttempts = 0;

  @ViewChild('featuredScrollContainer')
  private featuredScrollContainer?: ElementRef<HTMLElement>;

  private reviewSummariesByProductId: Record<string, ReviewSummary> = {};

  readonly vm$: Observable<{ loading: boolean; featuredProducts: any[]; errorMessage?: string }> =
    this.refreshTrigger$.pipe(
      startWith(void 0),
      switchMap(() => this.loadVm$()),
      tap((vm) => {
        if (!vm.loading && (vm.featuredProducts?.length || 0) > 0) {
          // The container is created by *ngIf; ensure we start auto-scroll
          // after this emission when the DOM exists.
          this.scheduleAutoScrollStart();
        }
      }),
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
      this.scrollInterval = null;
    }
    if (this.autoScrollStartTimer) {
      clearTimeout(this.autoScrollStartTimer);
      this.autoScrollStartTimer = null;
    }
  }

  ngAfterViewInit(): void {
    // The scroller is rendered conditionally after async data loads.
    // Try starting a few times until the container exists and overflows.
    this.scheduleAutoScrollStart();
  }

  private getScrollContainer(): HTMLElement | null {
    return this.featuredScrollContainer?.nativeElement ?? null;
  }

  private scheduleAutoScrollStart(): void {
    if (!this.isAutoScrollActive) return;

    this.autoScrollStartAttempts = 0;
    if (this.autoScrollStartTimer) {
      clearTimeout(this.autoScrollStartTimer);
      this.autoScrollStartTimer = null;
    }

    const tryStart = () => {
      this.autoScrollStartAttempts++;
      if (!this.isAutoScrollActive || this.isDragging || this.scrollInterval) return;

      const container = this.getScrollContainer();
      const canScroll = !!container && container.scrollWidth > container.clientWidth + 5;

      if (canScroll) {
        this.startAutoScroll();
        return;
      }

      if (this.autoScrollStartAttempts < 20) {
        this.autoScrollStartTimer = setTimeout(tryStart, 150);
      }
    };

    this.autoScrollStartTimer = setTimeout(tryStart, 0);
  }

  startAutoScroll(): void {
    this.stopAutoScroll();

    this.scrollInterval = setInterval(() => {
      const container = this.getScrollContainer();
      if (!container) return;

      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      const currentScroll = container.scrollLeft;

      // Change direction at edges
      if (currentScroll >= maxScroll - 1) {
        this.scrollDirection = -1;
      } else if (currentScroll <= 1) {
        this.scrollDirection = 1;
      }

      // Use direct scrollLeft updates for consistent movement.
      container.scrollLeft = currentScroll + this.scrollDirection * 2;
    }, 20);
  }

  stopAutoScroll(): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
  }

  resumeAutoScroll(): void {
    this.scheduleAutoScrollStart();
  }

  toggleAutoScroll(): void {
    this.isAutoScrollActive = !this.isAutoScrollActive;
    if (this.isAutoScrollActive) {
      this.scheduleAutoScrollStart();
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
    const container = this.getScrollContainer();
    if (container) {
      container.style.cursor = 'grab';
      container.style.userSelect = 'auto';
    }
    // Resume auto-scroll if it was active
    if (this.isAutoScrollActive) {
      this.scheduleAutoScrollStart();
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
        switchMap(() => this.apiService.getProducts({ sort: 'popular', limit: 8 })),
        timeout({ first: 20000 }),
        retry({ count: 1, delay: 1500 }),
        switchMap((products) => {
          const featured = products || [];
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
