import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { RestockRequest } from '../../models/restock-request.model';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-supplier-restock-requests',
  imports: [CommonModule, FormsModule],
  templateUrl: './restock-requests.html',
  styleUrl: './restock-requests.css'
})
export class SupplierRestockRequests implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private didShowLoadErrorToast = false;

  requests: RestockRequest[] = [];
  loading = false;
  error = '';

  fulfillCode = '';
  fulfillMessage = '';

  constructor(
    private api: ApiService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // Poll so the supplier sees new requests without refresh.
    timer(0, 8000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh() {
    this.api.getMyRestockRequests().pipe(takeUntil(this.destroy$)).subscribe({
      next: (items) => {
        this.requests = items || [];
        this.didShowLoadErrorToast = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to load restock requests';
        this.requests = [];

        // Avoid spamming toasts because refresh polls.
        if (!this.didShowLoadErrorToast) {
          this.toast.error(this.error);
          this.didShowLoadErrorToast = true;
        }
      }
    });
  }

  productName(req: RestockRequest): string {
    const p: any = req.product_id;
    return typeof p === 'object' && p ? p.name || p._id : String(p || '');
  }

  fulfill() {
    const code = this.fulfillCode.trim().toUpperCase();
    if (!code) return;

    this.loading = true;
    this.error = '';
    this.fulfillMessage = '';

    this.api
      .fulfillRestockRequest(code)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          this.loading = false;
          this.fulfillCode = '';
          this.fulfillMessage = resp?.message || 'Request fulfilled';
          this.toast.success(this.fulfillMessage);
          this.refresh();
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error || 'Failed to fulfill request';
          this.toast.error(this.error);
        }
      });
  }
}
