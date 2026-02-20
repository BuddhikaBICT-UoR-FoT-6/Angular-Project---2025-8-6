import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';
import { RestockRequest } from '../../models/restock-request.model';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-restock-requests',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './restock-requests.html',
  styleUrl: './restock-requests.css'
})
export class RestockRequests implements OnInit {
  requests: RestockRequest[] = [];
  loading = true;
  statusFilter: 'all' | 'pending' | 'fulfilled' | 'cancelled' | 'expired' = 'all';

  showCancelModal = false;
  requestToCancel: RestockRequest | null = null;
  cancelReason = '';

  constructor(private apiService: ApiService, private toast: ToastService) { }

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.loading = true;
    // Typing the status properly based on what ApiService expects for listRestockRequests
    const statusParam: 'all' | 'pending' | 'fulfilled' =
      (this.statusFilter === 'pending' || this.statusFilter === 'fulfilled') ? this.statusFilter : 'all';

    this.apiService.listRestockRequests(statusParam, 100).subscribe({
      next: (data) => {
        // If we filtered by 'all' but have a UI filter for cancelled/expired, filter locally
        if (this.statusFilter === 'cancelled') {
          this.requests = data.filter(r => !!r.cancelled_at);
        } else if (this.statusFilter === 'expired') {
          this.requests = data.filter(r => !r.fulfilled_at && !r.cancelled_at && new Date(r.expires_at) < new Date());
        } else {
          this.requests = data;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.toast.error('Failed to load restock requests');
        this.loading = false;
      }
    });
  }

  onFilterChange(status: any) {
    this.statusFilter = status;
    this.loadRequests();
  }

  openCancelModal(request: RestockRequest) {
    this.requestToCancel = request;
    this.cancelReason = '';
    this.showCancelModal = true;
  }

  closeCancelModal() {
    this.showCancelModal = false;
    this.requestToCancel = null;
    this.cancelReason = '';
  }

  confirmCancel() {
    if (!this.requestToCancel) return;

    this.apiService.cancelRestockRequest(this.requestToCancel._id, this.cancelReason).subscribe({
      next: () => {
        this.toast.success('Restock request cancelled successfully');
        this.closeCancelModal();
        this.loadRequests();
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Failed to cancel request');
      }
    });
  }

  getRequestedQuantityTotal(request: RestockRequest): number {
    if (!request.requested_by_size) return 0;
    return Object.values(request.requested_by_size).reduce((sum: number, val: unknown) => sum + ((val as number) || 0), 0);
  }

  getRequestedSizes(request: RestockRequest): string {
    if (!request.requested_by_size) return 'N/A';
    return Object.entries(request.requested_by_size)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([size, qty]) => `${size}: ${qty}`)
      .join(', ');
  }

  getStatusDisplay(request: RestockRequest): string {
    if (request.cancelled_at) return 'Cancelled';
    if (request.fulfilled_at) return 'Fulfilled';
    if (new Date(request.expires_at) < new Date()) return 'Expired';
    return 'Pending';
  }
}
