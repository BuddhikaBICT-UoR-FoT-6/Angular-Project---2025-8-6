import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  timeout,
  forkJoin
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
  private scrollInterval: any = null;
  private scrollDirection = 1;
  isAutoScrollActive = true;
  private isDragging = false;
  private startX = 0;
  private scrollLeft = 0;

  @ViewChild('featuredScrollContainer', { static: false })
  private featuredScrollContainer?: ElementRef<HTMLElement>;

  private reviewSummariesByProductId: Record<string, ReviewSummary> = {};

  readonly vm$: Observable<{
    loading: boolean;
    featuredProducts: any[];
    categories: any[];
    newArrivals: any[];
    featuredCol?: any;
    seasonalCol?: any;
    errorMessage?: string;
    isFiltered?: boolean;
    filterTitle?: string;
  }> =
    this.refreshTrigger$.pipe(
      startWith(void 0),
      switchMap(() => this.loadVm$()),
      tap((vm) => {
        if (!vm.loading && vm.featuredProducts?.length > 0) {
          setTimeout(() => {
            console.log('[Showroom] VM loaded with products; restarting auto-scroll.');
            this.stopAutoScroll();
            this.startAutoScroll();
          }, 1000); // Increased delay to ensure DOM is ready
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  categories = ['Shirts', 'Pants', 'Dresses', 'Accessories'];

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private toast: ToastService,
    private reviewService: ReviewService
  ) { }

  ngOnInit(): void {
    // No-op: vm$ starts loading via startWith.
  }

  ngOnDestroy(): void {
    this.stopAutoScroll();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.tryStartAutoScroll();
      setInterval(() => {
        if (this.isAutoScrollActive && !this.scrollInterval) {
          this.tryStartAutoScroll();
        }
      }, 2000);
    }, 1500);

    // Use a MutationObserver to detect when product children are added/changed
    // and ensure auto-scroll starts when there is overflow.
    const obsStart = () => {
      const el = this.getScrollContainer();
      if (!el) return;
      try {
        const observer = new MutationObserver(() => {
          // If there are children and auto-scroll active, restart scroll
          if (this.isAutoScrollActive && el.children.length > 0) {
            console.log('[Showroom] MutationObserver detected children change, restarting auto-scroll.');
            this.stopAutoScroll();
            this.startAutoScroll();
          }
        });
        observer.observe(el, { childList: true, subtree: false });
      } catch (err) {
        // ignore in environments that don't support MutationObserver
      }
    };
    // Delay attaching the observer to give time for initial rendering
    setTimeout(obsStart, 1600);
  }

  private tryStartAutoScroll(): void {
    if (this.isAutoScrollActive && this.getScrollContainer()) {
      this.startAutoScroll();
    }
  }

  private getScrollContainer(): HTMLElement | null {
    return this.featuredScrollContainer?.nativeElement || null;
  }

  startAutoScroll(): void {
    this.stopAutoScroll();
    const container = this.getScrollContainer();
    if (!container) {
      console.log('[Showroom] startAutoScroll: no container');
      return;
    }
    container.scrollLeft = 0; // Start from the left
    let direction = 1;
    let lastDirection = direction;
    // ensure only one interval exists
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
    console.log('[Showroom] Starting auto-scroll. scrollWidth=', container.scrollWidth, 'clientWidth=', container.clientWidth);
    this.scrollInterval = setInterval(() => {
      const maxScroll = container.scrollWidth - container.clientWidth;
      const current = container.scrollLeft;
      if (maxScroll <= 0) return;
      if (current >= maxScroll - 10) direction = -1;
      if (current <= 10) direction = 1;
      if (lastDirection !== direction) {
        console.log('[Showroom] Direction changed to', direction, 'at scrollLeft=', current);
        lastDirection = direction;
      }
      container.scrollLeft += direction * 2;
    }, 100);
  }

  stopAutoScroll(): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
      console.log('[Showroom] Auto-scroll stopped.');
    }
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
    this.stopAutoScroll();
  }

  onDrag(e: MouseEvent): void {
    if (!this.isDragging) return;
    e.preventDefault();
    const container = e.currentTarget as HTMLElement;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - this.startX) * 2;
    container.scrollLeft = this.scrollLeft - walk;
  }

  onDragEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    const container = this.getScrollContainer();
    if (container) {
      container.style.cursor = 'grab';
    }
    if (this.isAutoScrollActive) {
      setTimeout(() => this.startAutoScroll(), 500);
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

  private loadVm$(): Observable<{
    loading: boolean;
    featuredProducts: any[];
    categories: any[];
    newArrivals: any[];
    featuredCol?: any;
    seasonalCol?: any;
    errorMessage?: string;
    isFiltered?: boolean;
    filterTitle?: string;
  }> {
    return defer(() =>
      this.apiService.waitForDbReady(120000).pipe(
        delay(500),
        switchMap(() => this.route.queryParams),
        switchMap((params) => {
          const category = params['category'];
          const collectionSlug = params['collection'];
          const sort = params['sort']; // e.g. sort=newest

          const isFiltered = !!(category || collectionSlug || sort);

          if (isFiltered) {
            let filterTitle = 'Filtered Results';
            let products$: Observable<any[]> = of([]);

            if (category) {
              filterTitle = category;
              products$ = this.apiService.getProducts({ category }).pipe(catchError(() => of([])));
            } else if (sort === 'newest') {
              filterTitle = 'New Arrivals';
              products$ = this.apiService.getProducts({ sort: 'newest' }).pipe(catchError(() => of([])));
            } else if (collectionSlug) {
              products$ = this.apiService.getCollectionBySlug(collectionSlug).pipe(
                map(col => {
                  if (col && col.name) filterTitle = col.name;
                  return col?.products || [];
                }),
                catchError(() => of([]))
              );
            }

            return forkJoin({
              products: products$,
              filterTitle: of(filterTitle)
            }).pipe(
              map(res => ({
                loading: false,
                featuredProducts: res.products,
                categories: [],
                newArrivals: [],
                featuredCol: undefined,
                seasonalCol: undefined,
                isFiltered: true,
                filterTitle: res.filterTitle
              }))
            );
          }

          // Otherwise, return standard landing page data
          return forkJoin({
            products: this.apiService.getProducts({ sort: 'popular', limit: 8 }).pipe(catchError(() => of([]))),
            categories: this.apiService.getCategories().pipe(catchError(() => of([]))),
            newArrivals: this.apiService.getProducts({ sort: 'newest', limit: 8 }).pipe(catchError(() => of([]))),
            featuredCol: this.apiService.getCollectionsByType('featured').pipe(map(cols => cols[0] || null), catchError(() => of(null))),
            seasonalCol: this.apiService.getCollectionsByType('seasonal').pipe(map(cols => cols[0] || null), catchError(() => of(null)))
          }).pipe(
            map(res => ({
              loading: false,
              featuredProducts: res.products,
              categories: res.categories,
              newArrivals: res.newArrivals,
              featuredCol: res.featuredCol,
              seasonalCol: res.seasonalCol,
              isFiltered: false
            }))
          );
        }),
        timeout({ first: 20000 }),
        retry({ count: 1, delay: 1500 }),
        switchMap((vmState) => {
          const featured = vmState.featuredProducts || [];
          // Collect all product IDs to fetch reviews for
          const allProducts = [...featured, ...(vmState.newArrivals || []), ...(vmState.featuredCol?.products || []), ...(vmState.seasonalCol?.products || [])];
          const uniqueIds = [...new Set(allProducts.map((p: any) => String(p?._id || '')).filter(Boolean))];

          if (!uniqueIds.length) {
            this.reviewSummariesByProductId = {};
            return of(vmState);
          }

          return this.reviewService.getSummaries(uniqueIds).pipe(
            map((summaries) => {
              this.reviewSummariesByProductId = summaries || {};
              return vmState;
            }),
            catchError((err) => {
              console.error('Showroom: failed to load review summaries', err);
              this.reviewSummariesByProductId = {};
              return of(vmState);
            })
          );
        }),
        catchError((error) => {
          console.error('Error fetching data:', error);
          this.toast.error('😕 Oops! Having trouble loading content.');

          // One automatic retry after a short delay.
          if (!this.autoRetryDone && (globalThis as any)?.setTimeout) {
            this.autoRetryDone = true;
            globalThis.setTimeout(() => this.refresh(), 1500);
          }

          return of({
            loading: false,
            featuredProducts: [],
            categories: [],
            newArrivals: [],
            errorMessage: '😕 Oops! Having trouble loading content. Please refresh the page.'
          });
        }),
        startWith({ loading: true, featuredProducts: [], categories: [], newArrivals: [] })
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
