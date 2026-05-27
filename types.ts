
export interface Shop {
  id: string;
  name: string;
  type: 'retail' | 'restaurant' | 'service';
  logoUrl?: string;
  address?: string;
  phone?: string;
  ownerId: string;
}

export interface ProductAttribute {
  name: string;
  options: string[];
}

export interface ProductVariant {
  id: string;
  options: string[];
  price: number;
  stock: number;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  trackStock: boolean;
  category: string;
  imageUrl: string;
  barcode?: string;
  attributes?: ProductAttribute[];
  variants?: ProductVariant[];
}

export type OrderItemStatus = 'pending' | 'confirmed' | 'cooking' | 'served' | 'cancelled';

export interface DiscountRule {
  id: string;
  shopId: string;
  name: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  conditions: {
    minQty?: number;
    daysOfWeek?: number[];
    categoryIds?: string[];
    productIds?: string[];
    customerType?: string;
    startTime?: string;
    endTime?: string;
    startDate?: number;
    endDate?: number;
  };
  active: boolean;
}

export type DiscountType = DiscountRule['type'];

export interface CartItem extends Product {
  quantity: number;
  variantId?: string;
  variantName?: string;
  orderItemId?: string;
  status?: OrderItemStatus;
  served?: boolean;
  appliedDiscount?: { name: string; amountSaved: number }; 
  finalPrice?: number;
  rule?: DiscountRule;
  discountAmount?: number;
}

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  phone?: string;
  email?: string;
  totalDebt: number;
  lastInteraction: number;
  orderCount?: number;
}

export interface Sale {
  id: string;
  shopId: string;
  timestamp: number;
  total: number;
  subtotal: number;
  tax: number;
  paymentMethod: string;
  orderStatus: string;
  items: CartItem[];
  currency: string;
  exchangeRate: number;
  customerId?: string;
  tableId?: string;
  paymentProofUrl?: string;
  amountPaid?: number;
}

export interface Table {
  id: string;
  shopId: string;
  name: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  allowOrdering: boolean;
}

export interface Booking {
  id: string;
  shopId: string;
  customerName: string;
  phone: string;
  time: number;
  guests: number;
  tableId?: string;
  notes?: string;
}

export interface Settings {
  taxRate: number;
  currency: string;
  exchangeRate: number;
  enablePublicStore: boolean;
  enableBooking: boolean;
  enableAttributes: boolean;
  enableMultiRoles: boolean;
  defaultLanguage: 'en' | 'km' | 'zh' | 'ja' | 'ko';
}

export type ExpenseCategory = 'restock' | 'salary' | 'rent' | 'utilities' | 'other';

export interface Expense {
  id: string;
  shopId: string;
  amount: number;
  category: ExpenseCategory;
  note?: string;
  date: number;
  created_at?: string;
}

export type StaffRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

export interface Staff {
  id: string;
  shopId: string;
  name: string;
  pin: string;
  role: StaffRole;
  avatarUrl?: string;
}

export interface TableMessage {
  id: string;
  shopId: string;
  tableId: string;
  sender: 'customer' | 'staff';
  message: string;
  type: 'text' | 'alert_call' | 'alert_bill' | 'log';
  createdAt: number;
}

export interface PaymentMethod {
  id: string;
  shopId: string;
  name: string;
  accountName?: string;
  accountNumber?: string;
  qrCodeUrl?: string;
  active: boolean;
}

export interface ProductActivity {
  id: string;
  shopId: string;
  productId: string;
  type: 'create' | 'update' | 'restock' | 'sale' | 'delete' | 'stock_change' | 'sale_cancelled';
  description: string;
  timestamp: number;
  performedBy: string;
}