import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-superadmin-dashboard',
  imports: [CommonModule],
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
    totalRevenue: 0
  };
  isLoading = true;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
    this.loadSuperadminData();
  }

  private loadSuperadminData() {
    Promise.all([
      this.apiService.getUsers().toPromise(),
      this.apiService.getProducts().toPromise(),
      this.apiService.getOrders().toPromise(),
      this.apiService.getFinancials().toPromise()
    ]).then(([users, products, orders, financials]) => {
      this.stats.totalUsers = users?.length || 0;
      this.stats.totalAdmins = users?.filter(u => u.role === 'admin' || u.role === 'superadmin').length || 0;
      this.stats.totalCustomers = users?.filter(u => u.role === 'customer').length || 0;
      this.stats.totalProducts = products?.length || 0;
      this.stats.totalOrders = orders?.length || 0;
      this.stats.totalRevenue = financials?.reduce((sum, f) => sum + (f.amount || 0), 0) || 0;
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