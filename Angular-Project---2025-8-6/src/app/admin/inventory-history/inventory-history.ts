import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { InventoryAuditEntry } from '../../models/inventory.model';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
    selector: 'app-inventory-history',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './inventory-history.html',
    styleUrls: ['./inventory-history.css']
})
export class InventoryHistoryComponent implements OnInit {
    history: InventoryAuditEntry[] = [];
    loading = false;
    limit = 50;

    constructor(private api: ApiService, private toast: ToastService) { }

    ngOnInit(): void {
        this.loadHistory();
    }

    loadHistory() {
        this.loading = true;
        this.api.getGlobalInventoryHistory(this.limit).subscribe({
            next: (data) => {
                this.history = data;
                this.loading = false;
            },
            error: (err) => {
                this.toast.error('Failed to load history');
                this.loading = false;
            }
        });
    }

    loadMore() {
        this.limit += 50;
        this.loadHistory();
    }
}
