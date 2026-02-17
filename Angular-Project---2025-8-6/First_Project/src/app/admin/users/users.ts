import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-users',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  isLoading = true;
  users: any[] = [];
  filteredUsers: any[] = [];
  selectedRole: string = 'all';
  searchQuery: string = '';
  
  showAddForm = false;
  editingUser: any = null;
  
  newUser = this.getEmptyUser();
  
  // Confirmation state
  private pendingDeleteUserId: string | null = null;
  private pendingDeleteUserUntil = 0;

  constructor(
    private api: ApiService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  private getEmptyUser() {
    return {
      full_name: '',
      email: '',
      password: '',
      role: 'customer'
    };
  }

  loadUsers() {
    this.isLoading = true;
    this.api.getUsers().subscribe({
      next: (users) => {
        this.users = users || [];
        this.applyFilters();
        this.isLoading = false;
        this.toast.success('🎉 All users loaded and ready!');
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.toast.error('😞 Oops! Could not load users. Please try again.');
        this.isLoading = false;
      }
    });
  }

  applyFilters() {
    let result = [...this.users];
    
    if (this.selectedRole !== 'all') {
      result = result.filter(u => u.role === this.selectedRole);
    }
    
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(u => 
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }
    
    this.filteredUsers = result;
  }

  filterByRole(role: string) {
    this.selectedRole = role;
    this.applyFilters();
  }

  onSearchChange() {
    this.applyFilters();
  }

  openAddForm() {
    this.showAddForm = true;
    this.editingUser = null;
    this.newUser = this.getEmptyUser();
  }

  cancelAdd() {
    this.showAddForm = false;
    this.newUser = this.getEmptyUser();
  }

  submitAdd() {
    if (!this.newUser.full_name || !this.newUser.email || !this.newUser.password) {
      this.toast.error('🤔 Please fill in all the required fields');
      return;
    }

    this.api.createUser(this.newUser).subscribe({
      next: () => {
        this.toast.success('✨ New user created successfully!');
        this.showAddForm = false;
        this.loadUsers();
      },
      error: (err) => {
        this.toast.error(err?.error?.error || '😕 Could not create user. Please check the details and try again.');
      }
    });
  }

  startEdit(user: any) {
    this.showAddForm = false;
    this.editingUser = { ...user };
    delete this.editingUser.password; // Don't edit password this way
  }

  cancelEdit() {
    this.editingUser = null;
  }

  submitEdit() {
    if (!this.editingUser?._id || !this.editingUser.full_name || !this.editingUser.email) {
      this.toast.error('🤔 Please fill in all the required fields');
      return;
    }

    this.api.updateUser(this.editingUser._id, this.editingUser).subscribe({
      next: () => {
        this.toast.success('🎉 User updated successfully!');
        this.editingUser = null;
        this.loadUsers();
      },
      error: (err) => {
        this.toast.error(err?.error?.error || '😕 Could not update user. Please try again.');
      }
    });
  }

  deleteUser(user: any) {
    if (!user?._id) return;

    const now = Date.now();
    if (this.pendingDeleteUserId !== user._id || now > this.pendingDeleteUserUntil) {
      this.pendingDeleteUserId = user._id;
      this.pendingDeleteUserUntil = now + 5000;
      this.toast.warning(`⚠️ Are you sure? Tap delete again to remove "${user.full_name}"`);
      return;
    }

    this.pendingDeleteUserId = null;
    this.pendingDeleteUserUntil = 0;

    this.api.deleteUser(user._id).subscribe({
      next: () => {
        this.toast.success('✅ User has been removed successfully');
        this.users = this.users.filter(u => u._id !== user._id);
        this.applyFilters();
      },
      error: (err) => {
        this.toast.error(err?.error?.error || '😞 Could not delete user. Please try again.');
      }
    });
  }

  getRoleBadgeClass(role: string): string {
    return `role-${(role || 'customer').toLowerCase()}`;
  }
}
