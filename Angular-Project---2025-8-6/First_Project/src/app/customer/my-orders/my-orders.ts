import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { CartService } from '../../services/cart.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-my-orders',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css'
})
export class MyOrders implements OnInit {
  // Loading state
  isLoading = true;
  isExporting = false;

  // Orders data
  orders: any[] = [];

  // Modal states
  selectedOrder: any = null;
  showRefundModal = false;

  // Refund form data
  refundReason = '';

  constructor(
    private apiService: ApiService,
    private cartService: CartService,
    private toast: ToastService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadOrders();
  }

  /**
   * Load customer's orders from API
   * Fetches authenticated user's order history
   */
  loadOrders() {
    this.isLoading = true;
    this.apiService.getMyOrders().subscribe({
      next: (orders) => {
        this.orders = orders || [];
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
   * Check if order can be cancelled
   * Only pending and processing orders can be cancelled
   * @param order - Order to check
   * @returns True if order can be cancelled
   */
  canCancel(order: any): boolean {
    return ['pending', 'processing'].includes(order.status);
  }

  /**
   * Check if order is eligible for refund
   * Must be delivered and within 30 days
   * @param order - Order to check
   * @returns True if refund is available
   */
  canRequestRefund(order: any): boolean {
    // Must be delivered
    if (order.status !== 'delivered') return false;

    // Must not have existing refund
    if (order.refund_status !== 'none') return false;

    // Check 30-day window
    const orderDate = new Date(order.updated_at || order.created_at);
    const daysSinceOrder = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

    return daysSinceOrder <= 30;
  }

  /**
   * Get days remaining for refund eligibility
   * @param order - Order to check
   * @returns Days remaining or 0
   */
  getDaysRemainingForRefund(order: any): number {
    if (order.status !== 'delivered') return 0;

    const orderDate = new Date(order.updated_at || order.created_at);
    const daysSinceOrder = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = 30 - daysSinceOrder;

    return daysRemaining > 0 ? daysRemaining : 0;
  }

  /**
   * Cancel order
   * Shows confirmation dialog before cancelling
   * @param order - Order to cancel
   */
  cancelOrder(order: any) {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    this.apiService.cancelOrder(order._id).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex(o => o._id === order._id);
        if (idx !== -1) this.orders[idx] = updated;
        this.toast.success('Order cancelled successfully');

        // Update selected order if viewing details
        if (this.selectedOrder?._id === order._id) {
          this.selectedOrder = updated;
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Failed to cancel order');
      }
    });
  }

  /**
   * Open refund request modal
   * @param order - Order to request refund for
   */
  openRefundModal(order: any) {
    // Validate refund eligibility
    if (!this.canRequestRefund(order)) {
      this.toast.error('This order is not eligible for refund');
      return;
    }

    this.selectedOrder = order;
    this.refundReason = '';
    this.showRefundModal = true;
  }

  /**
   * Close refund request modal
   */
  closeRefundModal() {
    this.showRefundModal = false;
    this.refundReason = '';
  }

  /**
   * Submit refund request
   * Validates reason and sends request to API
   */
  requestRefund() {
    // Validate refund reason
    if (!this.refundReason.trim()) {
      this.toast.error('Please provide a reason for refund');
      return;
    }

    this.apiService.requestRefund(this.selectedOrder._id, this.refundReason).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex(o => o._id === this.selectedOrder._id);
        if (idx !== -1) this.orders[idx] = updated;
        this.toast.success('Refund request submitted successfully');
        this.closeRefundModal();
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Failed to request refund');
      }
    });
  }

  /**
   * Download invoice PDF for order
   * @param order - Order to download invoice for
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
   * Get CSS class for order status badge
   * @param status - Order status
   * @returns CSS class name
   */
  getStatusClass(status: string): string {
    return `status-${(status || 'pending').toLowerCase()}`;
  }

  /**
   * Get CSS class for refund status badge
   * @param status - Refund status
   * @returns CSS class name
   */
  getRefundStatusClass(status: string): string {
    return `refund-${(status || 'none').toLowerCase()}`;
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
    const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Reorder items from a previous order
   * Adds all items to cart and redirects to cart page
   * @param order - Order to reorder
   */
  reorder(order: any) {
    if (!order || !order.items || order.items.length === 0) return;

    // Simple implementation: add items one by one
    // In a production app, you might want a bulk add API
    let itemsAdded = 0;
    const totalItems = order.items.length;

    order.items.forEach((item: any) => {
      // Note: item.product_id might be an object if populated, or string if not
      // Based on order model, it ref 'Product', so likely populated or ID
      const productId = typeof item.product_id === 'object' ? item.product_id._id : item.product_id;

      this.cartService.addItem(productId, item.size, item.quantity).subscribe({
        next: () => {
          itemsAdded++;
          if (itemsAdded === totalItems) {
            this.toast.success('All items added to cart');
            this.router.navigate(['/cart']);
          }
        },
        error: (err) => {
          console.error('Failed to add item to cart', err);
          // Don't toast for every error to avoid spam, maybe just once at end if needed
        }
      });
    });

    // Fallback navigation if some items fail? 
    // For now, we'll just let the user see what's in the cart.
  }

  /**
   * Get current step number for order progress
   * 1: Pending/Placed
   * 2: Processing
   * 3: Shipped
   * 4: Delivered
   * @param status - Order status
   * @returns Step number (1-4)
   */
  getOrderStep(status: string): number {
    switch (status) {
      case 'pending': return 1;
      case 'processing': return 2;
      case 'shipped': return 3;
      case 'delivered': return 4;
      default: return 0; // Cancelled or unknown
    }
  }

  /**
   * Download a PDF or Excel report of the customer's personal data
   * @param format - Export format (pdf | excel)
   */
  downloadMyReport(format: 'pdf' | 'excel') {
    this.isExporting = true;
    this.toast.info(`Generating ${format.toUpperCase()} report...`);

    this.apiService.exportMyReport(format).subscribe({
      next: (blob) => {
        const ext = format === 'excel' ? 'xlsx' : 'pdf';
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my_orders_report.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isExporting = false;
        this.toast.success('Report exported successfully!');
      },
      error: (err) => {
        console.error('Export failed', err);
        this.isExporting = false;
        this.toast.error('Failed to export report. Please try again.');
      }
    });
  }
}
