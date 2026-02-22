import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-admin-management',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-management.html',
  styleUrl: './admin-management.css'
})
export class AdminManagement implements OnInit {
  isLoading = true;
  users: any[] = [];

  // Modal state
  editModalOpen = false;
  editingUser: any = null;

  // Toast confirmation for delete
  pendingDeleteUserId: string | null = null;
  pendingDeleteUntil = 0;

  constructor(
    private apiService: ApiService,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading = true;
    this.apiService.getUsers().subscribe({
      next: (users: any) => {
        this.users = Array.isArray(users) ? users : (users?.data || []);
        this.isLoading = false;
        this.toast.success('Admin users loaded successfully');
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.isLoading = false;
        this.toast.error('Failed to load admin users');
      }
    });
  }

  get admins(): any[] {
    return (this.users || []).filter((u) => u.role === 'admin' || u.role === 'superadmin');
  }

  openEditModal(user: any) {
    this.editingUser = { ...user };
    this.editModalOpen = true;
  }

  closeEditModal() {
    this.editModalOpen = false;
    this.editingUser = null;
  }

  saveRole() {
    if (!this.editingUser?._id) return;

    this.apiService.updateUser(this.editingUser._id, { role: this.editingUser.role }).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex((u) => u._id === updated?._id);
        if (idx >= 0) this.users[idx] = { ...this.users[idx], ...updated };
        this.toast.success('User role updated successfully');
        this.closeEditModal();
      },
      error: (err) => {
        console.error('Failed to update role', err);
        this.toast.error('Failed to update user role');
      }
    });
  }

  deleteUser(user: any) {
    if (!user?._id) return;

    // Toast-based double-tap confirmation
    const now = Date.now();
    if (this.pendingDeleteUserId !== user._id || now > this.pendingDeleteUntil) {
      this.pendingDeleteUserId = user._id;
      this.pendingDeleteUntil = now + 5000;
      this.toast.warning('Tap Delete again within 5 seconds to confirm removing this admin');
      return;
    }

    // Confirmed
    this.pendingDeleteUserId = null;
    this.pendingDeleteUntil = 0;

    this.apiService.deleteUser(user._id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u._id !== user._id);
        this.toast.success('Admin user removed successfully');
      },
      error: (err) => {
        console.error('Failed to delete user', err);
        this.toast.error('Failed to remove admin user');
      }
    });
  }
}
