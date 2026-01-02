import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, timeout } from 'rxjs';
import { ApiService } from '../../services/api.service';

interface AnalyticsStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  lowStockItems: number;
}

@Component({
  selector: 'app-analytics',
  imports: [CommonModule, RouterLink],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css'
})
export class Analytics implements OnInit {
  isLoading = true;
  stats: AnalyticsStats = {
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockItems: 0
  };

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.isLoading = true;

    const users$ = this.apiService.getUsers().pipe(
      timeout({ first: 20000 }),
      catchError((err) => {
        console.error('Analytics: failed to load users', err);
        return of([]);
      })
    );

    const products$ = this.apiService.getProducts().pipe(
      timeout({ first: 20000 }),
      catchError((err) => {
        console.error('Analytics: failed to load products', err);
        return of([]);
      })
    );

    const orders$ = this.apiService.getOrders().pipe(
      timeout({ first: 20000 }),
      catchError((err) => {
        console.error('Analytics: failed to load orders', err);
        return of([]);
      })
    );

    const financials$ = this.apiService.getFinancials().pipe(
      timeout({ first: 20000 }),
      catchError((err) => {
        console.error('Analytics: failed to load financials', err);
        return of([]);
      })
    );

    const inventory$ = this.apiService.getInventory().pipe(
      timeout({ first: 20000 }),
      catchError((err) => {
        console.error('Analytics: failed to load inventory', err);
        return of([]);
      })
    );

    forkJoin({
      users: users$,
      products: products$,
      orders: orders$,
      financials: financials$,
      inventory: inventory$
    }).subscribe({
      next: ({ users, products, orders, financials, inventory }) => {
        this.stats.totalUsers = users?.length || 0;
        this.stats.totalProducts = products?.length || 0;
        this.stats.totalOrders = orders?.length || 0;
        this.stats.totalRevenue =
          financials?.reduce((sum: number, f: any) => sum + (f.amount || 0), 0) || 0;

        this.stats.lowStockItems =
          inventory?.filter((item: any) => {
            const totalStock =
              (item.stock_by_size?.S || 0) +
              (item.stock_by_size?.M || 0) +
              (item.stock_by_size?.L || 0) +
              (item.stock_by_size?.XL || 0);
            return totalStock < 10;
          }).length || 0;

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load analytics', err);
        this.isLoading = false;
      }
    });
  }
}
