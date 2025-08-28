import { Routes } from '@angular/router';
import { Dashboard } from './admin/dashboard/dashboard';
import { Showroom } from './customer/showroom/showroom';
import { ProductDetails } from './customer/product-details/product-details';
import { Cart } from './customer/cart/cart';
import { Login } from './customer/login/login';
import { Register } from './customer/register/register';
import { RegistrationResult } from './registration-result';
import { LoginResult } from './login-result';
import { CustomerDashboard } from './customer/customer-dashboard/customer-dashboard';
import { SuperadminDashboard } from './superadmin/dashboard/superadmin-dashboard';
import { Products } from './admin/products/products';
import { Inventory } from './admin/inventory/inventory';
import { Users } from './admin/users/users';
import { Financials } from './admin/financials/financials';

export const routes: Routes = [
  { path: '', component: Showroom },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'registration-result', component: RegistrationResult },
  { path: 'login-result', component: LoginResult },
  { path: 'product/:id', component: ProductDetails },
  { path: 'cart', component: Cart },
  { path: 'customer/dashboard', component: CustomerDashboard },
  { path: 'admin', redirectTo: 'admin/dashboard', pathMatch: 'full' },
  { path: 'admin/dashboard', component: Dashboard },
  { path: 'admin/products', component: Products },
  { path: 'admin/inventory', component: Inventory },
  { path: 'admin/users', component: Users },
  { path: 'admin/financials', component: Financials },
  { path: 'superadmin/dashboard', component: SuperadminDashboard },
  { path: '**', redirectTo: '' }
];
