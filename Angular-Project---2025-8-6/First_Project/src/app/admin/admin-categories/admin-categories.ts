import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-admin-categories',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.css'
})
export class AdminCategories implements OnInit {
  categories: any[] = [];
  loading = true;
  showModal = false;
  isEdit = false;
  currentCategory: any = { name: '', description: '', image: '', isActive: true };

  constructor(private apiService: ApiService, private toast: ToastService) { }

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.loading = true;
    this.apiService.getAdminCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.loading = false;
      },
      error: (err) => {
        this.toast.error('Failed to load categories');
        this.loading = false;
      }
    });
  }

  openAddModal() {
    this.isEdit = false;
    this.currentCategory = { name: '', description: '', image: '', isActive: true };
    this.showModal = true;
  }

  openEditModal(category: any) {
    this.isEdit = true;
    this.currentCategory = { ...category };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveCategory() {
    if (!this.currentCategory.name) {
      this.toast.error('Name is required');
      return;
    }

    const request = this.isEdit
      ? this.apiService.updateCategory(this.currentCategory._id, this.currentCategory)
      : this.apiService.createCategory(this.currentCategory);

    request.subscribe({
      next: () => {
        this.toast.success(`Category ${this.isEdit ? 'updated' : 'created'} successfully`);
        this.closeModal();
        this.loadCategories();
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Failed to save category');
      }
    });
  }

  deleteCategory(id: string) {
    if (confirm('Are you sure you want to delete this category?')) {
      this.apiService.deleteCategory(id).subscribe({
        next: () => {
          this.toast.success('Category deleted');
          this.loadCategories();
        },
        error: (err) => {
          this.toast.error('Failed to delete category');
        }
      });
    }
  }
}
