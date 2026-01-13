import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-orders',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit {
  // Loading state
  isLoading = true;
  
  // Orders data
  orders: any[] = [];
  filteredOrders: any[] = [];
  
  // Filter state
  selectedStatus: string = 'all';
  
  // Modal states
  selectedOrder: any = null;
  showRefundModal = false;
  refundOrder: any = null;
  
  // Refund form data
  refundReason = '';
  refundAmount = 0;

  constructor(
    private apiService: ApiService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  /**
   * Load all orders from API
   * Displays orders in reverse chronological order
   */
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

  /**
   * Apply status filter to orders list
   * Filters by selected status or shows all
   */
  applyFilter() {
    if (this.selectedStatus === 'all') {
      this.filteredOrders = [...this.orders];
    } else {
      this.filteredOrders = this.orders.filter(o => 
        (o.status || 'pending').toLowerCase() === this.selectedStatus.toLowerCase()
      );
    }
  }

  /**
   * Change active status filter
   * @param status - Status to filter by
   */
  filterByStatus(status: string) {
    this.selectedStatus = status;
    this.applyFilter();
  }

  /**
   * Open order details modal
   * @param order - Order to display
   */
  viewOrderDetails(order: any) {
    this.selectedOrder = order;
  }

  /**
   * Close order details modal
   */
  closeDetails() {
    this.selectedOrder = null;
  }

  /**
   * Update order status
   * @param order - Order to update
   * @param newStatus - New status value or event
   */
  changeOrderStatus(order: any, newStatus: any) {
    const status = typeof newStatus === 'string' ? newStatus : newStatus.target?.value;
    if (!status || status === order.status) return;

    this.apiService.updateOrderStatus(order._id, status).subscribe({
      next: (updated) => {
        order.status = updated.status;
        this.applyFilter();
        this.toast.success(`Order status updated to ${status}`);
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Failed to update status');
      }
    });
  }

  /**
   * Open refund modal
   * @param order - Order to refund
   */
  openRefundModal(order: any) {
    this.refundOrder = order;
    this.refundAmount = order.total_amount;
    this.refundReason = '';
    this.showRefundModal = true;
  }

  /**
   * Close refund modal
   */
  closeRefundModal() {
    this.showRefundModal = false;
    this.refundOrder = null;
  }

  /**
   * Process refund for order
   * @param order - Optional order parameter
   */
  processRefund(order?: any) {
    const targetOrder = order || this.refundOrder;
    if (!targetOrder) return;

    // Validate refund reason
    if (this.showRefundModal && !this.refundReason.trim()) {
      this.toast.error('Please provide a refund reason');
      return;
    }

    const reason = this.refundReason || 'Admin refund';
    const amount = this.refundAmount || targetOrder.total_amount;

    this.apiService.processRefund(targetOrder._id, reason, amount).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex(o => o._id === targetOrder._id);
        if (idx !== -1) this.orders[idx] = updated;
        this.applyFilter();
        this.toast.success('Refund processed successfully');
        this.closeRefundModal();
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Failed to process refund');
      }
    });
  }

  /**
   * Download invoice PDF for order
   * @param order - Order to generate invoice for
   */
  downloadInvoice(order: any) {
    this.apiService.downloadInvoice(order._id).subscribe({
      next: (blob) => {
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${order._id}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.toast.success('Invoice downloaded successfully');
      },
      error: (err) => {
        this.toast.error('Failed to download invoice');
      }
    });
  }

  /**
   * Generate and print invoice (legacy method)
   * @param order - Order to generate invoice for
   */
  generateInvoice(order: any) {
    const invoice = this.createInvoiceHTML(order);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(invoice);
      win.document.close();
      win.print();
    }
  }

  /**
   * Create HTML invoice for printing
   * @param order - Order data
   * @returns HTML string
   */
  private createInvoiceHTML(order: any): string {
    const items = this.getOrderItems(order);
    const itemsHTML = items.map(item => `
      <tr>
        <td>${item.name || 'Product'}</td>
        <td>${item.size || '-'}</td>
        <td>${item.quantity || 1}</td>
        <td>$${(item.price || 0).toFixed(2)}</td>
        <td>$${((item.quantity || 1) * (item.price || 0)).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - Order #${order._id?.slice(-8)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; font-weight: bold; }
          .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
          .info { margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>INVOICE</h1>
        <div class="info">
          <p><strong>Order ID:</strong> ${order._id}</p>
          <p><strong>Date:</strong> ${new Date(order.created_at || order.createdAt).toLocaleDateString()}</p>
          <p><strong>Customer:</strong> ${this.getUserName(order)}</p>
          <p><strong>Status:</strong> ${order.status || 'pending'}</p>
          <p><strong>Shipping Address:</strong> ${this.formatAddress(order.shipping_address)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
        <div class="total">Total: $${this.getOrderTotal(order).toFixed(2)}</div>
      </body>
      </html>
    `;
  }

  /**
   * Get CSS class for order status badge
   * @param status - Order status
   * @returns CSS class name
   */
  getStatusClass(status: string): string {
    const s = (status || 'pending').toLowerCase();
    return `status-${s}`;
  }

  /**
   * Get order total amount
   * @param order - Order object
   * @returns Total amount
   */
  getOrderTotal(order: any): number {
    return order?.total_amount || 0;
  }

  /**
   * Get customer name from order
   * @param order - Order object
   * @returns Customer name
   */
  getUserName(order: any): string {
    if (typeof order.user_id === 'object' && order.user_id?.full_name) {
      return order.user_id.full_name;
    }
    return order.user_id || 'Unknown';
  }

  /**
   * Get order items array
   * @param order - Order object
   * @returns Array of order items
   */
  getOrderItems(order: any): any[] {
    return order?.items || [];
  }

  /**
   * Format shipping address for display
   * @param addr - Address object
   * @returns Formatted address string
   */
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
