import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { InventoryAuditEntry, InventoryItem, LowStockItem, StockBySize } from '../../models/inventory.model';
import { RestockRequest } from '../../models/restock-request.model';

@Component({
  selector: 'app-inventory',
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css'
})
export class Inventory implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  inventory: InventoryItem[] = [];
  lowStock: LowStockItem[] = [];
  selected: InventoryItem | null = null;
  history: InventoryAuditEntry[] = [];

  restockOrders: RestockRequest[] = [];

  loading = false;
  error = '';

  // This form now means: "Request stock from supplier" (not update stock immediately)
  restock: Partial<StockBySize> = { S: 0, M: 0, L: 0, XL: 0 };
  restockSupplier = '';
  restockSupplierEmail = '';
  restockNote = '';
  requestMessage = '';

  adjustDelta: Partial<StockBySize> = { S: 0, M: 0, L: 0, XL: 0 };
  adjustReason = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    timer(0, 5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshInventory();
        this.refreshLowStock();
        if (this.selected?._id) {
          this.refreshHistory(this.selected._id);
          this.refreshRestockOrders(this.selected._id);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  pick(inv: InventoryItem) {
    this.selected = inv;
    this.error = '';
    this.resetForms();
    this.restockSupplier = inv?.supplier || '';
    this.restockSupplierEmail = inv?.supplier_email || '';
    this.requestMessage = '';
    this.refreshHistory(inv._id);
    this.refreshRestockOrders(inv._id);
  }

  private resetForms() {
    this.restock = { S: 0, M: 0, L: 0, XL: 0 };
    this.restockSupplier = '';
    this.restockSupplierEmail = '';
    this.restockNote = '';
    this.requestMessage = '';
    this.adjustDelta = { S: 0, M: 0, L: 0, XL: 0 };
    this.adjustReason = '';
  }

  private refreshInventory() {
    this.api.getInventory().pipe(takeUntil(this.destroy$)).subscribe({
      next: (items) => {
        this.inventory = items || [];
        if (this.selected?._id) {
          const updated = this.inventory.find((x) => x._id === this.selected!._id);
          if (updated) this.selected = updated;
        }
      },
      error: (err) => (this.error = err?.error?.error || 'Failed to load inventory')
    });
  }

  private refreshLowStock() {
    this.api.getLowStockInventory().pipe(takeUntil(this.destroy$)).subscribe({
      next: (items) => (this.lowStock = items || []),
      error: () => (this.lowStock = [])
    });
  }

  private refreshHistory(inventoryId: string) {
    this.api.getInventoryHistory(inventoryId, 50).pipe(takeUntil(this.destroy$)).subscribe({
      next: (items) => (this.history = items || []),
      error: () => (this.history = [])
    });
  }

  private refreshRestockOrders(inventoryId: string) {
    this.api.listRestockRequestsForInventory(inventoryId, 'all', 50).pipe(takeUntil(this.destroy$)).subscribe({
      next: (items) => (this.restockOrders = items || []),
      error: () => (this.restockOrders = [])
    });
  }

  // Restock button => Create supplier order + email code (no stock change).
  submitRestock() {
    if (!this.selected?._id) return;

    this.loading = true;
    this.error = '';
    this.requestMessage = '';

    this.api
      .createRestockRequest({
        inventoryId: this.selected._id,
        requested_by_size: this.restock,
        supplier_name: this.restockSupplier,
        supplier_email: this.restockSupplierEmail,
        note: this.restockNote
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.requestMessage = 'Supplier order created and email sent (code valid 7 days).';
          this.refreshRestockOrders(this.selected!._id);
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error || 'Failed to create supplier order';
        }
      });
  }

  cancelOrder(req: RestockRequest) {
    if (!this.selected?._id) return;
    if (!req?._id) return;

    this.loading = true;
    this.error = '';
    this.requestMessage = '';

    this.api
      .cancelRestockRequest(req._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.refreshRestockOrders(this.selected!._id);
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error || 'Failed to cancel order';
        }
      });
  }

  submitAdjust() {
    if (!this.selected?._id) return;
    if (!this.adjustReason.trim()) {
      this.error = 'Adjustment reason is required';
      return;
    }

    this.loading = true;
    this.error = '';

    this.api
      .adjustInventory(this.selected._id, { delta: this.adjustDelta, reason: this.adjustReason })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.selected = updated;
          this.resetForms();
          this.loading = false;
          this.refreshInventory();
          this.refreshLowStock();
          this.refreshHistory(updated._id);
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error || 'Adjustment failed';
        }
      });
  }

  orderStatus(req: RestockRequest): 'PENDING' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED' {
    if (req.cancelled_at) return 'CANCELLED';
    if (req.fulfilled_at) return 'FULFILLED';
    const exp = req.expires_at ? new Date(req.expires_at).getTime() : 0;
    if (exp && Date.now() > exp) return 'EXPIRED';
    return 'PENDING';
  }

  productName(inv: InventoryItem): string {
    const p: any = inv.product_id;
    return typeof p === 'object' && p ? p.name || p._id : String(p || '');
  }
}