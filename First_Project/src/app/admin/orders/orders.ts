import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-orders',
  imports: [CommonModule, RouterLink],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit {
  isLoading = true;
  orders: any[] = [];
  filteredOrders: any[] = [];
  selectedStatus: string = 'all';
  selectedOrder: any = null;

  constructor(
    private apiService: ApiService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders() {
    this.isLoading = true;
    this.apiService.getOrders().subscribe({
      next: (orders) => {
        this.orders = (orders || []).slice().reverse();
        this.applyFilter();
        this.isLoading = false;
        this.toast.success('Orders loaded successfully');
      },
      error: (err) => {
        console.error('Failed to load orders', err);
        this.toast.error('Failed to load orders');
        this.isLoading = false;
      }
    });
  }

  applyFilter() {
    if (this.selectedStatus === 'all') {
      this.filteredOrders = [...this.orders];
    } else {
      this.filteredOrders = this.orders.filter(o => 
        (o.status || 'pending').toLowerCase() === this.selectedStatus.toLowerCase()
      );
    }
  }

  filterByStatus(status: string) {
    this.selectedStatus = status;
    this.applyFilter();
  }

  viewOrderDetails(order: any) {
    this.selectedOrder = order;
  }

  closeDetails() {
    this.selectedOrder = null;
  }

  getStatusClass(status: string): string {
    const s = (status || 'pending').toLowerCase();
    return `status-${s}`;
  }

  getOrderTotal(order: any): number {
    return order?.total_amount || 0;
  }

  getUserName(order: any): string {
    if (typeof order.user_id === 'object' && order.user_id?.full_name) {
      return order.user_id.full_name;
    }
    return order.user_id || 'Unknown';
  }

  getOrderItems(order: any): any[] {
    return order?.items || [];
  }

  formatAddress(addr: any): string {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr !== 'object') return '';

    const line1 = String(addr.line1 || addr.street || '').trim();
    const line2 = String(addr.line2 || '').trim();
    const city = String(addr.city || '').trim();
    const state = String(addr.state || '').trim();
    const postalCode = String(addr.postalCode || addr.postal_code || '').trim();
    const country = String(addr.country || '').trim();

    const parts = [line1, line2, city, state, postalCode, country].filter(Boolean);
    return parts.join(', ');
  }
}
