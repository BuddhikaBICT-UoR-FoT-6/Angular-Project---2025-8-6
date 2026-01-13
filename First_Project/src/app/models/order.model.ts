export interface Order {
  _id: string;
  user_id: string | { _id: string; full_name: string; email: string };
  items: OrderItem[];
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  refund_status: 'none' | 'requested' | 'processing' | 'completed' | 'rejected';
  refund_amount: number;
  refund_reason: string;
  shipping_address: ShippingAddress;
  payment_method: 'credit_card' | 'paypal' | 'cash_on_delivery';
  coupon_code?: string;
  discount_amount?: number;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  product_id: string;
  name: string;
  size: string;
  color?: string;
  quantity: number;
  price: number;
}

export interface ShippingAddress {
  fullName?: string;
  phone?: string;
  street?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}
