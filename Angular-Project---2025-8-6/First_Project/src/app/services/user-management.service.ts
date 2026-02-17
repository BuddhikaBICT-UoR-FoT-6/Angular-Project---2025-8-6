import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
    _id: string;
    full_name: string;
    email: string;
    phone?: string;
    role: 'superadmin' | 'admin' | 'supplier' | 'customer' | 'visitor';
    status: 'active' | 'inactive' | 'suspended';
    profile_image?: string;
    lastLogin?: Date;
    loginCount?: number;
    created_at: Date;
    updated_at: Date;
}

export interface Activity {
    action: string;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
    performedBy?: {
        _id: string;
        full_name: string;
        email: string;
    };
}

export interface UserListResponse {
    success: boolean;
    data: User[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface UserActivityResponse {
    success: boolean;
    data: {
        user: {
            id: string;
            fullName: string;
            email: string;
        };
        activities: Activity[];
    };
}

@Injectable({
    providedIn: 'root'
})
export class UserManagementService {
    private apiUrl = '/api/users';

    constructor(private http: HttpClient) { }

    /**
     * Get all users with optional filters
     */
    getUsers(filters?: {
        role?: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Observable<UserListResponse> {
        let params = new HttpParams();

        if (filters) {
            if (filters.role) params = params.set('role', filters.role);
            if (filters.status) params = params.set('status', filters.status);
            if (filters.search) params = params.set('search', filters.search);
            if (filters.page) params = params.set('page', filters.page.toString());
            if (filters.limit) params = params.set('limit', filters.limit.toString());
        }

        return this.http.get<UserListResponse>(this.apiUrl, { params });
    }

    /**
     * Get specific user by ID
     */
    getUserById(id: string): Observable<{ success: boolean; data: User }> {
        return this.http.get<{ success: boolean; data: User }>(`${this.apiUrl}/${id}`);
    }

    /**
     * Create new user
     */
    createUser(userData: {
        full_name: string;
        email: string;
        password: string;
        phone?: string;
        role?: string;
        profile_image?: string;
    }): Observable<{ success: boolean; message: string; data: User }> {
        return this.http.post<{ success: boolean; message: string; data: User }>(
            this.apiUrl,
            userData
        );
    }

    /**
     * Update user details
     */
    updateUser(
        id: string,
        userData: {
            full_name?: string;
            email?: string;
            phone?: string;
            role?: string;
            profile_image?: string;
            performedBy?: string;
        }
    ): Observable<{ success: boolean; message: string; data: User }> {
        return this.http.put<{ success: boolean; message: string; data: User }>(
            `${this.apiUrl}/${id}`,
            userData
        );
    }

    /**
     * Update user status (activate/deactivate/suspend)
     */
    updateUserStatus(
        id: string,
        status: 'active' | 'inactive' | 'suspended',
        performedBy?: string
    ): Observable<{ success: boolean; message: string; data: User }> {
        return this.http.patch<{ success: boolean; message: string; data: User }>(
            `${this.apiUrl}/${id}/status`,
            { status, performedBy }
        );
    }

    /**
     * Get user activity log
     */
    getUserActivity(id: string, limit: number = 50): Observable<UserActivityResponse> {
        const params = new HttpParams().set('limit', limit.toString());
        return this.http.get<UserActivityResponse>(`${this.apiUrl}/${id}/activity`, { params });
    }

    /**
     * Initiate password reset for user
     */
    initiatePasswordReset(
        id: string,
        performedBy?: string
    ): Observable<{ success: boolean; message: string; resetToken: string; resetLink: string }> {
        return this.http.post<{ success: boolean; message: string; resetToken: string; resetLink: string }>(
            `${this.apiUrl}/${id}/reset-password`,
            { performedBy }
        );
    }

    /**
     * Complete password reset with token
     */
    completePasswordReset(
        token: string,
        password: string
    ): Observable<{ success: boolean; message: string }> {
        return this.http.post<{ success: boolean; message: string }>(
            `${this.apiUrl}/reset-password/${token}`,
            { password }
        );
    }

    /**
     * Delete user (soft delete)
     */
    deleteUser(
        id: string,
        performedBy?: string
    ): Observable<{ message: string; user: { _id: string; email: string } }> {
        return this.http.request<{ message: string; user: { _id: string; email: string } }>(
            'DELETE',
            `${this.apiUrl}/${id}`,
            { body: { performedBy } }
        );
    }

    /**
     * Get role display name
     */
    getRoleDisplayName(role: string): string {
        const roleNames: { [key: string]: string } = {
            'superadmin': 'Super Admin',
            'admin': 'Administrator',
            'supplier': 'Supplier',
            'customer': 'Customer',
            'visitor': 'Visitor'
        };
        return roleNames[role] || role;
    }

    /**
     * Get status badge class
     */
    getStatusClass(status: string): string {
        const statusClasses: { [key: string]: string } = {
            'active': 'status-active',
            'inactive': 'status-inactive',
            'suspended': 'status-suspended'
        };
        return statusClasses[status] || '';
    }

    /**
     * Get available roles
     */
    getAvailableRoles(): Array<{ value: string; label: string }> {
        return [
            { value: 'superadmin', label: 'Super Admin' },
            { value: 'admin', label: 'Administrator' },
            { value: 'supplier', label: 'Supplier' },
            { value: 'customer', label: 'Customer' },
            { value: 'visitor', label: 'Visitor' }
        ];
    }

    /**
     * Get available statuses
     */
    getAvailableStatuses(): Array<{ value: string; label: string }> {
        return [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' }
        ];
    }
}
