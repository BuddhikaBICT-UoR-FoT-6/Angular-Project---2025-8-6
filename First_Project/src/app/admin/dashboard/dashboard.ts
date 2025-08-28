import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { forkJoin } from 'rxjs';

interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  lowStockItems: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  stats: DashboardStats = {
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockItems: 0
  };

  recentOrders: any[] = [];
  topProducts: any[] = [];
  isLoading = true;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  private loadDashboardData() {
    this.isLoading = true;
    
    forkJoin({
      users: this.apiService.getUsers(),
      products: this.apiService.getProducts(),
      orders: this.apiService.getOrders(),
      financials: this.apiService.getFinancials(),
      inventory: this.apiService.getInventory()
    }).subscribe({
      next: (data) => {
        this.processData(data);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.isLoading = false;
      }
    });
  }

  private processData(data: any) {
    const { users, products, orders, financials, inventory } = data;

    this.stats.totalUsers = users?.length || 0;
    this.stats.totalProducts = products?.length || 0;
    this.stats.totalOrders = orders?.length || 0;
    
    // Calculate total revenue from financials
    this.stats.totalRevenue = financials?.reduce((sum: number, f: any) => {
      return sum + (f.amount || 0);
    }, 0) || 0;

    // Calculate low stock items from inventory
    this.stats.lowStockItems = inventory?.filter((item: any) => {
      const totalStock = (item.stock_by_size?.S || 0) + 
                        (item.stock_by_size?.M || 0) + 
                        (item.stock_by_size?.L || 0) + 
                        (item.stock_by_size?.XL || 0);
      return totalStock < 10;
    }).length || 0;

    // Get recent orders (last 5)
    this.recentOrders = orders?.slice(-5).reverse().map((order: any) => ({
      ...order,
      customerName: order.user_id?.full_name || 'Unknown Customer',
      total: order.total_amount || 0
    })) || [];

    // Get top products (first 5)
    this.topProducts = products?.slice(0, 5).map((product: any) => ({
      ...product,
      stock: (product.stock?.S || 0) + (product.stock?.M || 0) + 
             (product.stock?.L || 0) + (product.stock?.XL || 0)
    })) || [];
  }

  refreshData() {
    this.loadDashboardData();
  }
}
