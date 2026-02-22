import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-admin-collections',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-collections.html',
  styleUrl: './admin-collections.css' // We can reuse the same CSS or create similar
})
export class AdminCollections implements OnInit {
  collections: any[] = [];
  products: any[] = [];
  loading = true;
  showModal = false;
  isEdit = false;
  currentCollection: any = { name: '', slug: '', type: 'featured', description: '', image: '', isActive: true, products: [] };

  collectionTypes = ['featured', 'seasonal', 'curated', 'new_arrivals'];

  constructor(private apiService: ApiService, private toast: ToastService) { }

  ngOnInit() {
    this.loadCollections();
    this.loadProducts();
  }

  loadCollections() {
    this.loading = true;
    this.apiService.getAdminCollections().subscribe({
      next: (data) => {
        this.collections = data;
        this.loading = false;
      },
      error: (err) => {
        this.toast.error('Failed to load collections');
        this.loading = false;
      }
    });
  }

  loadProducts() {
    // Load products for selection in collections
    this.apiService.getProducts({ limit: 0 }).subscribe({
      next: (data) => {
        this.products = data;
      }
    });
  }

  openAddModal() {
    this.isEdit = false;
    this.currentCollection = { name: '', slug: '', type: 'featured', description: '', image: '', isActive: true, products: [] };
    this.showModal = true;
  }

  openEditModal(collection: any) {
    this.isEdit = true;
    this.currentCollection = { ...collection };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveCollection() {
    if (!this.currentCollection.name || !this.currentCollection.slug) {
      this.toast.error('Name and Slug are required');
      return;
    }

    const request = this.isEdit
      ? this.apiService.updateCollection(this.currentCollection._id, this.currentCollection)
      : this.apiService.createCollection(this.currentCollection);

    request.subscribe({
      next: () => {
        this.toast.success(`Collection ${this.isEdit ? 'updated' : 'created'} successfully`);
        this.closeModal();
        this.loadCollections();
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Failed to save collection');
      }
    });
  }

  deleteCollection(id: string) {
    if (confirm('Are you sure you want to delete this collection?')) {
      this.apiService.deleteCollection(id).subscribe({
        next: () => {
          this.toast.success('Collection deleted');
          this.loadCollections();
        },
        error: (err) => {
          this.toast.error('Failed to delete collection');
        }
      });
    }
  }

  toggleProductSelection(productId: string) {
    const index = this.currentCollection.products.indexOf(productId);
    if (index > -1) {
      this.currentCollection.products.splice(index, 1);
    } else {
      this.currentCollection.products.push(productId);
    }
  }

  isProductSelected(productId: string): boolean {
    return this.currentCollection.products.includes(productId);
  }

  generateSlug() {
    if (!this.currentCollection.slug && this.currentCollection.name) {
      this.currentCollection.slug = this.currentCollection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
  }
}
