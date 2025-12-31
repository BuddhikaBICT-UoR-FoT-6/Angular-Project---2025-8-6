import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-management',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-management.html',
  styleUrl: './admin-management.css'
})
export class AdminManagement implements OnInit {
  isLoading = true;
  users: any[] = [];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading = true;
    this.apiService.getUsers().subscribe({
      next: (users) => {
        this.users = (users || []).slice();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.isLoading = false;
      }
    });
  }

  get admins(): any[] {
    return (this.users || []).filter((u) => u.role === 'admin' || u.role === 'superadmin');
  }

  saveRole(user: any) {
    if (!user?._id) return;

    this.apiService.updateUser(user._id, { role: user.role }).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex((u) => u._id === updated?._id);
        if (idx >= 0) this.users[idx] = { ...this.users[idx], ...updated };
      },
      error: (err) => {
        console.error('Failed to update role', err);
      }
    });
  }
}
