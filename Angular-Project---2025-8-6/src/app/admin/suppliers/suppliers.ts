import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Supplier } from '../../models/supplier.model';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
    selector: 'app-suppliers',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './suppliers.html',
    styleUrls: ['./suppliers.css']
})
export class SuppliersComponent implements OnInit {
    suppliers: Supplier[] = [];
    loading = false;
    error = '';

    // Modal state
    isModalOpen = false;
    editingSupplier: Supplier | null = null;
    supplierForm: Partial<Supplier> = {
        name: '',
        email: '',
        phone: '',
        contact_person: '',
        address: '',
        notes: ''
    };

    constructor(private api: ApiService, private toast: ToastService) { }

    ngOnInit(): void {
        this.loadSuppliers();
    }

    loadSuppliers() {
        this.loading = true;
        this.api.getSuppliers().subscribe({
            next: (data) => {
                this.suppliers = data;
                this.loading = false;
            },
            error: (err) => {
                this.error = 'Failed to load suppliers';
                this.loading = false;
                this.toast.error(this.error);
            }
        });
    }

    openAddModal() {
        this.editingSupplier = null;
        this.supplierForm = { name: '', email: '', phone: '', contact_person: '', address: '', notes: '' };
        this.isModalOpen = true;
    }

    openEditModal(supplier: Supplier) {
        this.editingSupplier = supplier;
        this.supplierForm = { ...supplier };
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.editingSupplier = null;
    }

    saveSupplier() {
        if (!this.supplierForm.name || !this.supplierForm.email) {
            this.toast.warning('Name and Email are required');
            return;
        }

        this.loading = true;
        if (this.editingSupplier) {
            this.api.updateSupplier(this.editingSupplier._id, this.supplierForm).subscribe({
                next: () => {
                    this.toast.success('Supplier updated successfully');
                    this.loadSuppliers();
                    this.closeModal();
                    this.loading = false;
                },
                error: (err) => {
                    this.toast.error(err?.error?.error || 'Failed to update supplier');
                    this.loading = false;
                }
            });
        } else {
            this.api.createSupplier(this.supplierForm).subscribe({
                next: () => {
                    this.toast.success('Supplier created successfully');
                    this.loadSuppliers();
                    this.closeModal();
                    this.loading = false;
                },
                error: (err) => {
                    this.toast.error(err?.error?.error || 'Failed to create supplier');
                    this.loading = false;
                }
            });
        }
    }

    deleteSupplier(id: string) {
        if (confirm('Are you sure you want to delete this supplier?')) {
            this.api.deleteSupplier(id).subscribe({
                next: () => {
                    this.toast.success('Supplier deleted');
                    this.loadSuppliers();
                },
                error: (err) => {
                    this.toast.error('Failed to delete supplier');
                }
            });
        }
    }
}
