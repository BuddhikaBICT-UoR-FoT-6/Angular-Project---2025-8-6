import { Routes } from '@angular/router';
import { Dashboard } from './admin/dashboard/dashboard';
import { Showroom } from './customer/showroom/showroom';
import { ProductDetails } from './customer/product-details/product-details';
import { Cart } from './customer/cart/cart';
import { Checkout } from './customer/checkout/checkout';
import { Login } from './customer/login/login';
import { Register } from './customer/register/register';
import { ForgotPassword } from './customer/forgot-password/forgot-password';
import { RegistrationResult } from './registration-result';
import { LoginResult } from './login-result';
import { CustomerDashboard } from './customer/customer-dashboard/customer-dashboard';
import { SuperadminDashboard } from './superadmin/dashboard/superadmin-dashboard';
import { Products } from './admin/products/products';
import { Inventory } from './admin/inventory/inventory';
import { Users } from './admin/users/users';
import { Financials } from './admin/financials/financials';
import { Orders } from './admin/orders/orders';
import { Reports } from './admin/reports/reports';
import { Analytics } from './admin/analytics/analytics';
import { AdminManagement } from './admin/admin-management/admin-management';
import { AdminCategories } from './admin/admin-categories/admin-categories';
import { AdminCollections } from './admin/admin-collections/admin-collections';
import { RestockRequests } from './admin/restock-requests/restock-requests';
import { SupplierRestockRequests } from './supplier/restock-requests/restock-requests';
import { MyOrders } from './customer/my-orders/my-orders';

import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', component: Showroom },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'registration-result', component: RegistrationResult },
  { path: 'login-result', component: LoginResult },
  { path: 'product/:id', component: ProductDetails },
  { path: 'cart', component: Cart },
  { path: 'checkout', component: Checkout },

  // Customer Routes (Authenticated Only)
  { path: 'customer/dashboard', component: CustomerDashboard, canActivate: [authGuard] },
  { path: 'customer/my-orders', component: MyOrders, canActivate: [authGuard] },

  // Admin Routes (Authenticated + Admin/Superadmin Role)
  { path: 'admin', redirectTo: 'admin/dashboard', pathMatch: 'full' },
  { path: 'admin/dashboard', component: Dashboard, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/products', component: Products, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/inventory', component: Inventory, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/users', component: Users, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/financials', component: Financials, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/orders', component: Orders, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/reports', component: Reports, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/analytics', component: Analytics, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/admin-management', component: AdminManagement, canActivate: [authGuard, roleGuard], data: { roles: ['superadmin'] } }, // Restrict to Superadmin
  { path: 'admin/categories', component: AdminCategories, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/collections', component: AdminCollections, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },
  { path: 'admin/restock-requests', component: RestockRequests, canActivate: [authGuard, roleGuard], data: { roles: ['admin', 'superadmin'] } },

  // Superadmin Only Routes
  { path: 'superadmin/dashboard', component: SuperadminDashboard, canActivate: [authGuard, roleGuard], data: { roles: ['superadmin'] } },

  // Supplier Routes
  { path: 'supplier/restock-requests', component: SupplierRestockRequests, canActivate: [authGuard, roleGuard], data: { roles: ['supplier'] } },

  { path: '**', redirectTo: '' }
];
