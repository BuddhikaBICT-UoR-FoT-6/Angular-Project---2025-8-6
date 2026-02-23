import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-customer-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-dashboard.html',
  styleUrl: './customer-dashboard.css'
})
export class CustomerDashboard implements OnInit {
  user: any;
  myOrders: any[] = [];
  isLoading = true;
  activeTab = 'profile';
  
  profileForm: any = {};
  passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  addresses: any[] = [];
  addressForm: any = {};
  editingAddressId: string | null = null;
  paymentMethods: any[] = [];
  paymentForm: any = {};
  emailPreferences: any = {};
  message = '';
  error = '';

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
    this.loadCustomerData();
  }

  private loadCustomerData() {
    this.userService.getProfile().subscribe({
      next: (user) => {
        this.user = user;
        this.profileForm = { 
          full_name: user.full_name, 
          phone: user.phone, 
          address: user.address || { houseNo: '', street: '', city: '', country: '' } 
        };
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.isLoading = false;
      }
    });

    this.apiService.getOrders().subscribe({
      next: (orders) => {
        this.myOrders = orders.filter(order => order.user_id === this.user?.userId);
      },
      error: (error) => console.error('Error loading orders:', error)
    });
  }

  setTab(tab: string) {
    this.activeTab = tab;
    this.message = '';
    this.error = '';
    
    if (tab === 'addresses' && this.addresses.length === 0) {
      this.loadAddresses();
    } else if (tab === 'payment' && this.paymentMethods.length === 0) {
      this.loadPaymentMethods();
    } else if (tab === 'email' && !this.emailPreferences.marketing) {
      this.loadEmailPreferences();
    }
  }

  updateProfile() {
    this.userService.updateProfile(this.profileForm).subscribe({
      next: () => {
        this.message = 'Profile updated successfully';
        this.error = '';
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update profile';
        this.message = '';
      }
    });
  }

  changePassword() {
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }
    
    this.userService.changePassword(this.passwordForm.currentPassword, this.passwordForm.newPassword).subscribe({
      next: () => {
        this.message = 'Password changed successfully';
        this.error = '';
        this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to change password';
        this.message = '';
      }
    });
  }

  loadAddresses() {
    this.userService.getAddresses().subscribe({
      next: (addresses) => this.addresses = addresses,
      error: (err) => console.error('Error loading addresses:', err)
    });
  }

  addAddress() {
    this.userService.addAddress(this.addressForm).subscribe({
      next: (addresses) => {
        this.addresses = addresses;
        this.addressForm = {};
        this.message = 'Address added successfully';
      },
      error: (err) => this.error = err.error?.error || 'Failed to add address'
    });
  }

  editAddress(address: any) {
    this.editingAddressId = address._id;
    this.addressForm = { ...address };
  }

  updateAddress() {
    if (!this.editingAddressId) return;
    
    this.userService.updateAddress(this.editingAddressId, this.addressForm).subscribe({
      next: (addresses) => {
        this.addresses = addresses;
        this.addressForm = {};
        this.editingAddressId = null;
        this.message = 'Address updated successfully';
      },
      error: (err) => this.error = err.error?.error || 'Failed to update address'
    });
  }

  deleteAddress(addressId: string) {
    if (!confirm('Delete this address?')) return;
    
    this.userService.deleteAddress(addressId).subscribe({
      next: (addresses) => {
        this.addresses = addresses;
        this.message = 'Address deleted successfully';
      },
      error: (err) => this.error = err.error?.error || 'Failed to delete address'
    });
  }

  loadPaymentMethods() {
    this.userService.getPaymentMethods().subscribe({
      next: (methods) => this.paymentMethods = methods,
      error: (err) => console.error('Error loading payment methods:', err)
    });
  }

  addPaymentMethod() {
    this.userService.addPaymentMethod(this.paymentForm).subscribe({
      next: (methods) => {
        this.paymentMethods = methods;
        this.paymentForm = {};
        this.message = 'Payment method added successfully';
      },
      error: (err) => this.error = err.error?.error || 'Failed to add payment method'
    });
  }

  deletePaymentMethod(methodId: string) {
    if (!confirm('Delete this payment method?')) return;
    
    this.userService.deletePaymentMethod(methodId).subscribe({
      next: (methods) => {
        this.paymentMethods = methods;
        this.message = 'Payment method deleted successfully';
      },
      error: (err) => this.error = err.error?.error || 'Failed to delete payment method'
    });
  }

  loadEmailPreferences() {
    this.userService.getEmailPreferences().subscribe({
      next: (prefs) => this.emailPreferences = prefs,
      error: (err) => console.error('Error loading email preferences:', err)
    });
  }

  updateEmailPreferences() {
    this.userService.updateEmailPreferences(this.emailPreferences).subscribe({
      next: () => {
        this.message = 'Email preferences updated successfully';
        this.error = '';
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to update email preferences';
        this.message = '';
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}