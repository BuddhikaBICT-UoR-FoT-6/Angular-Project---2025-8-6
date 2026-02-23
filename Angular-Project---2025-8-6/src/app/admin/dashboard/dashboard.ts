import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import {
  Observable,
  Subject,
  catchError,
  delay,
  defer,
  forkJoin,
  map,
  of,
  retry,
  shareReplay,
  startWith,
  switchMap,
  tap,
  timeout
} from 'rxjs';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';

interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  lowStockItems: number;
}

interface DashboardVm {
  loading: boolean;
  stats: DashboardStats;
  recentOrders: any[];
  topProducts: any[];
  partialError: boolean;
  errorMessage?: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
  private readonly refreshTrigger$ = new Subject<void>();
  private autoRetryDone = false;

  readonly vm$: Observable<DashboardVm> = this.refreshTrigger$.pipe(
    startWith(void 0),
    switchMap(() => this.loadVm$()),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private apiService: ApiService,
    private toast: ToastService
  ) {}

  private emptyVm(partial?: Partial<DashboardVm>): DashboardVm {
    return {
      loading: true,
      stats: {
        totalUsers: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        lowStockItems: 0
      },
      recentOrders: [],
      topProducts: [],
      partialError: false,
      ...partial
    };
  }

  private loadVm$(): Observable<DashboardVm> {
    return defer(() => {
      let hadAnyError = false;

      const users$: Observable<any[] | null> = this.apiService.getUsers().pipe(
        timeout({ first: 20000 }),
        retry({ count: 1, delay: 1500 }),
        catchError((err) => {
          hadAnyError = true;
          console.error('Dashboard: failed to load users', err);
          return of(null);
        })
      );

      const products$: Observable<any[] | null> = this.apiService.getProducts().pipe(
        timeout({ first: 20000 }),
        retry({ count: 1, delay: 1500 }),
        catchError((err) => {
          hadAnyError = true;
          console.error('Dashboard: failed to load products', err);
          return of(null);
        })
      );

      const orders$: Observable<any[] | null> = this.apiService.getOrders().pipe(
        timeout({ first: 20000 }),
        retry({ count: 1, delay: 1500 }),
        catchError((err) => {
          hadAnyError = true;
          console.error('Dashboard: failed to load orders', err);
          return of(null);
        })
      );

      const financials$: Observable<any[] | null> = this.apiService.getFinancials().pipe(
        timeout({ first: 20000 }),
        retry({ count: 1, delay: 1500 }),
        catchError((err) => {
          hadAnyError = true;
          console.error('Dashboard: failed to load financials', err);
          return of(null);
        })
      );

      const inventory$: Observable<any[] | null> = this.apiService.getInventory().pipe(
        timeout({ first: 20000 }),
        retry({ count: 1, delay: 1500 }),
        catchError((err) => {
          hadAnyError = true;
          console.error('Dashboard: failed to load inventory', err);
          return of(null);
        })
      );

      return this.apiService.waitForDbReady(120000).pipe(
        // Give the DB a moment to warm up before firing multiple queries.
        delay(1000),
        switchMap(() =>
          forkJoin({
            users: users$,
            products: products$,
            orders: orders$,
            financials: financials$,
            inventory: inventory$
          })
        ),
        map((data) => {
          // If any critical call failed, don't render an empty dashboard.
          // Keep the view in a loading state and trigger a retry.
          if (!data.users || !data.products || !data.orders || !data.financials || !data.inventory) {
            return this.emptyVm({
              loading: true,
              partialError: true,
              errorMessage: 'Dashboard still loading, retrying...'
            });
          }

          const computed = this.computeVmData(data);
          return this.emptyVm({
            loading: false,
            ...computed,
            partialError: hadAnyError
          });
        }),
        tap((vm) => {
          if (!vm.partialError) return;

          // One automatic retry after a short delay (helps when DB/server is still warming up).
          if (!this.autoRetryDone && (globalThis as any)?.setTimeout) {
            this.autoRetryDone = true;
            this.toast.warning(vm.errorMessage || 'Dashboard loaded with some missing data.');
            globalThis.setTimeout(() => this.refreshData(), 1500);
          }
        }),
        catchError((error) => {
          console.error('Error loading dashboard data:', error);
          this.toast.error('Backend is still starting. Please wait and try again.');
          return of(
            this.emptyVm({
              loading: false,
              errorMessage: 'Backend is still starting. Please wait and try again.'
            })
          );
        }),
        startWith(this.emptyVm({ loading: true }))
      );
    });
  }

  private computeVmData(data: any): Pick<DashboardVm, 'stats' | 'recentOrders' | 'topProducts'> {
    const { users, products, orders, financials, inventory } = data;

    const stats: DashboardStats = {
      totalUsers: users?.length || 0,
      totalProducts: products?.length || 0,
      totalOrders: orders?.length || 0,
      totalRevenue:
        financials?.reduce((sum: number, f: any) => sum + (f.amount || 0), 0) || 0,
      lowStockItems:
        inventory?.filter((item: any) => {
          const totalStock =
            (item.stock_by_size?.S || 0) +
            (item.stock_by_size?.M || 0) +
            (item.stock_by_size?.L || 0) +
            (item.stock_by_size?.XL || 0);
          return totalStock < 10;
        }).length || 0
    };

    const recentOrders: any[] =
      orders
        ?.slice(-5)
        .reverse()
        .map((order: any) => ({
          ...order,
          customerName: order.user_id?.full_name || 'Unknown Customer',
          total: order.total_amount || 0
        })) || [];

    const topProducts: any[] =
      products?.slice(0, 5).map((product: any) => ({
        ...product,
        stock:
          (product.stock?.S || 0) +
          (product.stock?.M || 0) +
          (product.stock?.L || 0) +
          (product.stock?.XL || 0)
      })) || [];

    return { stats, recentOrders, topProducts };
  }

  refreshData() {
    this.refreshTrigger$.next();
  }
}
