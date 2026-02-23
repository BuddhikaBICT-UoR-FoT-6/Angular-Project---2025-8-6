import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-superadmin-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './superadmin-dashboard.html',
  styleUrl: './superadmin-dashboard.css'
})
export class SuperadminDashboard implements OnInit {
  user: any;
  stats = {
    totalUsers: 0,
    totalAdmins: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    lowStockItems: 0
  };
  isLoading = true;
  recentOrders: any[] = [];
  topProducts: any[] = [];

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
    this.loadSuperadminData();
  }

  loadSuperadminData() {
    this.isLoading = true;
    Promise.all([
      this.apiService.getUsers().toPromise(),
      this.apiService.getProducts().toPromise(),
      this.apiService.getOrders().toPromise(),
      this.apiService.getFinancials().toPromise(),
      this.apiService.getInventory().toPromise()
    ]).then(([usersData, productsData, ordersData, financialsData, inventoryData]) => {
      const users: any[] = Array.isArray(usersData) ? usersData : ((usersData as any)?.data || []);
      const products: any[] = Array.isArray(productsData) ? productsData : ((productsData as any)?.data || []);
      const orders: any[] = Array.isArray(ordersData) ? ordersData : ((ordersData as any)?.data || []);
      const financials: any[] = Array.isArray(financialsData) ? financialsData : ((financialsData as any)?.data || []);
      const inventory: any[] = Array.isArray(inventoryData) ? inventoryData : ((inventoryData as any)?.data || []);

      this.stats.totalUsers = users?.length || 0;
      this.stats.totalAdmins = users?.filter(u => u.role === 'admin' || u.role === 'superadmin').length || 0;
      this.stats.totalCustomers = users?.filter(u => u.role === 'customer').length || 0;
      this.stats.totalProducts = products?.length || 0;
      this.stats.totalOrders = orders?.length || 0;
      this.stats.totalRevenue = financials?.reduce((sum, f) => sum + (f.amount || 0), 0) || 0;

      const lowStockItems =
        inventory?.filter((item: any) => {
          const totalStock =
            (item.stock_by_size?.S || 0) +
            (item.stock_by_size?.M || 0) +
            (item.stock_by_size?.L || 0) +
            (item.stock_by_size?.XL || 0);
          return totalStock < 10;
        }).length || 0;
      this.stats.lowStockItems = lowStockItems;

      this.recentOrders =
        orders
          ?.slice(-5)
          .reverse()
          .map((order: any) => ({
            ...order,
            customerName: order.user_id?.full_name || 'Unknown Customer',
            total: order.total_amount || 0
          })) || [];

      this.topProducts =
        products?.slice(0, 5).map((product: any) => ({
          ...product,
          stock:
            (product.stock?.S || 0) +
            (product.stock?.M || 0) +
            (product.stock?.L || 0) +
            (product.stock?.XL || 0)
        })) || [];

      this.isLoading = false;
      this.cdr.detectChanges();
    }).catch(error => {
      console.error('Error loading data:', error);
      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  logout() {
    this.authService.logout();
  }
}