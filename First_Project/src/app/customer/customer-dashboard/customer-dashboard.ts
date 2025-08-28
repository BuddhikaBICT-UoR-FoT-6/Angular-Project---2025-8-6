import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-customer-dashboard',
  imports: [CommonModule],
  templateUrl: './customer-dashboard.html',
  styleUrl: './customer-dashboard.css'
})
export class CustomerDashboard implements OnInit {
  user: any;
  myOrders: any[] = [];
  isLoading = true;

  constructor(
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
    this.loadCustomerData();
  }

  private loadCustomerData() {
    this.apiService.getOrders().subscribe({
      next: (orders) => {
        this.myOrders = orders.filter(order => order.user_id === this.user?.userId);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.isLoading = false;
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}