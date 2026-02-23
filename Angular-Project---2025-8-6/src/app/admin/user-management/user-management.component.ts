import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserManagementService, User, UserListResponse } from '../../services/user-management.service';

@Component({
    selector: 'app-user-management',
    imports: [CommonModule, FormsModule],
    templateUrl: './user-management.html',
    styleUrls: ['./user-management.css']
})
export class UserManagementComponent implements OnInit {
    users: User[] = [];
    filteredUsers: User[] = [];
    loading: boolean = false;
    error: string = '';

    // Filters
    selectedRole: string = '';
    selectedStatus: string = '';
    searchTerm: string = '';

    // Pagination
    currentPage: number = 1;
    itemsPerPage: number = 10;
    totalPages: number = 1;
    totalUsers: number = 0;

    // Available options
    roles: Array<{ value: string; label: string }> = [];
    statuses: Array<{ value: string; label: string }> = [];

    // Modal state
    showEditModal: boolean = false;
    showActivityModal: boolean = false;
    selectedUser: User | null = null;
    userActivities: any[] = [];

    // Edit form
    editForm: any = {
        full_name: '',
        email: '',
        phone: '',
        role: ''
    };

    constructor(private userService: UserManagementService) { }

    ngOnInit(): void {
        this.roles = this.userService.getAvailableRoles();
        this.statuses = this.userService.getAvailableStatuses();
        this.loadUsers();
    }

    /**
     * Load users with current filters
     */
    loadUsers(): void {
        this.loading = true;
        this.error = '';

        const filters = {
            role: this.selectedRole || undefined,
            status: this.selectedStatus || undefined,
            search: this.searchTerm || undefined,
            page: this.currentPage,
            limit: this.itemsPerPage
        };

        this.userService.getUsers(filters).subscribe({
            next: (response: UserListResponse) => {
                this.users = response.data;
                this.filteredUsers = response.data;
                this.totalUsers = response.pagination.total;
                this.totalPages = response.pagination.pages;
                this.loading = false;
            },
            error: (err) => {
                this.error = 'Failed to load users. Please try again.';
                this.loading = false;
                console.error('Error loading users:', err);
            }
        });
    }

    /**
     * Apply filters
     */
    applyFilters(): void {
        this.currentPage = 1;
        this.loadUsers();
    }

    /**
     * Clear all filters
     */
    clearFilters(): void {
        this.selectedRole = '';
        this.selectedStatus = '';
        this.searchTerm = '';
        this.currentPage = 1;
        this.loadUsers();
    }

    /**
     * Change page
     */
    changePage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.loadUsers();
        }
    }

    /**
     * Get role display name
     */
    getRoleDisplay(role: string): string {
        return this.userService.getRoleDisplayName(role);
    }

    /**
     * Get status class
     */
    getStatusClass(status: string): string {
        return this.userService.getStatusClass(status);
    }

    /**
     * Open edit modal
     */
    openEditModal(user: User): void {
        this.selectedUser = user;
        this.editForm = {
            full_name: user.full_name,
            email: user.email,
            phone: user.phone || '',
            role: user.role
        };
        this.showEditModal = true;
    }

    /**
     * Close edit modal
     */
    closeEditModal(): void {
        this.showEditModal = false;
        this.selectedUser = null;
    }

    /**
     * Save user changes
     */
    saveUser(): void {
        if (!this.selectedUser) return;

        this.loading = true;
        this.userService.updateUser(this.selectedUser._id, this.editForm).subscribe({
            next: (response) => {
                this.closeEditModal();
                this.loadUsers();
                alert('User updated successfully!');
            },
            error: (err) => {
                this.error = 'Failed to update user. Please try again.';
                this.loading = false;
                console.error('Error updating user:', err);
            }
        });
    }

    /**
     * Toggle user status
     */
    toggleUserStatus(user: User): void {
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        const confirmMessage = `Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} ${user.full_name}?`;

        if (confirm(confirmMessage)) {
            this.loading = true;
            this.userService.updateUserStatus(user._id, newStatus).subscribe({
                next: (response) => {
                    this.loadUsers();
                    alert(response.message);
                },
                error: (err) => {
                    this.error = 'Failed to update user status. Please try again.';
                    this.loading = false;
                    console.error('Error updating status:', err);
                }
            });
        }
    }

    /**
     * Suspend user
     */
    suspendUser(user: User): void {
        const confirmMessage = `Are you sure you want to suspend ${user.full_name}?`;

        if (confirm(confirmMessage)) {
            this.loading = true;
            this.userService.updateUserStatus(user._id, 'suspended').subscribe({
                next: (response) => {
                    this.loadUsers();
                    alert(response.message);
                },
                error: (err) => {
                    this.error = 'Failed to suspend user. Please try again.';
                    this.loading = false;
                    console.error('Error suspending user:', err);
                }
            });
        }
    }

    /**
     * View user activity
     */
    viewActivity(user: User): void {
        this.selectedUser = user;
        this.loading = true;

        this.userService.getUserActivity(user._id).subscribe({
            next: (response) => {
                this.userActivities = response.data.activities;
                this.showActivityModal = true;
                this.loading = false;
            },
            error: (err) => {
                this.error = 'Failed to load user activity. Please try again.';
                this.loading = false;
                console.error('Error loading activity:', err);
            }
        });
    }

    /**
     * Close activity modal
     */
    closeActivityModal(): void {
        this.showActivityModal = false;
        this.selectedUser = null;
        this.userActivities = [];
    }

    /**
     * Reset user password
     */
    resetPassword(user: User): void {
        const confirmMessage = `Are you sure you want to reset the password for ${user.full_name}? A reset link will be generated.`;

        if (confirm(confirmMessage)) {
            this.loading = true;
            this.userService.initiatePasswordReset(user._id).subscribe({
                next: (response) => {
                    this.loading = false;
                    alert(`Password reset initiated!\n\nReset Link: ${response.resetLink}\n\nNote: In production, this would be sent via email.`);
                },
                error: (err) => {
                    this.error = 'Failed to reset password. Please try again.';
                    this.loading = false;
                    console.error('Error resetting password:', err);
                }
            });
        }
    }

    /**
     * Delete user
     */
    deleteUser(user: User): void {
        const confirmMessage = `Are you sure you want to delete ${user.full_name}? This will deactivate their account.`;

        if (confirm(confirmMessage)) {
            this.loading = true;
            this.userService.deleteUser(user._id).subscribe({
                next: (response) => {
                    this.loadUsers();
                    alert(response.message);
                },
                error: (err) => {
                    this.error = 'Failed to delete user. Please try again.';
                    this.loading = false;
                    console.error('Error deleting user:', err);
                }
            });
        }
    }

    /**
     * Format date
     */
    formatDate(date: Date | undefined): string {
        if (!date) return 'Never';
        return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
    }

    /**
     * Get page numbers for pagination
     */
    getPageNumbers(): number[] {
        const pages: number[] = [];
        const maxPagesToShow = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return pages;
    }
}
