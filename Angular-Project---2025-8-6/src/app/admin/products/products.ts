import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule],
  templateUrl: './products.html',
  styleUrl: './products.css'
})

export class Products implements OnInit {
  // --- UI state ---
  products: any[] = [];
  isLoading = true;

  showAddForm = false;
  editingProduct: any = null;

  // --- Image upload state ---
  selectedFiles: File[] = [];

  // --- CSV import/export state ---
  csvFile: File | null = null;

  // --- Toast-based confirmation state ---
  private pendingDeleteProductId: string | null = null;
  private pendingDeleteProductUntil = 0;

  // Messages are displayed globally via ToastService

  newProduct = this.getEmptyProduct();

  constructor(
    private apiService: ApiService,
    private toast: ToastService
  ) {}

  ngOnInit(){
    this.loadProducts();
  }

  private getEmptyProduct() {
    return {
      name: '',
      description: '',
      category: '',
      sub_category: '',
      price: 0,
      discount: 0,
      image: [] as string[],
      sizes: [] as string[],
      colors: [] as string[],
      stock: {S: 0, M: 0, L: 0, XL: 0}
    };
  }

  loadProducts() {
    // --- Read: fetch products list ---
    this.isLoading = true;

    this.apiService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.isLoading = false;
      }, error: (err) => {
        console.error('Error loading products', err);
        this.toast.error('😞 Oops! Could not load products. Please try again.');
        this.isLoading = false;
      }

    });

  }

  // Product Add method
  openAddForm() {
    // --- Create: open add form ---
    this.showAddForm = true;
    this.newProduct = this.getEmptyProduct();
    this.editingProduct = null;
  }

  cancelAdd(){
    // --- Create: close add form ---
    this.showAddForm = false;
    this.newProduct = this.getEmptyProduct();
  }

  submitAdd(){
    // --- Create: submit new product ---

    if (!this.newProduct.name || this.newProduct.price <= 0) {
      this.toast.error('🤔 Please provide a product name and valid price');
      return;
    }

    const payload = this.normalizeProductPayload(this.newProduct);

    this.apiService.createProduct(payload).subscribe({
      next: () => {
        this.toast.success('✨ Product added successfully!');
        this.showAddForm = false;
        this.loadProducts();
      }, error: (err) => {
        console.error('Error adding product', err);
        this.toast.error(err?.error?.error || '😕 Could not create product. Please try again.');
      }
    });
  }

  // Product Edit method
  startEdit(product: any) {
    // --- Update: open edit form with a safe clone ---
    this.showAddForm = false;

    // shallow clone + nested stock clone
    this.editingProduct = { ...product, stock: { ...(product.stock || {S: 0, M: 0, L: 0, XL: 0})  } };
  }

  cancelEdit() {
    // --- Update: close edit form ---
    this.editingProduct = null;
  }

  submitEdit(){
    // --- Update: submit existing product changes ---

    if(!this.editingProduct?._id){
      this.toast.error('😕 Something went wrong. Product ID is missing.');
      return;
    }

    if(!this.editingProduct.name || !this.editingProduct.category){
      this.toast.error('🤔 Please provide product name and category');
      return;
    }

    const payload = this.normalizeProductPayload(this.editingProduct);

    this.apiService.updateProduct(this.editingProduct._id, payload).subscribe({
      next: () => {
        this.toast.success('🎉 Product updated successfully!');
        this.editingProduct = null;
        this.loadProducts();
      },
      error: (err) => {
        console.error('Error updating product', err);
        this.toast.error(err?.error?.error || '😕 Could not update product. Please try again.');
      }
    });
  }

  // Product Delete method with toast-based confirmation
  deleteProduct(product: any) {
    // --- Delete: remove a product by MongoDB _id ---
    const id = product?._id;
    if(!id){
      this.toast.error('😕 Something went wrong. Product ID is missing.');
      return;
    }

    // Toast-based confirmation: tap delete twice within 5 seconds
    const now = Date.now();
    if (this.pendingDeleteProductId !== id || now > this.pendingDeleteProductUntil) {
      this.pendingDeleteProductId = id;
      this.pendingDeleteProductUntil = now + 5000;
      this.toast.warning(`⚠️ Are you sure? Tap delete again to remove "${product.name}"`);
      return;
    }

    // Confirmed deletion
    this.pendingDeleteProductId = null;
    this.pendingDeleteProductUntil = 0;

    this.apiService.deleteProduct(id).subscribe({
      next: () => {
        this.toast.success('✅ Product has been removed successfully');
        this.products = this.products.filter(p => p._id !== id);
      },

      error: (err) => {
        console.error('Error deleting product', err);
        this.toast.error(err?.error?.error || '😞 Could not delete product. Please try again.');
      }
    });
  }

  // Capture selected files from the file input
  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFiles = input.files ? Array.from(input.files) : [];
  }

  // Upload selected images and attach the returned URLs to the current form model
  uploadSelectedImages() {
    if (!this.selectedFiles.length) {
      this.toast.info('📷 Please select one or more images first');
      return;
    }

    this.apiService.uploadImages(this.selectedFiles).subscribe({
      next: (res) => {
        const target = this.showAddForm ? this.newProduct : this.editingProduct;
        target.image = [...(target.image || []), ...(res.urls || [])];
        this.selectedFiles = [];
        this.toast.success('✨ Images uploaded successfully!');
      },
      error: (err) => {
        console.error(err);
        this.toast.error(err?.error?.error || '😞 Image upload failed. Please try again.');
      }
    });
  }

  // Remove an image URL from the add/edit form gallery
  removeImage(url: string) {
    const target = this.showAddForm ? this.newProduct : this.editingProduct;
    target.image = (target.image || []).filter((u: string) => u !== url);
  }
  
  // Capture CSV file selection
  onCsvSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.csvFile = input.files?.[0] || null;
  }

  // Call backend export and download file
  exportCsv() {
    this.apiService.exportProductsCsv().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        this.toast.success('📊 CSV file exported successfully!');
      },
      error: () => this.toast.error('😞 Could not export CSV. Please try again.')
    });
  }

  // Upload CSV to backend import endpoint
  importCsv() {
    if (!this.csvFile) {
      this.toast.info('📄 Please select a CSV file first');
      return;
    }

    this.apiService.importProductsCsv(this.csvFile).subscribe({
      next: (result) => {
        this.toast.success(`✅ Import complete! Added: ${result.inserted}, Updated: ${result.updated}, Failed: ${result.failed}`);
        this.csvFile = null;
        this.loadProducts();
      },
      error: (err) => {
        console.error(err);
        this.toast.error(err?.error?.error || '😞 CSV import failed. Please check the file and try again.');
      }
    });
  }

  // Get first product image or placeholder
  getProductThumbnail(product: any): string {
    if (product?.image && Array.isArray(product.image) && product.image.length > 0) {
      return product.image[0];
    }
    return 'https://via.placeholder.com/60x60/667eea/ffffff?text=No+Image';
  }

  // --- Helpers ---
  private normalizeProductPayload(raw: any) {
    // Ensure numeric fields are numbers (forms can send strings)
    return {
      name: (raw.name || '').trim(),
      description: raw.description || '',
      category: raw.category || '',
      sub_category: raw.sub_category || '',
      price: Number(raw.price || 0),
      discount: Number(raw.discount || 0),
      image: Array.isArray(raw.image) ? raw.image.map((img: string) => img.trim()).filter((img: string) => img) : [],
      sizes: Array.isArray(raw.sizes) ? raw.sizes.map((size: string) => size.trim()).filter((size: string) => size) : [],
      colors: Array.isArray(raw.colors) ? raw.colors.map((color: string) => color.trim()).filter((color: string) => color) : [],
      stock: {
        S: Number(raw.stock?.S || 0),
        M: Number(raw.stock?.M || 0),
        L: Number(raw.stock?.L || 0),
        XL: Number(raw.stock?.XL || 0)
      }
    };
  }

}

