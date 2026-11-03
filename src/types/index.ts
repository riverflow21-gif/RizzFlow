// ============================================================================
// DEFINISI TIPE DATA UTAMA RIZZFLOW (TYPESCRIPT STRICT MODE)
// ============================================================================

export type PaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED';

export interface StoreSettings {
  id: number;
  store_name: string;
  banner_description: string;
  support_contact: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  title: string;
  description: string;
  price: number;
  thumbnail_url: string;
  file_path: string;
  badge: string | null;
  is_active: boolean;
  created_at: string;
  categories?: Category | null;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  max_discount_amount: number;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_title: string;
  unit_price: number;
  quantity: number;
}

export interface Order {
  id: string;
  invoice_number: string;
  customer_email: string;
  subtotal_amount: number;
  discount_amount: number;
  final_amount: number;
  promo_code_used: string | null;
  payment_status: PaymentStatus;
  qris_string: string | null;
  qris_expires_at: string;
  paid_at: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

export interface PromoValidationResult {
  valid: boolean;
  message: string;
  discount_amount: number;
  promo_code: string | null;
}

export interface DokuQrisResponse {
  qris_string: string;
  expires_at: string;
}

export interface DokuWebhookPayload {
  order?: {
    invoice_number?: string;
    amount?: number;
  };
  transaction?: {
    status?: string;
    date?: string;
  };
}