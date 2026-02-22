import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { InventoryAuditEntry, InventoryItem, LowStockItem, StockBySize } from '../../models/inventory.model';
import { RestockRequest } from '../../models/restock-request.model';
import { Supplier } from '../../models/supplier.model';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-inventory',
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css'
})
export class Inventory implements OnInit, OnDestroy {
  onSupplierChange(event: any) {
    const supplierId = event.target.value;
    const supplier = this.suppliers.find(s => s._id === supplierId);
    if (supplier) {
      this.restockSupplier = supplier.name;
      this.restockSupplierEmail = supplier.email;
    }
  }
  private destroy$ = new Subject<void>();

  manageOpen = false;
  private previousBodyOverflow: string | null = null;

  inventory: InventoryItem[] = [];
  lowStock: LowStockItem[] = [];
  selected: InventoryItem | null = null;
  history: InventoryAuditEntry[] = [];
  suppliers: Supplier[] = [];

  restockOrders: RestockRequest[] = [];

  // Toast-based confirmation for cancelling supplier orders.
  private pendingCancelOrderId: string | null = null;
  private pendingCancelOrderUntil = 0;

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

  constructor(
    private api: ApiService,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    timer(0, 5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshInventory();
        this.refreshLowStock();
        this.loadSuppliers(); // Load suppliers for dropdown
        if (this.selected?._id) {
          this.refreshHistory(this.selected._id);
          this.refreshRestockOrders(this.selected._id);
        }
      });
  }

  loadSuppliers() {
    this.api.getSuppliers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => (this.suppliers = data),
      error: () => console.error('Failed to load suppliers')
    });
  }

  ngOnDestroy(): void {
    this.closeManage();
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
    this.openManage();
  }

  openManage() {
    this.manageOpen = true;
    this.setBodyScrollLocked(true);
  }

  closeManage() {
    this.manageOpen = false;
    this.setBodyScrollLocked(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event) {
    if (!this.manageOpen) return;
    (event as KeyboardEvent).preventDefault();
    this.closeManage();
  }

  private setBodyScrollLocked(locked: boolean) {
    // Browser-only guard (app supports SSR).
    const body = (globalThis as any)?.document?.body as HTMLBodyElement | undefined;
    if (!body) return;

    if (locked) {
      if (this.previousBodyOverflow === null) {
        this.previousBodyOverflow = body.style.overflow || '';
      }
      body.style.overflow = 'hidden';
    } else {
      if (this.previousBodyOverflow !== null) {
        body.style.overflow = this.previousBodyOverflow;
        this.previousBodyOverflow = null;
      }
    }
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
          this.toast.success(this.requestMessage);
          this.refreshRestockOrders(this.selected!._id);
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error || 'Failed to create supplier order';
          this.toast.error(this.error);
        }
      });
  }

  cancelOrder(req: RestockRequest) {
    if (!this.selected?._id) return;
    if (!req?._id) return;

    // Toast-based confirmation (no browser confirm). Tap cancel twice within 5 seconds.
    const now = Date.now();
    if (this.pendingCancelOrderId !== req._id || now > this.pendingCancelOrderUntil) {
      this.pendingCancelOrderId = req._id;
      this.pendingCancelOrderUntil = now + 5000;
      this.toast.warning('Tap Cancel again within 5 seconds to confirm cancelling this supplier order');
      return;
    }

    // Confirmed.
    this.pendingCancelOrderId = null;
    this.pendingCancelOrderUntil = 0;

    this.loading = true;
    this.error = '';
    this.requestMessage = '';

    this.api
      .cancelRestockRequest(req._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          this.loading = false;
          this.toast.info('Supplier order cancelled');

          const emailStatus = resp?.emailStatus;
          if (emailStatus?.attempted) {
            if (emailStatus.success) {
              this.toast.success('Cancellation email sent to supplier');
            } else if (emailStatus.skipped) {
              this.toast.warning('Cancellation email skipped (email not configured)');
            } else {
              const msg = emailStatus.error ? String(emailStatus.error) : 'Unknown error';
              this.toast.error(`Cancellation email failed: ${msg}`);
            }
          }

          this.refreshRestockOrders(this.selected!._id);
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error || 'Failed to cancel order';
          this.toast.error(this.error);
        }
      });
  }

  submitAdjust() {
    if (!this.selected?._id) return;
    if (!this.adjustReason.trim()) {
      this.error = 'Adjustment reason is required';
      this.toast.warning(this.error);
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
          this.toast.success('Adjustment applied');
          this.refreshInventory();
          this.refreshLowStock();
          this.refreshHistory(updated._id);
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.error || 'Adjustment failed';
          this.toast.error(this.error);
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