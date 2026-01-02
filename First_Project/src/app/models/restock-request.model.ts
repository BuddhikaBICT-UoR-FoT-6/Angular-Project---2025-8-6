import { ProductRef, StockBySize } from './inventory.model';

export interface RestockRequest {
  _id: string;
  inventory_id: string;
  product_id?: string | ProductRef;

  requested_by_size: StockBySize;

  supplier_name?: string;
  supplier_email: string;
  note?: string;

  expires_at: string;

  fulfilled_at?: string;
  fulfilled_by?: { userId?: string; role?: string };

  cancelled_at?: string;
  cancelled_by?: { userId?: string; role?: string };
  cancelled_reason?: string;

  created_at?: string;
  updated_at?: string;
}

export interface FulfillRestockResponse {
  success: boolean;
  message: string;
  request?: {
    _id: string;
    inventory_id: string;
    product_id?: string;
    requested_by_size: StockBySize;
    supplier_email: string;
    fulfilled_at: string;
  };
}