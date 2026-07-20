import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { supabase, setSupabaseStaffToken } from '../services/supabaseClient';
import { DB_CONSTANTS } from '../services/supabaseSchema';
import { printer } from '../services/printerService';
import { dbWrite, initSync, onQueueChange, getQueueLength } from '../services/syncQueue';
import { 
  Shop, Product, CartItem, Sale, Customer, Staff, Settings, 
  Booking, Table, ProductActivity, DiscountRule, PaymentMethod, 
  OrderItemStatus, Expense
} from '../types';

export type LanguageCode = 'en' | 'km' | 'zh' | 'ja' | 'ko';

// --- Staff session persistence & offline PIN verification helpers ---
// The server mints a session token after verifying the PIN (bcrypt, server-side).
// For OFFLINE staff switching on a shared device we keep a local SHA-256 digest
// of each successfully-used PIN — never the PIN itself — and mint the real
// token once connectivity returns (owner_activate_staff).
const STAFF_SESSION_KEY = 'haang_staff_session_v1';
const PIN_CACHE_KEY = 'haang_pin_cache_v1';

const hashPinLocal = async (pin: string): Promise<string | null> => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
};

const readPinCache = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(PIN_CACHE_KEY) || '{}'); } catch { return {}; }
};

const seedPinCache = async (staffId: string, pin: string) => {
  const digest = await hashPinLocal(pin);
  if (!digest) return;
  const cache = readPinCache();
  cache[staffId] = digest;
  try { localStorage.setItem(PIN_CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
};

const verifyPinOffline = async (staffId: string, pin: string): Promise<boolean> => {
  const digest = await hashPinLocal(pin);
  if (!digest) return false;
  return readPinCache()[staffId] === digest;
};

const isNetworkFailure = (e: any): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String(e?.message || e || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed') || msg.includes('load failed');
};

interface StoreContextType {
  user: any;
  loadingAuth: boolean;
  currentShop: Shop | null;
  settings: Settings;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  
  createShop: (name: string, type: 'retail' | 'restaurant', logoUrl?: string, enableMultiRoles?: boolean) => Promise<void>;
  updateShop: (updates: Partial<Shop>) => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  
  signInWithGoogle: () => Promise<void>;
  signInAsDemoUser: () => Promise<void>;
  signOut: () => Promise<void>;
  
  staffList: Staff[];
  activeStaff: Staff | null;
  loginAsStaff: (phone: string, pin: string) => Promise<boolean>;
  switchStaff: (pin: string, staffId?: string) => Promise<boolean>;
  activateStaffAsOwner: (staffId: string) => Promise<boolean>;
  logoutStaff: () => void;
  addStaff: (staff: Partial<Staff>) => Promise<void>;
  updateStaff: (id: string, updates: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  
  products: Product[];
  categories: string[];
  addProduct: (product: Partial<Product>) => Promise<void>;
  updateProduct: (product: Partial<Product>) => Promise<void>;
  getProductActivities: (productId: string) => ProductActivity[];
  fetchMoreActivities: (productId: string) => Promise<void>;
  hasMoreActivities: (productId: string) => boolean;
  renameCategory: (oldName: string, newName: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  
  cart: CartItem[];
  addToCart: (product: Product, variant?: any) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, change: number, variantId?: string) => void;
  clearCart: () => void;
  checkout: (method: string, customerId?: string) => Sale | null;
  addManualSale: (sale: Sale) => Promise<void>;
  getBestDiscountForItem: (item: CartItem, customerId?: string) => { finalPrice: number, discountAmount: number, rule?: DiscountRule };
  
  sales: Sale[];
  fetchMoreSales: () => Promise<void>;
  hasMoreSales: boolean;
  verifyOrder: (saleId: string) => Promise<void>;
  cancelSale: (saleId: string) => Promise<void>;
  refreshSales: () => Promise<void>;
  exportSalesData: () => Promise<void>;
  
  customers: Customer[];
  addCustomer: (name: string, phone?: string, email?: string) => Promise<string>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  repayDebt: (customerId: string, amount: number) => Promise<void>;
  findOrCreateCustomer: (phone: string, name?: string) => Promise<Customer | null>;
  
  tables: Table[];
  bookings: Booking[];
  addTable: (name: string, capacity: number) => Promise<void>;
  updateTable: (id: string, updates: Partial<Table>) => Promise<void>;
  addBooking: (booking: any) => Promise<void>;
  startTableSession: (tableId: string) => Promise<void>;
  finishTableOrder: (saleId: string, tableId: string, paymentMethod?: string) => Promise<void>;
  confirmOrderItems: (saleId: string) => Promise<void>;
  updateOrderItemStatus: (saleId: string, itemId: string, status: OrderItemStatus) => Promise<void>;
  removeItemFromOrder: (saleId: string, itemId: string) => Promise<void>;
  
  addExpense: (expense: Partial<Expense>) => Promise<void>;
  getDashboardMetrics: (start: number, end: number) => Promise<any>;
  
  discountRules: DiscountRule[];
  addDiscountRule: (rule: Partial<DiscountRule>) => Promise<void>;
  deleteDiscountRule: (id: string) => Promise<void>;
  
  paymentMethods: PaymentMethod[];
  addPaymentMethod: (pm: Partial<PaymentMethod>) => Promise<void>;
  updatePaymentMethod: (id: string, updates: Partial<PaymentMethod>) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  
  printerConnected: boolean;
  connectPrinter: () => Promise<boolean>;
  printReceipt: (sale: Sale) => Promise<void>;

  pendingWrites: number;

  formatPrice: (amount: number) => string;
}

const TRANSLATIONS: any = {
  en: {
    'nav.pos': 'POS', 'nav.inventory': 'Inventory', 'nav.tables': 'Tables', 'nav.orders': 'Orders',
    'nav.customers': 'Customers', 'nav.dashboard': 'Dashboard', 'nav.settings': 'Settings', 'nav.kitchen': 'Kitchen', 'nav.bookings': 'Bookings', 'nav.current_shop': 'Current Shop',
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.add': 'Add', 'common.view': 'View', 'common.upload': 'Upload', 'common.camera': 'Camera', 'common.ai_gen': 'Generate AI', 'common.basic_info': 'Basic Info', 'common.confirm': 'Confirm', 'common.close': 'Close', 'common.switch_lang': 'Switch Language',
    'pos.search': 'Search products...', 'pos.total': 'Total', 'pos.pay': 'Pay', 'pos.empty_cart': 'Cart is empty', 'pos.view_cart': 'View Cart', 'pos.cancel_order': 'Cancel Order', 'pos.confirm_cancel': 'Are you sure you want to cancel?', 'pos.cancel': 'Cancel Transaction', 'pos.you_saved': 'You saved', 'pos.subtotal': 'Subtotal', 'pos.tax': 'Tax', 'pos.start_new': 'Start New Order', 'pos.select_variant': 'Select Variant', 'pos.dity_card': 'DiTy Card', 'pos.dity_card_desc': 'Gift / Member Card', 'pos.scan_camera': 'Scan Barcode',
    'inv.out_of_stock': 'Out of Stock', 'inv.low_stock': 'Low Stock', 'inv.stock': 'Stock', 'inv.in_stock': 'In Stock', 'inv.add_product': 'Add Product', 'inv.total_products': 'Total Products', 'inv.public_link': 'Public Menu Link', 'inv.manage_cats': 'Manage Categories', 'inv.edit': 'Edit Product', 'inv.barcode': 'Barcode', 'inv.product_name': 'Product Name', 'inv.category': 'Category', 'inv.description': 'Description', 'inv.auto_write': 'Auto Write', 'inv.price': 'Price', 'inv.track_stock': 'Track Stock', 'inv.attributes': 'Attributes', 'inv.add_attribute': 'Add Attribute', 'inv.gen_variants': 'Generate Variants',
    'status.all': 'All', 'status.pending': 'Pending', 'status.completed': 'Completed', 'status.cancelled': 'Cancelled', 'status.verifying': 'Verifying', 'status.debt': 'Debt',
    'setup.welcome': 'Welcome to Little Tony APP', 'setup.subtitle': 'The Smartest POS for Cambodia', 'setup.create': 'Create Your Shop', 'setup.name': 'Shop Name', 'setup.type': 'Business Type', 'setup.retail': 'Retail', 'setup.restaurant': 'Restaurant', 'setup.logo': 'Logo', 'setup.gen_ai': 'Generate w/ AI', 'setup.multi_staff': 'Multi-Staff / Roles', 'setup.multi_staff_desc': 'Enable Admin, Waiter, Kitchen roles', 'setup.start': 'Start Business',
    'lock.authorized': 'Authorized Access', 'lock.who_login': 'Who is logging in?', 'lock.logout': 'Logout', 'lock.create_admin': 'Create Admin (PIN: 123456)', 'lock.no_staff': 'No staff accounts found.', 'lock.change': 'Change', 'lock.exit_demo': 'Exit Demo', 'lock.lock_screen': 'Lock Screen', 'lock.setup_badge': 'Passcode Required', 'lock.upgrade_badge': 'Security Upgrade',
    'login.subtitle': 'Smart POS for Cambodian SMEs', 'login.owner': 'Shop Owner', 'login.staff': 'Staff Login', 'login.google': 'Sign in with Google', 'login.demo': 'Try Demo Mode', 'login.phone': 'Shop Phone Number', 'login.pin': 'PIN Code', 'login.login_btn': 'Login',
    'dash.sales_summary': 'Sales Summary', 'dash.this_month': 'This Month', 'dash.this_year': 'This Year', 'dash.custom': 'Custom', 'dash.add_expense': 'Add Expense', 'dash.start_date': 'Start Date', 'dash.end_date': 'End Date', 'dash.income': 'Total Income', 'dash.expense': 'Total Expense', 'dash.profit': 'Net Profit', 'dash.total_vat': 'Total VAT', 'dash.total_discount': 'Discount Given', 'dash.credit': 'Customer Credit', 'dash.inventory_alert': 'Inventory Alert', 'dash.top_selling': 'Top Selling Products', 'dash.ai_insight': 'AI Business Insight', 'dash.ask_ai': 'Ask AI Assistant',
    'set.general': 'General', 'set.staff': 'Staff', 'set.discounts': 'Discounts', 'set.payments': 'Payments', 'set.hardware': 'Hardware', 'set.profile': 'Shop Profile', 'set.shop_name': 'Shop Name', 'set.address': 'Address', 'set.phone': 'Phone', 'set.features': 'Features', 'set.public_store': 'Public Store / QR Menu', 'set.booking': 'Table Booking', 'set.variants': 'Product Variants', 'set.variants_desc': 'Sizes, Colors, Options', 'set.multi_role_title': 'Multi-Role Staff', 'set.multi_role_desc': 'Admin, Waiter, Kitchen roles', 'set.vat': 'VAT / Tax', 'set.vat_rate': 'Tax Rate (%)', 'set.save': 'Save Settings', 'set.add_staff': 'Add Staff', 'set.edit_staff': 'Edit Staff', 'set.role_name': 'Name', 'set.role_pin': 'PIN (6 digits)', 'set.role_select': 'Role', 'set.role_cashier': 'Cashier', 'set.role_waiter': 'Waiter', 'set.role_manager': 'Manager', 'set.role_admin': 'Admin (Full Access)', 'set.role_kitchen': 'Kitchen', 'set.how_auth_works': 'How Staff Login Works', 'set.auth_step1': '1. Use Shop Phone Number', 'set.auth_step2': '2. Enter Staff PIN', 'set.auth_step3': '3. Access limited by Role', 'set.auth_step4': 'Admin PIN can unlock all features.', 'set.active_discounts': 'Active Discounts', 'set.add_rule': 'Add Rule', 'set.no_discounts': 'No active discount rules.', 'set.rule_name_ph': 'Rule Name (e.g. Happy Hour)', 'set.rule_type': 'Type', 'set.percent': 'Percentage (%)', 'set.fixed_amount': 'Fixed Amount', 'set.rule_value': 'Value', 'set.payment_methods': 'Payment Methods', 'set.add_payment': 'Add Method', 'set.bank_name': 'Bank / Provider Name', 'set.acc_name': 'Account Name', 'set.acc_number': 'Account Number', 'set.upload_qr': 'Upload QR Image', 'set.printer_setup': 'Printer Setup', 'set.printer_connected': 'Printer Connected', 'set.not_connected': 'Not Connected', 'set.printer_instruction': 'Supports 58mm/80mm Bluetooth Thermal Printers (ESC/POS).', 'set.printer_ready': 'Printer Ready', 'set.connect_printer': 'Connect Printer',
    'ord.export': 'Export CSV', 'ord.add': 'Add Order', 'ord.manual': 'Manual', 'ord.scan': 'Scan Receipt', 'ord.scan_desc': 'Take a photo of a paper order/receipt to import items automatically using AI.', 'ord.save': 'Save Order', 'ord.cancel_btn': 'Void Transaction', 'ord.print_thermal': 'Print Receipt', 'ord.cancel_title': 'Void Transaction', 'ord.cancel_msg': 'Are you sure you want to void this completed transaction? Inventory will be restored.',
    'cust.new': 'New Customer', 'cust.pay_debt': 'Pay Debt', 'cust.total_debt': 'Total Debt', 'cust.history': 'History', 'cust.payment_received': 'Payment Received', 'cust.credit_purchase': 'Credit Purchase',
    'bk.layout': 'Layout', 'bk.schedule': 'Schedule', 'bk.new_table': 'New Table', 'bk.table_name': 'Table Name', 'bk.capacity': 'Capacity', 'bk.book_btn': 'New Booking', 'bk.cust_name': 'Customer Name', 'bk.guests': 'Guests', 'bk.notes': 'Notes', 'bk.ai_assist': 'AI Assistant', 'bk.ask_ai_ph': 'Ask about availability...', 'bk.new_booking': 'New Booking',
    'toast.prod_limit': 'Product limit reached (200).', 'toast.fill_prod_name': 'Please enter product name.', 'toast.logo_gen': 'Image generated successfully!', 'alert.gen_fail_title': 'Generation Failed', 'alert.gen_fail_msg': 'Could not generate image. Please try again.', 'toast.link_copied': 'Link copied to clipboard', 'toast.cat_renamed': 'Category renamed', 'toast.cant_del_def_cat': 'Cannot delete default category', 'alert.del_cat_title': 'Delete Category', 'alert.del_cat_msg': 'Are you sure? Products in this category will move to General.', 'toast.cat_deleted': 'Category deleted', 'toast.valid_amount': 'Please enter a valid amount', 'toast.exp_added': 'Expense added', 'toast.settings_saved': 'Settings saved successfully', 'toast.enter_shop_name': 'Please enter shop name', 'toast.fill_name_pin': 'Please fill name and PIN', 'toast.pin_len': 'PIN must be 6 digits', 'toast.staff_updated': 'Staff updated', 'toast.staff_added': 'Staff added', 'confirm.del_staff_title': 'Delete Staff', 'confirm.del_staff_msg': 'Are you sure you want to remove this staff member?', 'toast.staff_deleted': 'Staff removed', 'toast.rule_added': 'Discount rule added', 'confirm.del_rule_title': 'Delete Rule', 'confirm.del_rule_msg': 'Are you sure?', 'toast.max_item_limit': 'Max items limit reached', 'toast.order_saved': 'Order saved successfully', 'toast.sale_cancelled': 'Transaction voided', 'alert.imp_limit_title': 'Import Limit', 'alert.imp_limit_msg': 'Too many items detected. Truncated to 50.', 'alert.scan_fail_title': 'Scan Failed', 'alert.scan_fail_msg': 'Could not read items from image. Try clearer photo.', 'alert.invalid_amt_title': 'Invalid Amount', 'alert.invalid_amt_msg': 'Total amount cannot be zero.', 'toast.export_success': 'Exported successfully',
    'var.details': 'Details', 'var.activity': 'Activity', 'var.available': 'Available', 'var.attr_name': 'Attribute (e.g. Size)', 'var.attr_opts': 'Options (e.g. S, M, L)', 'var.variant': 'Variant', 'var.regenerate': 'Regenerate Variants',
    'exp.restock': 'Restock', 'exp.salary': 'Salary', 'exp.rent': 'Rent', 'exp.utilities': 'Utilities', 'exp.other': 'Other'
  },
  km: {
    'nav.pos': 'លក់', 'nav.inventory': 'ឃ្លាំង', 'nav.tables': 'តុ', 'nav.orders': 'ការកម្ម៉ង់',
    'nav.customers': 'អតិថិជន', 'nav.dashboard': 'របាយការណ៍', 'nav.settings': 'ការកំណត់', 'nav.kitchen': 'ផ្ទះបាយ', 'nav.bookings': 'កក់តុ', 'nav.current_shop': 'ហាងបច្ចុប្បន្ន',
    'common.save': 'រក្សាទុក', 'common.cancel': 'បោះបង់', 'common.add': 'បន្ថែម', 'common.view': 'មើល', 'common.upload': 'បញ្ចូលរូប', 'common.camera': 'ថតរូប', 'common.ai_gen': 'បង្កើតដោយ AI', 'common.basic_info': 'ព័ត៌មានទូទៅ', 'common.confirm': 'យល់ព្រម', 'common.close': 'បិទ', 'common.switch_lang': 'ប្តូរភាសា',
    'pos.search': 'ស្វែងរកទំនិញ...', 'pos.total': 'សរុប', 'pos.pay': 'គិតលុយ', 'pos.empty_cart': 'កន្ត្រកទំនិញទទេ', 'pos.view_cart': 'មើលកន្ត្រក', 'pos.cancel_order': 'លុបការកម្ម៉ង់', 'pos.confirm_cancel': 'តើអ្នកច្បាស់ទេ?', 'pos.cancel': 'បោះបង់', 'pos.you_saved': 'ចំណេញ', 'pos.subtotal': 'សរុបបឋម', 'pos.tax': 'ពន្ធ', 'pos.start_new': 'ការលក់ថ្មី', 'pos.select_variant': 'ជ្រើសរើសជម្រើស', 'pos.dity_card': 'ប័ណ្ណ DiTy', 'pos.dity_card_desc': 'ប័ណ្ណសមាជិក / កាដូ', 'pos.scan_camera': 'ស្កេនបាកូដ',
    'inv.out_of_stock': 'អស់ស្តុក', 'inv.low_stock': 'ជិតអស់', 'inv.stock': 'ស្តុក', 'inv.in_stock': 'មានស្តុក', 'inv.add_product': 'ទំនិញថ្មី', 'inv.total_products': 'ទំនិញសរុប', 'inv.public_link': 'តំណភ្ជាប់ហាង', 'inv.manage_cats': 'គ្រប់គ្រងប្រភេទ', 'inv.edit': 'កែប្រែ', 'inv.barcode': 'បាកូដ', 'inv.product_name': 'ឈ្មោះទំនិញ', 'inv.category': 'ប្រភេទ', 'inv.description': 'បរិយាយ', 'inv.auto_write': 'សរសេរដោយ AI', 'inv.price': 'តម្លៃ', 'inv.track_stock': 'តាមដានស្តុក', 'inv.attributes': 'លក្ខណៈសម្បត្តិ', 'inv.add_attribute': 'បន្ថែម', 'inv.gen_variants': 'បង្កើតជម្រើស',
    'status.all': 'ទាំងអស់', 'status.pending': 'រង់ចាំ', 'status.completed': 'ជោគជ័យ', 'status.cancelled': 'បោះបង់', 'status.verifying': 'ត្រួតពិនិត្យ', 'status.debt': 'ជំពាក់',
    'setup.welcome': 'សូមស្វាគមន៍មកកាន់ Little Tony APP', 'setup.subtitle': 'ប្រព័ន្ធគ្រប់គ្រងហាងឆ្លាតវៃ', 'setup.create': 'បង្កើតហាងរបស់អ្នក', 'setup.name': 'ឈ្មោះហាង', 'setup.type': 'ប្រភេទអាជីវកម្ម', 'setup.retail': 'លក់រាយ', 'setup.restaurant': 'ភោជនីយដ្ឋាន', 'setup.logo': 'ឡូហ្គោ', 'setup.gen_ai': 'បង្កើតដោយ AI', 'setup.multi_staff': 'បុគ្គលិកច្រើន / តួនាទី', 'setup.multi_staff_desc': 'បើកមុខងារ Admin, អ្នករត់តុ, ផ្ទះបាយ', 'setup.start': 'ចាប់ផ្តើម',
    'lock.authorized': 'ការចូលប្រើប្រាស់', 'lock.who_login': 'តើនរណាកំពុងចូលប្រើ?', 'lock.logout': 'ចាកចេញ', 'lock.create_admin': 'បង្កើត Admin (PIN: 123456)', 'lock.no_staff': 'មិនមានគណនីបុគ្គលិកទេ។', 'lock.change': 'ប្តូរ', 'lock.exit_demo': 'ចាកចេញពី Demo', 'lock.lock_screen': 'ចាក់សោ', 'lock.setup_badge': 'តម្រូវឲ្យដំឡើងលេខកូដ', 'lock.upgrade_badge': 'តម្លើងប្រព័ន្ធសុវត្ថិភាព',
    'login.subtitle': 'កម្មវិធី POS ឆ្លាតវៃសម្រាប់ហាង និងភោជនីយដ្ឋាន', 'login.owner': 'ម្ចាស់ហាង', 'login.staff': 'បុគ្គលិក', 'login.google': 'ចូលប្រើជាមួយ Google', 'login.demo': 'សាកល្បងប្រើ (Demo)', 'login.phone': 'លេខទូរស័ព្ទហាង', 'login.pin': 'លេខកូដ PIN', 'login.login_btn': 'ចូលប្រើ',
    'dash.sales_summary': 'សង្ខេបការលក់', 'dash.this_month': 'ខែនេះ', 'dash.this_year': 'ឆ្នាំនេះ', 'dash.custom': 'កំណត់', 'dash.add_expense': 'កត់ចំណាយ', 'dash.start_date': 'ថ្ងៃចាប់ផ្តើម', 'dash.end_date': 'ថ្ងៃបញ្ចប់', 'dash.income': 'ចំណូលសរុប', 'dash.expense': 'ចំណាយសរុប', 'dash.profit': 'ប្រាក់ចំណេញ', 'dash.total_vat': 'ពន្ធសរុប', 'dash.total_discount': 'បានបញ្ចុះតម្លៃ', 'dash.credit': 'បំណុលអតិថិជន', 'dash.inventory_alert': 'ជូនដំណឹងស្តុក', 'dash.top_selling': 'ទំនិញលក់ដាច់', 'dash.ai_insight': 'ការវិភាគដោយ AI', 'dash.ask_ai': 'សួរ AI',
    'set.general': 'ទូទៅ', 'set.staff': 'បុគ្គលិក', 'set.discounts': 'បញ្ចុះតម្លៃ', 'set.payments': 'ការទូទាត់', 'set.hardware': 'ម៉ាស៊ីន', 'set.profile': 'ព័ត៌មានហាង', 'set.shop_name': 'ឈ្មោះហាង', 'set.address': 'អាសយដ្ឋាន', 'set.phone': 'លេខទូរស័ព្ទ', 'set.features': 'មុខងារ', 'set.public_store': 'QR ម៉ឺនុយ / អនឡាញ', 'set.booking': 'ការកក់តុ', 'set.variants': 'ជម្រើសទំនិញ (Variants)', 'set.variants_desc': 'ទំហំ, ពណ៌, ជម្រើសផ្សេងៗ', 'set.multi_role_title': 'តួនាទីបុគ្គលិក', 'set.multi_role_desc': 'Admin, អ្នករត់តុ, ផ្ទះបាយ', 'set.vat': 'ពន្ធ (VAT)', 'set.vat_rate': 'អត្រាពន្ធ (%)', 'set.save': 'រក្សាទុក', 'set.add_staff': 'បន្ថែមបុគ្គលិក', 'set.edit_staff': 'កកែប្រែបុគ្គលិក', 'set.role_name': 'ឈ្មោះ', 'set.role_pin': 'លេខកូដ PIN (6 ខ្ទង់)', 'set.role_select': 'តួនាទី', 'set.role_cashier': 'អ្នកគិតលុយ', 'set.role_waiter': 'អ្នករត់តុ', 'set.role_manager': 'អ្នកគ្រប់គ្រង', 'set.role_admin': 'Admin (សិទ្ធិពេញ)', 'set.role_kitchen': 'ចុងភៅ', 'set.how_auth_works': 'របៀបចូលប្រើសម្រាប់បុគ្គលិក', 'set.auth_step1': '១. ប្រើលេខទូរស័ព្ទហាង', 'set.auth_step2': '២. វាយលេខកូដ PIN', 'set.auth_step3': '៣. ប្រើប្រាស់តាមតួនាទី', 'set.auth_step4': 'Admin PIN អាចប្រើគ្រប់មុខងារ។', 'set.active_discounts': 'ការបញ្ចុះតម្លៃដែលមាន', 'set.add_rule': 'បង្កើតថ្មី', 'set.no_discounts': 'មិនទាន់មាន។', 'set.rule_name_ph': 'ឈ្មោះ (ឧ. Happy Hour)', 'set.rule_type': 'ប្រភេទ', 'set.percent': 'ភាគរយ (%)', 'set.fixed_amount': 'ទឹកប្រាក់ថេរ', 'set.rule_value': 'តម្លៃ', 'set.payment_methods': 'វិធីទូទាត់', 'set.add_payment': 'បន្ថែម', 'set.bank_name': 'ឈ្មោះធនាគារ', 'set.acc_name': 'ឈ្មោះគណនី', 'set.acc_number': 'លេខគណនី', 'set.upload_qr': 'បញ្ចូលរូប QR', 'set.printer_setup': 'ម៉ាស៊ីនព្រីន', 'set.printer_connected': 'បានភ្ជាប់', 'set.not_connected': 'មិនទាន់ភ្ជាប់', 'set.printer_instruction': 'អាចប្រើជាមួយ Bluetooth Thermal Printer (58mm/80mm)។', 'set.printer_ready': 'ព្រីនបាន', 'set.connect_printer': 'ភ្ជាប់ម៉ាស៊ីនព្រីន',
    'ord.export': 'Export CSV', 'ord.add': 'ថែមការលក់', 'ord.manual': 'វាយបញ្ចូល', 'ord.scan': 'ស្កេនវិក្កយបត្រ', 'ord.scan_desc': 'ថតរូបវិក្កយបត្រក្រដាសដើម្បីបញ្ចូលក្នុងប្រព័ន្ធដោយស្វ័យប្រវត្តិ។', 'ord.save': 'រក្សាទុក', 'ord.cancel_btn': 'បោះបង់ប្រតិបត្តិការ (Void)', 'ord.print_thermal': 'បោះពុម្ព', 'ord.cancel_title': 'លុបចោលប្រតិបត្តិការ', 'ord.cancel_msg': 'តើអ្នកច្បាស់ទេថាចង់លុបចោល? ស្តុកនឹងត្រូវបានបង្វិលសង។',
    'cust.new': 'អតិថិជនថ្មី', 'cust.pay_debt': 'សងបំណុល', 'cust.total_debt': 'បំណុលសរុប', 'cust.history': 'ប្រវត្តិ', 'cust.payment_received': 'បានទទួលប្រាក់', 'cust.credit_purchase': 'ទិញជំពាក់',
    'bk.layout': 'ប្លង់តុ', 'bk.schedule': 'កាលវិភាគ', 'bk.new_table': 'តុថ្មី', 'bk.table_name': 'ឈ្មោះតុ', 'bk.capacity': 'ចំនួនកៅអី', 'bk.book_btn': 'កក់ថ្មី', 'bk.cust_name': 'ឈ្មោះភ្ញៀវ', 'bk.guests': 'ចំនួនភ្ញៀវ', 'bk.notes': 'កំណត់សម្គាល់', 'bk.ai_assist': 'ជំនួយការ AI', 'bk.ask_ai_ph': 'សួរអំពីកន្លែងទំនេរ...', 'bk.new_booking': 'ការកក់ថ្មី',
    'toast.prod_limit': 'Product limit reached (200).', 'toast.fill_prod_name': 'Please enter product name.', 'toast.logo_gen': 'Image generated successfully!', 'alert.gen_fail_title': 'Generation Failed', 'alert.gen_fail_msg': 'Could not generate image. Please try again.', 'toast.link_copied': 'Link copied to clipboard', 'toast.cat_renamed': 'Category renamed', 'toast.cant_del_def_cat': 'Cannot delete default category', 'alert.del_cat_title': 'Delete Category', 'alert.del_cat_msg': 'Are you sure? Products in this category will move to General.', 'toast.cat_deleted': 'Category deleted', 'toast.valid_amount': 'Please enter a valid amount', 'toast.exp_added': 'Expense added', 'toast.settings_saved': 'Settings saved successfully', 'toast.enter_shop_name': 'Please enter shop name', 'toast.fill_name_pin': 'Please fill name and PIN', 'toast.pin_len': 'លេខកូដ PIN ត្រូវតែមាន ៦ ខ្ទង់', 'toast.staff_updated': 'Staff updated', 'toast.staff_added': 'Staff added', 'confirm.del_staff_title': 'Delete Staff', 'confirm.del_staff_msg': 'Are you sure you want to remove this staff member?', 'toast.staff_deleted': 'Staff removed', 'toast.rule_added': 'Discount rule added', 'confirm.del_rule_title': 'Delete Rule', 'confirm.del_rule_msg': 'Are you sure?', 'toast.max_item_limit': 'Max items limit reached', 'toast.order_saved': 'Order saved successfully', 'toast.sale_cancelled': 'Transaction voided', 'alert.imp_limit_title': 'Import Limit', 'alert.imp_limit_msg': 'Too many items detected. Truncated to 50.', 'alert.scan_fail_title': 'Scan Failed', 'alert.scan_fail_msg': 'Could not read items from image. Try clearer photo.', 'alert.invalid_amt_title': 'Invalid Amount', 'alert.invalid_amt_msg': 'Total amount cannot be zero.', 'toast.export_success': 'Exported successfully',
    'var.details': 'Details', 'var.activity': 'Activity', 'var.available': 'Available', 'var.attr_name': 'Attribute (e.g. Size)', 'var.attr_opts': 'Options (e.g. S, M, L)', 'var.variant': 'Variant', 'var.regenerate': 'Regenerate Variants',
    'exp.restock': 'Restock', 'exp.salary': 'Salary', 'exp.rent': 'Rent', 'exp.utilities': 'Utilities', 'exp.other': 'Other'
  },
  zh: {
    'nav.pos': '销售', 'nav.inventory': '库存', 'nav.tables': '桌台', 'nav.orders': '订单',
    'nav.customers': '客户', 'nav.dashboard': '仪表盘', 'nav.settings': '设置', 'nav.kitchen': '厨房', 'nav.bookings': '预订', 'nav.current_shop': '当前店铺',
    'common.save': '保存', 'common.cancel': '取消', 'common.add': '添加', 'common.view': '查看', 'common.upload': '上传', 'common.camera': '相机', 'common.ai_gen': 'AI生成', 'common.basic_info': '基本信息', 'common.confirm': '确认', 'common.close': '关闭', 'common.switch_lang': '切换语言',
    'pos.search': '搜索产品...', 'pos.total': '总计', 'pos.pay': '支付', 'pos.empty_cart': '购物车为空', 'pos.view_cart': '查看购物车', 'pos.cancel_order': '取消订单', 'pos.confirm_cancel': '确定要取消吗?', 'pos.cancel': '取消交易', 'pos.you_saved': '已节省', 'pos.subtotal': '小计', 'pos.tax': '税', 'pos.start_new': '开始新订单', 'pos.select_variant': '选择规格', 'pos.dity_card': 'DiTy卡', 'pos.dity_card_desc': '礼品/会员卡', 'pos.scan_camera': '扫描条码',
    'inv.out_of_stock': '缺货', 'inv.low_stock': '库存不足', 'inv.stock': '库存', 'inv.in_stock': '有货', 'inv.add_product': '添加产品', 'inv.total_products': '产品总数', 'inv.public_link': '公共菜单链接', 'inv.manage_cats': '管理分类', 'inv.edit': '编辑产品', 'inv.barcode': '条码', 'inv.product_name': '产品名称', 'inv.category': '分类', 'inv.description': '描述', 'inv.auto_write': '自动撰写', 'inv.price': '价格', 'inv.track_stock': '追踪库存', 'inv.attributes': '属性', 'inv.add_attribute': '添加属性', 'inv.gen_variants': '生成规格',
    'status.all': '全部', 'status.pending': '待处理', 'status.completed': '已完成', 'status.cancelled': '已取消', 'status.verifying': '验证中', 'status.debt': '欠款',
    'setup.welcome': '欢迎使用 Little Tony APP', 'setup.subtitle': '柬埔寨最智能的 POS', 'setup.create': '创建您的店铺', 'setup.name': '店铺名称', 'setup.type': '业务类型', 'setup.retail': '零售', 'setup.restaurant': '餐厅', 'setup.logo': 'Logo', 'setup.gen_ai': 'AI生成', 'setup.multi_staff': '多员工/角色', 'setup.multi_staff_desc': '启用管理员、服务员、厨房角色', 'setup.start': '开始营业',
    'lock.authorized': '授权访问', 'lock.who_login': '谁在登录?', 'lock.logout': '退出', 'lock.create_admin': '创建管理员 (PIN: 123456)', 'lock.no_staff': '未找到员工账号。', 'lock.change': '更改', 'lock.exit_demo': '退出演示', 'lock.lock_screen': '锁定屏幕', 'lock.setup_badge': '需要设置密码', 'lock.upgrade_badge': '安全升级',
    'login.subtitle': '柬埔寨中小企业的智能 POS', 'login.owner': '店主', 'login.staff': '员工登录', 'login.google': 'Google 登录', 'login.demo': '试用演示模式', 'login.phone': '店铺电话号码', 'login.pin': 'PIN 码', 'login.login_btn': '登录',
    'dash.sales_summary': '销售摘要', 'dash.this_month': '本月', 'dash.this_year': '今年', 'dash.custom': '自定义', 'dash.add_expense': '添加支出', 'dash.start_date': '开始日期', 'dash.end_date': '结束日期', 'dash.income': '总收入', 'dash.expense': '总支出', 'dash.profit': '净利润', 'dash.total_vat': '总增值税', 'dash.total_discount': '给予折扣', 'dash.credit': '客户信用', 'dash.inventory_alert': '库存预警', 'dash.top_selling': '热销产品', 'dash.ai_insight': 'AI 商业洞察', 'dash.ask_ai': '询问 AI 助手',
    'set.general': '常规', 'set.staff': '员工', 'set.discounts': '折扣', 'set.payments': '支付', 'set.hardware': '硬件', 'set.profile': '店铺资料', 'set.shop_name': '店铺名称', 'set.address': '地址', 'set.phone': '电话', 'set.features': '功能', 'set.public_store': '公共商店/二维码菜单', 'set.booking': '桌台预订', 'set.variants': '产品规格', 'set.variants_desc': '尺寸、颜色、选项', 'set.multi_role_title': '多角色员工', 'set.multi_role_desc': '管理员、服务员、厨房角色', 'set.vat': '增值税/税', 'set.vat_rate': '税率 (%)', 'set.save': '保存设置', 'set.add_staff': '添加员工', 'set.edit_staff': '编辑员工', 'set.role_name': '姓名', 'set.role_pin': 'PIN (6位)', 'set.role_select': '角色', 'set.role_cashier': '收银员', 'set.role_waiter': '服务员', 'set.role_manager': '经理', 'set.role_admin': '管理员 (完全访问)', 'set.role_kitchen': '厨房', 'set.how_auth_works': '员工登录方式', 'set.auth_step1': '1. 使用店铺电话', 'set.auth_step2': '2. 输入员工 PIN', 'set.auth_step3': '3. 根据角色限制访问', 'set.auth_step4': '管理员 PIN 可解锁所有功能。', 'set.active_discounts': '有效折扣', 'set.add_rule': '添加规则', 'set.no_discounts': '无有效折扣规则。', 'set.rule_name_ph': '规则名称 (如: 欢乐时光)', 'set.rule_type': '类型', 'set.percent': '百分比 (%)', 'set.fixed_amount': '固定金额', 'set.rule_value': '规则值', 'set.payment_methods': '支付方式', 'set.add_payment': '添加方式', 'set.bank_name': '银行/提供商名称', 'set.acc_name': '账户名称', 'set.acc_number': '账号', 'set.upload_qr': '上传二维码图片', 'set.printer_setup': '打印机设置', 'set.printer_connected': '打印机已连接', 'set.not_connected': '未连接', 'set.printer_instruction': '支持 58mm/80mm 蓝牙热敏打印机 (ESC/POS)。', 'set.printer_ready': '打印机就绪', 'set.connect_printer': '连接打印机',
    'ord.export': '导出 CSV', 'ord.add': '添加订单', 'ord.manual': '手动', 'ord.scan': '扫描收据', 'ord.scan_desc': '拍摄纸质订单/收据照片以使用 AI 自动导入项目。', 'ord.save': '保存订单', 'ord.cancel_btn': '作废交易', 'ord.print_thermal': '打印收据', 'ord.cancel_title': '作废交易', 'ord.cancel_msg': '确定要作废此已完成的交易吗？库存将恢复。',
    'cust.new': '新客户', 'cust.pay_debt': '还债', 'cust.total_debt': '总债务', 'cust.history': '历史记录', 'cust.payment_received': '已收款', 'cust.credit_purchase': '赊购',
    'bk.layout': '布局', 'bk.schedule': '日程表', 'bk.new_table': '新桌台', 'bk.table_name': '桌台名称', 'bk.capacity': '容量', 'bk.book_btn': '新预订', 'bk.cust_name': '客户姓名', 'bk.guests': '人数', 'bk.notes': '备注', 'bk.ai_assist': 'AI 助手', 'bk.ask_ai_ph': '询问空闲情况...', 'bk.new_booking': '新预订',
    'toast.prod_limit': '产品限制已达到 (200)。', 'toast.fill_prod_name': '请输入产品名称。', 'toast.logo_gen': '图片生成成功！', 'alert.gen_fail_title': '生成失败', 'alert.gen_fail_msg': '无法生成图片。请重试。', 'toast.link_copied': '链接已复制到剪贴板', 'toast.cat_renamed': '分类已重命名', 'toast.cant_del_def_cat': '无法删除默认分类', 'alert.del_cat_title': '删除分类', 'alert.del_cat_msg': '确定吗？此分类中的产品将移动到通用。', 'toast.cat_deleted': '分类已删除', 'toast.valid_amount': '请输入有效金额', 'toast.exp_added': '支出已添加', 'toast.settings_saved': '设置保存成功', 'toast.enter_shop_name': '请输入店铺名称', 'toast.fill_name_pin': '请填写姓名和 PIN', 'toast.pin_len': 'PIN 必须是 6 位数字', 'toast.staff_updated': '员工已更新', 'toast.staff_added': '员工已添加', 'confirm.del_staff_title': '删除员工', 'confirm.del_staff_msg': '确定要删除此员工吗？', 'toast.staff_deleted': '员工已移除', 'toast.rule_added': '折扣规则已添加', 'confirm.del_rule_title': '删除规则', 'confirm.del_rule_msg': '确定吗？', 'toast.max_item_limit': '已达到最大项目限制', 'toast.order_saved': '订单保存成功', 'toast.sale_cancelled': '交易已作废', 'alert.imp_limit_title': '导入限制', 'alert.imp_limit_msg': '检测到的项目过多。已截断至 50 个。', 'alert.scan_fail_title': '扫描失败', 'alert.scan_fail_msg': '无法从图片中读取项目。请尝试更清晰的照片。', 'alert.invalid_amt_title': '无效金额', 'alert.invalid_amt_msg': '总金额不能为零。', 'toast.export_success': '导出成功',
    'var.details': '详情', 'var.activity': '活动', 'var.available': '可用', 'var.attr_name': '属性名称 (如: 尺寸)', 'var.attr_opts': '选项 (如: S, M, L)', 'var.variant': '规格', 'var.regenerate': '重新生成规格',
    'exp.restock': '补货', 'exp.salary': '工资', 'exp.rent': '租金', 'exp.utilities': '水电费', 'exp.other': '其他'
  },
  ja: {
    'nav.pos': 'POS', 'nav.inventory': '在庫', 'nav.tables': 'テーブル', 'nav.orders': '注文',
    'nav.customers': '顧客', 'nav.dashboard': 'ダッシュボード', 'nav.settings': '設定', 'nav.kitchen': 'キッチン', 'nav.bookings': '予約', 'nav.current_shop': '現在の店舗',
    'common.save': '保存', 'common.cancel': 'キャンセル', 'common.add': '追加', 'common.view': '表示', 'common.upload': 'アップロード', 'common.camera': 'カメラ', 'common.ai_gen': 'AI生成', 'common.basic_info': '基本情報', 'common.confirm': '確認', 'common.close': '閉じる', 'common.switch_lang': '言語切替',
    'pos.search': '商品を検索...', 'pos.total': '合計', 'pos.pay': '支払', 'pos.empty_cart': 'カートは空です', 'pos.view_cart': 'カートを見る', 'pos.cancel_order': '注文キャンセル', 'pos.confirm_cancel': 'キャンセルしますか？', 'pos.cancel': '取引中止', 'pos.you_saved': '節約額', 'pos.subtotal': '小計', 'pos.tax': '税', 'pos.start_new': '新規注文', 'pos.select_variant': 'バリエーション選択', 'pos.dity_card': 'DiTyカード', 'pos.dity_card_desc': 'ギフト/会員カード', 'pos.scan_camera': 'バーコードスキャン',
    'inv.out_of_stock': '在庫切れ', 'inv.low_stock': '残りわずか', 'inv.stock': '在庫', 'inv.in_stock': '在庫あり', 'inv.add_product': '商品追加', 'inv.total_products': '商品総数', 'inv.public_link': '公開メニューリンク', 'inv.manage_cats': 'カテゴリ管理', 'inv.edit': '編集', 'inv.barcode': 'バーコード', 'inv.product_name': '商品名', 'inv.category': 'カテゴリ', 'inv.description': '説明', 'inv.auto_write': '自動執筆', 'inv.price': '価格', 'inv.track_stock': '在庫管理', 'inv.attributes': '属性', 'inv.add_attribute': '属性追加', 'inv.gen_variants': 'バリエーション生成',
    'status.all': 'すべて', 'status.pending': '保留中', 'status.completed': '完了', 'status.cancelled': 'キャンセル', 'status.verifying': '確認中', 'status.debt': 'ツケ',
    'setup.welcome': 'Little Tony APPへようこそ', 'setup.subtitle': 'カンボジア向けのスマートPOS', 'setup.create': '店舗を作成', 'setup.name': '店名', 'setup.type': '業種', 'setup.retail': '小売', 'setup.restaurant': 'レストラン', 'setup.logo': 'ロゴ', 'setup.gen_ai': 'AI生成', 'setup.multi_staff': '複数スタッフ/役割', 'setup.multi_staff_desc': '管理者、ウェイター、キッチンの役割を有効化', 'setup.start': '営業開始',
    'lock.authorized': 'アクセス許可', 'lock.who_login': 'ログイン者は？', 'lock.logout': 'ログアウト', 'lock.create_admin': '管理者作成 (PIN: 123456)', 'lock.no_staff': 'スタッフアカウントがありません。', 'lock.change': '変更', 'lock.exit_demo': 'デモ終了', 'lock.lock_screen': '画面ロック', 'lock.setup_badge': 'パスコードの設定が必要です', 'lock.upgrade_badge': 'セキュリティアップグレード',
    'login.subtitle': '中小企業向けスマートPOS', 'login.owner': 'オーナー', 'login.staff': 'スタッフログイン', 'login.google': 'Googleでログイン', 'login.demo': 'デモモードを試す', 'login.phone': '店舗電話番号', 'login.pin': 'PINコード', 'login.login_btn': 'ログイン',
    'dash.sales_summary': '売上サマリー', 'dash.this_month': '今月', 'dash.this_year': '今年', 'dash.custom': 'カスタム', 'dash.add_expense': '経費追加', 'dash.start_date': '開始日', 'dash.end_date': '終了日', 'dash.income': '総収入', 'dash.expense': '総経費', 'dash.profit': '純利益', 'dash.total_vat': '総VAT', 'dash.total_discount': '割引額', 'dash.credit': '顧客クレジット', 'dash.inventory_alert': '在庫アラート', 'dash.top_selling': '売れ筋商品', 'dash.ai_insight': 'AIビジネスインサイト', 'dash.ask_ai': 'AIアシスタントに聞く',
    'set.general': '一般', 'set.staff': 'スタッフ', 'set.discounts': '割引', 'set.payments': '決済', 'set.hardware': 'ハードウェア', 'set.profile': '店舗プロフィール', 'set.shop_name': '店名', 'set.address': '住所', 'set.phone': '電話番号', 'set.features': '機能', 'set.public_store': '公開ストア/QRメニュー', 'set.booking': 'テーブル予約', 'set.variants': '商品バリエーション', 'set.variants_desc': 'サイズ、色、オプション', 'set.multi_role_title': '多役割スタッフ', 'set.multi_role_desc': '管理者、ウェイター、キッチンの役割', 'set.vat': 'VAT/税', 'set.vat_rate': '税率 (%)', 'set.save': '設定保存', 'set.add_staff': 'スタッフ追加', 'set.edit_staff': 'スタッフ編集', 'set.role_name': '名前', 'set.role_pin': 'PIN (6桁)', 'set.role_select': '役割', 'set.role_cashier': 'レジ係', 'set.role_waiter': 'ウェイター', 'set.role_manager': 'マネージャー', 'set.role_admin': '管理者 (フルアクセス)', 'set.role_kitchen': 'キッチン', 'set.how_auth_works': 'スタッフログイン方法', 'set.auth_step1': '1. 店舗電話番号を使用', 'set.auth_step2': '2. スタッフPINを入力', 'set.auth_step3': '3. 役割によるアクセス制限', 'set.auth_step4': '管理者PINは全機能ロック解除。', 'set.active_discounts': '有効な割引', 'set.add_rule': 'ルール追加', 'set.no_discounts': '有効な割引ルールなし。', 'set.rule_name_ph': 'ルール名 (例: ハッピーアワー)', 'set.rule_type': 'タイプ', 'set.percent': 'パーセンテージ (%)', 'set.fixed_amount': '固定額', 'set.rule_value': '値', 'set.payment_methods': '決済方法', 'set.add_payment': '方法追加', 'set.bank_name': '銀行/プロバイダ名', 'set.acc_name': '口座名', 'set.acc_number': '口座番号', 'set.upload_qr': 'QR画像アップロード', 'set.printer_setup': 'プリンタ設定', 'set.printer_connected': 'プリンタ接続済み', 'set.not_connected': '未接続', 'set.printer_instruction': '58mm/80mm 部署用プリンタ用。', 'set.printer_ready': 'プリンタ準備完了', 'set.connect_printer': 'プリンタ接続',
    'ord.export': 'CSV出力', 'ord.add': '注文追加', 'ord.manual': '手動', 'ord.scan': 'レシートスキャン', 'ord.scan_desc': '紙の注文書/レシートを撮影してAIで自動入力。', 'ord.save': '注文保存', 'ord.cancel_btn': '取引無効化', 'ord.print_thermal': 'レシート印刷', 'ord.cancel_title': '取引無効化', 'ord.cancel_msg': '完了した取引を無効にしますか？在庫は戻されます。',
    'cust.new': '新規顧客', 'cust.pay_debt': '借金返済', 'cust.total_debt': '総借金額', 'cust.history': '履歴', 'cust.payment_received': '入金済み', 'cust.credit_purchase': 'ツケ購入',
    'bk.layout': 'レイアウト', 'bk.schedule': 'スケジュール', 'bk.new_table': '新規テーブル', 'bk.table_name': 'テーブル名', 'bk.capacity': '定員', 'bk.book_btn': '新規予約', 'bk.cust_name': '顧客名', 'bk.guests': '人数', 'bk.notes': 'メモ', 'bk.ai_assist': 'AIアシスタント', 'bk.ask_ai_ph': '空き状況を聞く...', 'bk.new_booking': '新規予約',
    'toast.prod_limit': '商品制限に達しました (200)。', 'toast.fill_prod_name': '商品명を入力してください。', 'toast.logo_gen': '画像生成成功！', 'alert.gen_fail_title': '生成失敗', 'alert.gen_fail_msg': '画像を生成できませんでした。再試行してください。', 'toast.link_copied': 'リンクをクリップボードにコピーしました', 'toast.cat_renamed': 'カテゴリ名を変更しました', 'toast.cant_del_def_cat': 'デフォルトカテゴリは削除できません', 'alert.del_cat_title': 'カテゴリ削除', 'alert.del_cat_msg': 'よろしいですか？このカテゴリの商品は一般に移動されます。', 'toast.cat_deleted': 'カテゴリを削除しました', 'toast.valid_amount': '有効な金額を入力してください', 'toast.exp_added': '経費を追加しました', 'toast.settings_saved': '設定を保存しました', 'toast.enter_shop_name': '店名を入力してください', 'toast.fill_name_pin': '名前とPINを入力してください', 'toast.pin_len': 'PINは6桁である必要があります', 'toast.staff_updated': 'スタッフを更新しました', 'toast.staff_added': 'スタッフを追加しました', 'confirm.del_staff_title': 'スタッフ削除', 'confirm.del_staff_msg': 'このスタッフを削除してもよろしいですか？', 'toast.staff_deleted': 'スタッフを削除しました', 'toast.rule_added': '割引ルールを追加しました', 'confirm.del_rule_title': 'ルール削除', 'confirm.del_rule_msg': 'よろしいですか？', 'toast.max_item_limit': '最大項目数に達しました', 'toast.order_saved': '注文を保存しました', 'toast.sale_cancelled': '取引を無効化しました', 'alert.imp_limit_title': 'インポート制限', 'alert.imp_limit_msg': '検出された項目が多すぎます。50個に制限されました。', 'alert.scan_fail_title': 'スキャン失敗', 'alert.scan_fail_msg': '画像から項目を読み取れませんでした。より鮮明な写真で試してください。', 'alert.invalid_amt_title': '無効な金額', 'alert.invalid_amt_msg': '合計金額をゼロにすることはできません。', 'toast.export_success': 'エクスポート成功',
    'var.details': '詳細', 'var.activity': 'アクティビティ', 'var.available': '利用可能', 'var.attr_name': '属性名 (例: サイズ)', 'var.attr_opts': 'オプション (例: S, M, L)', 'var.variant': 'バリエーション', 'var.regenerate': 'バリエーション再生成',
    'exp.restock': '補充', 'exp.salary': '給与', 'exp.rent': '家賃', 'exp.utilities': '光熱費', 'exp.other': 'その他'
  },
  ko: {
    'nav.pos': '포스', 'nav.inventory': '재고', 'nav.tables': '테이블', 'nav.orders': '주문',
    'nav.customers': '고객', 'nav.dashboard': '대시보드', 'nav.settings': '설정', 'nav.kitchen': '주방', 'nav.bookings': '예약', 'nav.current_shop': '현재 매장',
    'common.save': '저장', 'common.cancel': '취소', 'common.add': '추가', 'common.view': '보기', 'common.upload': '업로드', 'common.camera': '카메라', 'common.ai_gen': 'AI 생성', 'common.basic_info': '기본 정보', 'common.confirm': '확인', 'common.close': '닫기', 'common.switch_lang': '언어 변경',
    'pos.search': '상품 검색...', 'pos.total': '합계', 'pos.pay': '결제', 'pos.empty_cart': '장바구니 비움', 'pos.view_cart': '장바구니 보기', 'pos.cancel_order': '주문 취소', 'pos.confirm_cancel': '취소하시겠습니까?', 'pos.cancel': '거래 취소', 'pos.you_saved': '절약 금액', 'pos.subtotal': '소계', 'pos.tax': '세금', 'pos.start_new': '새 주문 시작', 'pos.select_variant': '옵션 선택', 'pos.dity_card': 'DiTy 카드', 'pos.dity_card_desc': '기프트/멤버십 카드', 'pos.scan_camera': '바코드 스캔',
    'inv.out_of_stock': '품절', 'inv.low_stock': '재고 부족', 'inv.stock': '재고', 'inv.in_stock': '재고 있음', 'inv.add_product': '상품 추가', 'inv.total_products': '총 상품 수', 'inv.public_link': '공개 메뉴 링크', 'inv.manage_cats': '카테고리 관리', 'inv.edit': '편집', 'inv.barcode': '바코드', 'inv.product_name': '상품명', 'inv.category': '카테고리', 'inv.description': '설명', 'inv.auto_write': '자동 작성', 'inv.price': '가격', 'inv.track_stock': '재고 추적', 'inv.attributes': '속성', 'inv.add_attribute': '속성 추가', 'inv.gen_variants': '옵션 생성',
    'status.all': '전체', 'status.pending': '대기 중', 'status.completed': '완료', 'status.cancelled': '취소됨', 'status.verifying': '확인 중', 'status.debt': '외상',
    'setup.welcome': 'Little Tony APP에 오신 것을 환영합니다', 'setup.subtitle': '캄보디아를 위한 스마트 POS', 'setup.create': '매장 만들기', 'setup.name': '매장명', 'setup.type': '업종', 'setup.retail': '소매', 'setup.restaurant': '식당', 'setup.logo': '로고', 'setup.gen_ai': 'AI 생성', 'setup.multi_staff': '다중 직원/역할', 'setup.multi_staff_desc': '관리자, 웨이터, 주방 역할 활성화', 'setup.start': '영업 시작',
    'lock.authorized': '접근 권한', 'lock.who_login': '로그인 사용자?', 'lock.logout': '로그아웃', 'lock.create_admin': '관리자 생성 (PIN: 123456)', 'lock.no_staff': '직원 계정이 없습니다.', 'lock.change': '변경', 'lock.exit_demo': '데모 종료', 'lock.lock_screen': '화면 잠금', 'lock.setup_badge': '비밀번호 설정 필요', 'lock.upgrade_badge': '보안 업그레이드',
    'login.subtitle': '캄보디아 중소기업용 스마트 POS', 'login.owner': '점주', 'login.staff': '직원 로그인', 'login.google': 'Google 로그인', 'login.demo': '데모 모드 체험', 'login.phone': '매장 전화번호', 'login.pin': 'PIN 코드', 'login.login_btn': '로그인',
    'dash.sales_summary': '매출 요약', 'dash.this_month': '이번 달', 'dash.this_year': '올해', 'dash.custom': '사용자 지정', 'dash.add_expense': '비용 추가', 'dash.start_date': '시작일', 'dash.end_date': '종료일', 'dash.income': '총 수입', 'dash.expense': '총 비용', 'dash.profit': '순이익', 'dash.total_vat': '총 VAT', 'dash.total_discount': '할인 제공', 'dash.credit': '고객 외상', 'dash.inventory_alert': '재고 알림', 'dash.top_selling': '인기 상품', 'dash.ai_insight': 'AI 비즈니스 인사이트', 'dash.ask_ai': 'AI 비서에게 질문',
    'set.general': '일반', 'set.staff': '직원', 'set.discounts': '할인', 'set.payments': '결제', 'set.hardware': '하드웨어', 'set.profile': '매장 프로필', 'set.shop_name': '매장명', 'set.address': '주소', 'set.phone': '전화번호', 'set.features': '기능', 'set.public_store': '공개 스토어/QR 메뉴', 'set.booking': '테이블 예약', 'set.variants': '상품 옵션', 'set.variants_desc': '사이즈, 색상, 옵션 등', 'set.multi_role_title': '다중 역할 직원', 'set.multi_role_desc': '관리자, 웨이터, 주방 역할', 'set.vat': 'VAT/세금', 'set.vat_rate': '세율 (%)', 'set.save': '설정 저장', 'set.add_staff': '직원 추가', 'set.edit_staff': '직원 편집', 'set.role_name': '이름', 'set.role_pin': 'PIN (6자리)', 'set.role_select': '역할', 'set.role_cashier': '계산원', 'set.role_waiter': '웨이터', 'set.role_manager': '매니저', 'set.role_admin': '관리자 (전체 권한)', 'set.role_kitchen': '주방', 'set.how_auth_works': '직원 로그인 방법', 'set.auth_step1': '1. 매장 전화번호 사용', 'set.auth_step2': '2. 직원 PIN 입력', 'set.auth_step3': '3. 역할별 접근 제한', 'set.auth_step4': '4. 관리자 PIN은 모든 기능 잠금 해제。', 'set.active_discounts': '활성 할인', 'set.add_rule': '규칙 추가', 'set.no_discounts': '활성 할인 규칙 없음。', 'set.rule_name_ph': '규칙 이름 (예: 해피 아워)', 'set.rule_type': '유형', 'set.percent': '퍼센트 (%)', 'set.fixed_amount': '고정 금액', 'set.rule_value': '값', 'set.payment_methods': '결제 수단', 'set.add_payment': '수단 추가', 'set.bank_name': '은행/제공자 이름', 'set.acc_name': '계좌명', 'set.acc_number': '계좌 번호', 'set.upload_qr': 'QR 이미지 업로드', 'set.printer_setup': '프린터 설정', 'set.printer_connected': '프린터 연결됨', 'set.not_connected': '연결 안 됨', 'set.printer_instruction': '58mm/80mm 블루투스 감열 프린터 (ESC/POS) 지원。', 'set.printer_ready': '프린터 준비됨', 'set.connect_printer': '프린터 연결',
    'ord.export': 'CSV 내보내기', 'ord.add': '주문 추가', 'ord.manual': '수동', 'ord.scan': '영수증 스캔', 'ord.scan_desc': '종이 주문서/영수증을 촬영하여 AI로 자동 입력。', 'ord.save': '주문 저장', 'ord.cancel_btn': '거래 무효화', 'ord.print_thermal': '영수증 인쇄', 'ord.cancel_title': '거래 무효화', 'ord.cancel_msg': '완료된 거래를 무효화하시겠습니까? 재고가 복구됩니다。',
    'cust.new': '새 고객', 'cust.pay_debt': '부채 상환', 'cust.total_debt': '총 부채', 'cust.history': '내역', 'cust.payment_received': '입금됨', 'cust.credit_purchase': '외상 구매',
    'bk.layout': '배치', 'bk.schedule': '일정', 'bk.new_table': '새 테이블', 'bk.table_name': '테이블명', 'bk.capacity': '수용 인원', 'bk.book_btn': '새 예약', 'bk.cust_name': '고객명', 'bk.guests': '인원', 'bk.notes': '메모', 'bk.ai_assist': 'AI 비서', 'bk.ask_ai_ph': '예약 가능 여부 확인...', 'bk.new_booking': '새 예약',
    'toast.prod_limit': '상품 제한에 도달했습니다 (200).', 'toast.fill_prod_name': '상품명을 입력해주세요.', 'toast.logo_gen': '이미지 생성 성공!', 'alert.gen_fail_title': '생성 실패', 'alert.gen_fail_msg': '이미지를 생성할 수 없습니다. 다시 시도해주세요.', 'toast.link_copied': '링크가 클립보드에 복사되었습니다', 'toast.cat_renamed': '카테고리 이름이 변경되었습니다', 'toast.cant_del_def_cat': '기본 카테고리는 삭제할 수 없습니다', 'alert.del_cat_title': '카테고리 삭제', 'alert.del_cat_msg': '확실합니까? 이 카테고리의 상품은 일반으로 이동됩니다.', 'toast.cat_deleted': '카테고리가 삭제되었습니다', 'toast.valid_amount': '유효한 금액을 입력해주세요', 'toast.exp_added': '비용이 추가되었습니다', 'toast.settings_saved': '설정이 저장되었습니다', 'toast.enter_shop_name': '매장명을 입력해주세요', 'toast.fill_name_pin': '이름과 PIN을 입력해주세요', 'toast.pin_len': 'PIN은 6자리여야 합니다', 'toast.staff_updated': '직원이 업데이트되었습니다', 'toast.staff_added': '직원이 추가되었습니다', 'confirm.del_staff_title': '직원 삭제', 'confirm.del_staff_msg': '이 직원을 삭제하시겠습니까?', 'toast.staff_deleted': '직원이 삭제되었습니다', 'toast.rule_added': '할인 규칙이 추가되었습니다', 'confirm.del_rule_title': '규칙 삭제', 'confirm.del_rule_msg': '확실합니까?', 'toast.max_item_limit': '최대 항목 제한에 도달했습니다', 'toast.order_saved': '주문이 저장되었습니다', 'toast.sale_cancelled': '거래가 무효화되었습니다', 'alert.imp_limit_title': '가져오기 제한', 'alert.imp_limit_msg': '감지된 항목이 너무 많습니다. 50개로 제한되었습니다.', 'alert.scan_fail_title': '스캔 실패', 'alert.scan_fail_msg': '이미지에서 항목을 읽을 수 없습니다. 더 선명한 사진으로 시도해주세요.', 'alert.invalid_amt_title': '유효하지 않은 금액', 'alert.invalid_amt_msg': '총 금액은 0일 수 없습니다.', 'toast.export_success': '내보내기 성공',
    'var.details': '상세', 'var.activity': '활동', 'var.available': '사용 가능', 'var.attr_name': '속성명 (예: 사이즈)', 'var.attr_opts': '옵션 (예: S, M, L)', 'var.variant': '변형', 'var.regenerate': '변형 재생성',
    'exp.restock': '재입고', 'exp.salary': '급여', 'exp.rent': '임대료', 'exp.utilities': '공과금', 'exp.other': '기타'
  }
};

export const MAX_PRODUCTS_LIMIT = 200;

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [settings, setSettingsState] = useState<Settings>({
    taxRate: 0, currency: 'KHR', exchangeRate: 4000,
    enablePublicStore: false, enableBooking: false, enableAttributes: false,
    enableMultiRoles: false, defaultLanguage: 'km'
  });
  const [language, setLanguage] = useState<LanguageCode>('km');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null);
  // Server-minted staff session token (null while offline-activated, pending mint)
  const [staffToken, setStaffTokenState] = useState<string | null>(null);
  // True while a standalone staff login session (no Supabase auth user) is active,
  // so the auth listener's signed-out branch doesn't wipe the loaded shop.
  const staffSessionRef = useRef(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);

  // Durable offline write queue: keep the pending count in sync and drain on reconnect.
  useEffect(() => {
    const off = onQueueChange(setPendingWrites);
    setPendingWrites(getQueueLength());
    initSync();
    return off;
  }, []);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const t = (key: string) => {
      const dict = TRANSLATIONS[language] || TRANSLATIONS['en'];
      return dict[key] || key;
  };
  const formatPrice = (amount: number) => {
      return new Intl.NumberFormat('km-KH', { 
          style: 'currency', 
          currency: 'KHR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
      }).format(amount);
  };

  useEffect(() => {
    // Use getSession() (reads the persisted session from local storage, no
    // network) instead of getUser() (which validates against the auth server).
    // This lets a previously-authenticated user stay signed in while OFFLINE.
    supabase.auth.getSession().then(async ({ data }) => {
        const sessionUser = data.session?.user;
        if (sessionUser) {
            setUser(sessionUser);
            loadShopData(sessionUser.id);
            return;
        }
        // No owner session — try restoring a persisted staff login session.
        const restored = await restoreStaffSession();
        if (!restored) setLoadingAuth(false);
    }).catch(() => setLoadingAuth(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
            setUser(session.user);
            loadShopData(session.user.id);
        } else if (!staffSessionRef.current) {
            setUser(null);
            setCurrentShop(null);
            setLoadingAuth(false);
        }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const setStaffToken = (token: string | null) => {
      setSupabaseStaffToken(token);
      setStaffTokenState(token);
  };

  /** Restore a persisted phone+PIN staff session (standalone staff device). */
  const restoreStaffSession = async (): Promise<boolean> => {
      let saved: { token: string; staff: Staff } | null = null;
      try { saved = JSON.parse(localStorage.getItem(STAFF_SESSION_KEY) || 'null'); } catch { saved = null; }
      if (!saved?.token || !saved?.staff?.shopId) return false;

      setSupabaseStaffToken(saved.token);
      try {
          const { data, error } = await supabase.rpc(DB_CONSTANTS.RPC_VALIDATE_STAFF_SESSION);
          if (error || !data || data.length === 0) {
              // Expired / revoked server-side — clear it.
              localStorage.removeItem(STAFF_SESSION_KEY);
              setSupabaseStaffToken(null);
              return false;
          }
          const s = data[0];
          staffSessionRef.current = true;
          setStaffTokenState(saved.token);
          setActiveStaff({ id: s.id, shopId: s.shop_id, name: s.name, role: s.role, avatarUrl: s.avatar_url });
          await loadShopData({ shopId: s.shop_id });
          return true;
      } catch {
          // Offline: trust the cached session until we can validate.
          staffSessionRef.current = true;
          setStaffTokenState(saved.token);
          setActiveStaff(saved.staff);
          await loadShopData({ shopId: saved.staff.shopId });
          return true;
      }
  };

  // Offline staff activation leaves us without a server session token. Once the
  // owner-authenticated device is back online, mint the real token silently.
  useEffect(() => {
      const mintIfNeeded = async () => {
          if (!user || !activeStaff || staffToken || navigator.onLine === false) return;
          try {
              const { data } = await supabase.rpc(DB_CONSTANTS.RPC_OWNER_ACTIVATE_STAFF, { _staff_id: activeStaff.id });
              if (data && data.length > 0) setStaffToken(data[0].session_token);
          } catch { /* retry on next reconnect */ }
      };
      mintIfNeeded();
      window.addEventListener('online', mintIfNeeded);
      return () => window.removeEventListener('online', mintIfNeeded);
  }, [user, activeStaff, staffToken]);

  const loadShopData = async (param: string | { shopId: string }) => {
      setLoadingAuth(true);
      try {
          const query = typeof param === 'string'
              ? supabase.from(DB_CONSTANTS.TABLE_SHOPS).select('*').eq('owner_id', param).limit(1)
              : supabase.from(DB_CONSTANTS.TABLE_SHOPS).select('*').eq('id', param.shopId).limit(1);
          const { data: shops } = await query;
          if (shops && shops.length > 0) {
              const shop = shops[0];
              const mappedShop: Shop = { 
                  id: shop.id, name: shop.name, type: shop.type, 
                  logoUrl: shop.logo_url, address: shop.address, phone: shop.phone, ownerId: shop.owner_id 
              };
              setCurrentShop(mappedShop);

              const { data: setts } = await supabase.from(DB_CONSTANTS.TABLE_SETTINGS).select('*').eq('shop_id', shop.id).single();
              if (setts) {
                  const mappedSettings: Settings = {
                      taxRate: Number(setts.tax_rate), currency: setts.currency, exchangeRate: Number(setts.exchange_rate),
                      enablePublicStore: setts.enable_public_store, enableBooking: setts.enable_booking,
                      enableAttributes: setts.enable_attributes, enableMultiRoles: setts.enable_multi_roles,
                      defaultLanguage: setts.default_language || 'km'
                  };
                  setSettingsState(mappedSettings);
                  // Ensure we default to 'km' if null
                  setLanguage(mappedSettings.defaultLanguage || 'km');
              }

              const [pRes, cRes, stRes, tRes, bRes, dRes, pmRes, sRes] = await Promise.all([
                  supabase.from(DB_CONSTANTS.TABLE_PRODUCTS).select('*').eq('shop_id', shop.id),
                  supabase.from(DB_CONSTANTS.TABLE_CUSTOMERS).select('*').eq('shop_id', shop.id),
                  // PIN hashes are never selected — column privileges block them anyway.
                  supabase.from(DB_CONSTANTS.TABLE_STAFF).select('id, shop_id, name, role, avatar_url, has_pin').eq('shop_id', shop.id),
                  supabase.from(DB_CONSTANTS.TABLE_TABLES).select('*').eq('shop_id', shop.id),
                  supabase.from(DB_CONSTANTS.TABLE_BOOKINGS).select('*').eq('shop_id', shop.id),
                  supabase.from(DB_CONSTANTS.TABLE_DISCOUNTS).select('*').eq('shop_id', shop.id),
                  supabase.from(DB_CONSTANTS.TABLE_PAYMENT_METHODS).select('*').eq('shop_id', shop.id),
                  supabase.from(DB_CONSTANTS.TABLE_SALES).select('*').eq('shop_id', shop.id).order('timestamp', { ascending: false }).limit(50)
              ]);

              if(pRes.data) setProducts(pRes.data.map((p: any) => ({...p, shopId: p.shop_id, imageUrl: p.image_url, trackStock: p.track_stock})));
              if(cRes.data) setCustomers(cRes.data.map((c: any) => ({...c, shopId: c.shop_id, totalDebt: c.total_debt, lastInteraction: c.last_interaction})));
              if(stRes.data) setStaffList(stRes.data.map((s: any) => ({id: s.id, shopId: s.shop_id, name: s.name, role: s.role, avatarUrl: s.avatar_url, hasPin: s.has_pin})));
              if(tRes.data) setTables(tRes.data.map((t: any) => ({...t, shopId: t.shop_id, allowOrdering: t.allow_ordering})));
              if(bRes.data) setBookings(bRes.data.map((b: any) => ({...b, shopId: b.shop_id, customerName: b.customer_name, tableId: b.table_id})));
              if(dRes.data) setDiscountRules(dRes.data.map((d: any) => ({...d, shopId: d.shop_id})));
              if(pmRes.data) setPaymentMethods(pmRes.data.map((p: any) => ({...p, shopId: p.shop_id, accountName: p.account_name, accountNumber: p.account_number, qrCodeUrl: p.qr_code_url})));
              if(sRes.data) setSales(sRes.data.map((s: any) => ({
                  id: s.id, shopId: s.shop_id, timestamp: s.timestamp, total: Number(s.total), subtotal: Number(s.subtotal),
                  tax: Number(s.tax), paymentMethod: s.payment_method, orderStatus: s.order_status,
                  items: typeof s.items === 'string' ? JSON.parse(s.items) : s.items, currency: s.currency, exchangeRate: Number(s.exchange_rate),
                  customerId: s.customer_id, tableId: s.table_id, paymentProofUrl: s.payment_proof_url
              })));

          }
      } catch (err) {
          console.error("Error loading shop data", err);
      } finally {
          setLoadingAuth(false);
      }
  };

  const createShop = async (name: string, type: 'retail' | 'restaurant', logoUrl?: string, enableMultiRoles?: boolean) => {
      if (!user) return;
      const shopId = generateId();
      
      try {
          // 1. Create Shop (Insert first to satisfy FK for settings/staff)
          const { error: shopError } = await supabase.from(DB_CONSTANTS.TABLE_SHOPS).insert({ 
              id: shopId, 
              name, 
              type, 
              logo_url: logoUrl, 
              owner_id: user.id 
          });
          
          if (shopError) throw shopError;

          // 2. Create Settings
          await supabase.from(DB_CONSTANTS.TABLE_SETTINGS).insert({ 
              id: generateId(), 
              shop_id: shopId, 
              enable_multi_roles: enableMultiRoles,
              default_language: 'km'
          });
          
          // 3. Create Default Admin Staff
          // Automatically create "Owner" with PIN "123456" to prevent lockout
          await supabase.from(DB_CONSTANTS.TABLE_STAFF).insert({
              id: generateId(),
              shop_id: shopId,
              name: 'Owner',
              pin: '123456',
              role: 'admin'
          });

          // 4. Reload Data to update UI
          await loadShopData(user.id);
      } catch (err) {
          console.error("Failed to create shop:", err);
          throw err;
      }
  };

  const signInWithGoogle = async () => { 
      await supabase.auth.signInWithOAuth({ 
          provider: 'google',
          options: {
              redirectTo: window.location.origin
          }
      }); 
  };
  const signInAsDemoUser = async () => { };
  const signOut = async () => {
      if (staffToken) { try { await supabase.rpc(DB_CONSTANTS.RPC_STAFF_LOGOUT, { _token: staffToken }); } catch { /* best effort */ } }
      staffSessionRef.current = false;
      localStorage.removeItem(STAFF_SESSION_KEY);
      setStaffToken(null);
      setActiveStaff(null);
      await supabase.auth.signOut();
      // Standalone staff sessions have no Supabase auth session, so the auth
      // listener will not fire — clear the app state explicitly.
      setUser(null);
      setCurrentShop(null);
  };

  const loginAsStaff = async (phone: string, pin: string) => {
      const { data } = await supabase.rpc(DB_CONSTANTS.RPC_STAFF_LOGIN, { phone_number: phone, pin_code: pin });
      if (data && data.length > 0) {
          const s = data[0];
          const loggedStaff: Staff = {
              id: s.id,
              shopId: s.shop_id,
              name: s.name,
              role: s.role,
              avatarUrl: s.avatar_url
          };
          staffSessionRef.current = true;
          // Set the token header BEFORE loading shop data — RLS needs it.
          setStaffToken(s.session_token);
          setActiveStaff(loggedStaff);
          try { localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify({ token: s.session_token, staff: loggedStaff })); } catch { /* ignore */ }
          await seedPinCache(s.id, pin);
          await loadShopData({ shopId: s.shop_id });
          return true;
      }
      return false;
  };

  /**
   * Lock-screen operator switch. The PIN is verified SERVER-SIDE
   * (staff_switch RPC) and a session token is minted. When the shared device
   * is offline, fall back to the locally-cached SHA-256 digest of the PIN and
   * mint the real token on reconnect (owner_activate_staff).
   */
  const switchStaff = async (pin: string, staffId?: string): Promise<boolean> => {
      const target = staffId ? staffList.find(s => s.id === staffId) : null;
      try {
          if (staffId) {
              const { data, error } = await supabase.rpc(DB_CONSTANTS.RPC_STAFF_SWITCH, { _staff_id: staffId, _pin: pin });
              if (error) throw error;
              if (data && data.length > 0) {
                  const s = data[0];
                  setStaffToken(s.session_token);
                  setActiveStaff({ id: s.id, shopId: s.shop_id, name: s.name, role: s.role, avatarUrl: s.avatar_url, hasPin: true });
                  await seedPinCache(s.id, pin);
                  return true;
              }
              return false;
          }
          // No staff id — legacy call shape; cannot verify server-side safely.
          return false;
      } catch (e) {
          if (isNetworkFailure(e) && target && await verifyPinOffline(target.id, pin)) {
              // Offline shared-device switch: activate locally; token minted on reconnect.
              setStaffToken(null);
              setActiveStaff(target);
              return true;
          }
          console.error('switchStaff failed', e);
          return false;
      }
  };

  /** Owner-authorized activation without a PIN (single-role auto-login). */
  const activateStaffAsOwner = async (staffId: string): Promise<boolean> => {
      const target = staffList.find(s => s.id === staffId);
      try {
          const { data, error } = await supabase.rpc(DB_CONSTANTS.RPC_OWNER_ACTIVATE_STAFF, { _staff_id: staffId });
          if (error) throw error;
          if (data && data.length > 0) {
              const s = data[0];
              setStaffToken(s.session_token);
              setActiveStaff({ id: s.id, shopId: s.shop_id, name: s.name, role: s.role, avatarUrl: s.avatar_url, hasPin: true });
              return true;
          }
          return false;
      } catch (e) {
          if (isNetworkFailure(e) && target) {
              // Offline: the owner auth session is the authority; mint on reconnect.
              setStaffToken(null);
              setActiveStaff(target);
              return true;
          }
          console.error('activateStaffAsOwner failed', e);
          return false;
      }
  };

  const logoutStaff = () => {
      if (staffToken) { supabase.rpc(DB_CONSTANTS.RPC_STAFF_LOGOUT, { _token: staffToken }).then(() => {}, () => {}); }
      setStaffToken(null);
      setActiveStaff(null);
  };

  const addStaff = async (staff: Partial<Staff>) => {
      if (!currentShop) return;
      const id = generateId();
      const { error } = await supabase.from(DB_CONSTANTS.TABLE_STAFF).insert({
          id, shop_id: currentShop.id, name: staff.name, pin: staff.pin || '', role: staff.role, avatar_url: staff.avatarUrl
      });
      if (error) { console.error('addStaff failed', error); throw error; }
      if (staff.pin) await seedPinCache(id, staff.pin);
      setStaffList(prev => [...prev, { id, shopId: currentShop.id, name: staff.name || '', role: staff.role || 'cashier', avatarUrl: staff.avatarUrl, hasPin: !!staff.pin } as Staff]);
  };
  const updateStaff = async (id: string, updates: Partial<Staff>) => {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
      if (updates.pin !== undefined) payload.pin = updates.pin; // hashed by DB trigger
      const { error } = await supabase.from(DB_CONSTANTS.TABLE_STAFF).update(payload).eq('id', id);
      if (error) { console.error('updateStaff failed', error); throw error; }
      if (updates.pin) await seedPinCache(id, updates.pin);
      setStaffList(prev => prev.map(s => s.id === id ? { ...s, ...updates, pin: undefined, hasPin: updates.pin ? true : s.hasPin } : s));
  };
  const deleteStaff = async (id: string) => {
      const { error } = await supabase.from(DB_CONSTANTS.TABLE_STAFF).delete().eq('id', id);
      if (error) { console.error('deleteStaff failed', error); throw error; }
      setStaffList(prev => prev.filter(s => s.id !== id));
  };

  const addProduct = async (product: Partial<Product>) => {
      if (!currentShop) return;
      const dbProduct = {
          id: product.id, shop_id: currentShop.id, name: product.name, description: product.description,
          price: product.price, stock: product.stock, track_stock: product.trackStock, category: product.category,
          image_url: product.imageUrl, barcode: product.barcode, attributes: product.attributes, variants: product.variants
      };
      await dbWrite({ table: DB_CONSTANTS.TABLE_PRODUCTS, action: 'insert', payload: dbProduct });
      setProducts(prev => [...prev, { ...product, shopId: currentShop.id } as Product]);
  };
  const updateProduct = async (product: Partial<Product>) => {
      const dbProduct: any = {};
      if(product.name) dbProduct.name = product.name;
      if(product.price !== undefined) dbProduct.price = product.price;
      if(product.stock !== undefined) dbProduct.stock = product.stock;
      if(product.imageUrl) dbProduct.image_url = product.imageUrl;
      if(product.description !== undefined) dbProduct.description = product.description;
      if(product.category) dbProduct.category = product.category;
      if(product.attributes) dbProduct.attributes = product.attributes;
      if(product.variants) dbProduct.variants = product.variants;
      if(product.trackStock !== undefined) dbProduct.track_stock = product.trackStock;
      
      await dbWrite({ table: DB_CONSTANTS.TABLE_PRODUCTS, action: 'update', payload: dbProduct, match: { id: product.id } });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, ...product } : p));
  };
  const getProductActivities = (pid: string) => [];
  const fetchMoreActivities = async (pid: string) => {};
  const hasMoreActivities = (pid: string) => false;
  
  const renameCategory = async (oldName: string, newName: string) => {
      if (!currentShop) return;
      try {
          const { error } = await supabase.from(DB_CONSTANTS.TABLE_PRODUCTS)
              .update({ category: newName })
              .eq('shop_id', currentShop.id)
              .eq('category', oldName);
          if (error) throw error;
          
          setProducts(prev => prev.map(p => p.category === oldName ? { ...p, category: newName } : p));
      } catch (err) {
          console.error("Failed to rename category:", err);
      }
  };
  
  const deleteCategory = async (name: string) => {
      if (!currentShop) return;
      try {
          const { error } = await supabase.from(DB_CONSTANTS.TABLE_PRODUCTS)
              .update({ category: 'General' })
              .eq('shop_id', currentShop.id)
              .eq('category', name);
          if (error) throw error;

          setProducts(prev => prev.map(p => p.category === name ? { ...p, category: 'General' } : p));
      } catch (err) {
          console.error("Failed to delete category:", err);
      }
  };

  const addToCart = (product: Product, variant?: any) => {
      setCart(prev => {
          const existing = prev.find(p => p.id === product.id && p.variantId === variant?.id);
          if (existing) return prev.map(p => p === existing ? { ...p, quantity: p.quantity + 1 } : p);
          return [...prev, { ...product, quantity: 1, variantId: variant?.id, variantName: variant?.options?.join(' / '), price: variant ? variant.price : product.price }];
      });
  };
  const updateCartQuantity = (id: string, delta: number, variantId?: string) => {
      setCart(prev => prev.map(p => (p.id === id && p.variantId === variantId) ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p).filter(p => p.quantity > 0));
  };
  const removeFromCart = (id: string) => setCart(prev => prev.filter(p => p.id !== id));
  const clearCart = () => setCart([]);
  
  const getBestDiscountForItem = (item: CartItem, customerId?: string) => {
      let bestPrice = item.price;
      let discountAmount = 0;
      let appliedRule: DiscountRule | undefined;

      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      const currentDate = now.getTime();

      discountRules.forEach(rule => {
          if (!rule.active) return;

          // Conditions
          const { conditions } = rule;
          
          // Date
          if (conditions.startDate && conditions.startDate > currentDate) return;
          if (conditions.endDate && conditions.endDate < currentDate) return;

          // Time
          if (conditions.startTime && conditions.endTime) {
              if (currentTime < conditions.startTime || currentTime > conditions.endTime) return;
          }

          // Days
          if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
              if (!conditions.daysOfWeek.includes(currentDay)) return;
          }

          // Min Qty
          if (conditions.minQty && item.quantity < conditions.minQty) return;

          // Products
          if (conditions.productIds && conditions.productIds.length > 0) {
              if (!conditions.productIds.includes(item.id)) return;
          }

          // Categories
          if (conditions.categoryIds && conditions.categoryIds.length > 0) {
              if (!conditions.categoryIds.includes(item.category || '')) return;
          }

          // Customer Type
          if (conditions.customerType === 'repeat' && !customerId) return;

          // Calculate
          let rulePrice = item.price;
          if (rule.type === 'percentage') {
              rulePrice = item.price * (1 - rule.value / 100);
          } else if (rule.type === 'fixed_amount') {
              rulePrice = Math.max(0, item.price - rule.value);
          }

          if (rulePrice < bestPrice) {
              bestPrice = rulePrice;
              discountAmount = item.price - rulePrice;
              appliedRule = rule;
          }
      });

      return { finalPrice: bestPrice, discountAmount, rule: appliedRule };
  };

  /**
   * Decrement stock for every tracked item in a sale, both in local state and
   * (offline-safely) in the database. Shared by retail checkout, manual sales,
   * online-order verification, and dine-in order completion.
   */
  const applyStockDecrement = (items: CartItem[]) => {
      const updatedProducts = products.map(p => {
          const cartItemsForProduct = items.filter(item => item.id === p.id);
          if (cartItemsForProduct.length === 0) return p;
          if (p.trackStock === false) return p;

          let newStock = p.stock || 0;
          let newVariants = p.variants ? [...p.variants] : undefined;

          cartItemsForProduct.forEach(item => {
              if (item.variantId && newVariants) {
                  newVariants = newVariants.map(v => {
                      if (v.id === item.variantId) {
                          return { ...v, stock: Math.max(0, (v.stock || 0) - item.quantity) };
                      }
                      return v;
                  });
                  newStock = newVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
              } else {
                  newStock = Math.max(0, newStock - item.quantity);
              }
          });

          return { ...p, stock: newStock, variants: newVariants };
      });

      setProducts(updatedProducts);

      // Persist stock changes (offline-safe via the sync queue)
      updatedProducts.forEach((p) => {
          const originalProduct = products.find(op => op.id === p.id);
          if (!originalProduct) return;
          if (originalProduct.stock !== p.stock || JSON.stringify(originalProduct.variants) !== JSON.stringify(p.variants)) {
              dbWrite({ table: DB_CONSTANTS.TABLE_PRODUCTS, action: 'update', payload: { stock: p.stock, variants: p.variants }, match: { id: p.id } });
          }
      });
  };

  /**
   * Notify the customer QR page of this table that its order changed. The
   * customer page cannot read the sales table (RLS), so it listens for
   * 'table_update' broadcasts and refetches via RPC.
   */
  const broadcastTableUpdate = (tableId?: string | null) => {
      if (!tableId) return;
      try {
          const topic = `public_order:${tableId}`;
          const ch = supabase.channel(topic);
          ch.subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                  ch.send({ type: 'broadcast', event: 'table_update', payload: { tableId } })
                    .then(() => { supabase.removeChannel(ch); }, () => { supabase.removeChannel(ch); });
              }
          });
      } catch { /* non-critical */ }
  };

  const checkout = (method: string, customerId?: string) => {
      if (!currentShop) return null;
      if (cart.length === 0) return null;

      // Apply the exact discount math the POS displays, so the stored sale
      // matches what the cashier and customer saw on screen.
      const itemsWithDiscounts: CartItem[] = cart.map(item => {
          const { finalPrice, discountAmount, rule } = getBestDiscountForItem(item, customerId);
          return {
              ...item,
              finalPrice,
              discountAmount,
              appliedDiscount: rule ? { name: rule.name, amountSaved: discountAmount } : undefined
          };
      });

      const subtotal = itemsWithDiscounts.reduce((sum, i) => sum + ((i.finalPrice ?? i.price) * i.quantity), 0);
      const tax = subtotal * ((settings.taxRate || 0) / 100);
      const total = subtotal + tax;
      const isCredit = method === 'credit';

      const sale: Sale = {
          id: generateId(),
          shopId: currentShop.id,
          timestamp: Date.now(),
          total, subtotal, tax, paymentMethod: method,
          // Credit sales are tracked as open debt until repaid (see repayDebt).
          orderStatus: isCredit ? 'debt' : 'completed',
          items: itemsWithDiscounts, currency: settings.currency, exchangeRate: settings.exchangeRate, customerId
      };

      applyStockDecrement(itemsWithDiscounts);

      // Credit: record the amount on the customer's debt ledger
      if (isCredit && customerId) {
          const customer = customers.find(c => c.id === customerId);
          const newDebt = (customer?.totalDebt || 0) + total;
          setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, totalDebt: newDebt } : c));
          dbWrite({ table: DB_CONSTANTS.TABLE_CUSTOMERS, action: 'update', payload: { total_debt: newDebt }, match: { id: customerId } });
      }

      setSales(prev => [sale, ...prev]);
      clearCart();
      dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'insert', payload: {
          id: sale.id, shop_id: sale.shopId, timestamp: sale.timestamp, total: sale.total,
          subtotal: sale.subtotal, tax: sale.tax, payment_method: sale.paymentMethod, order_status: sale.orderStatus,
          items: sale.items, currency: sale.currency, exchange_rate: sale.exchangeRate, customer_id: sale.customerId
      }});
      return sale;
  };

  const addManualSale = async (sale: Sale) => {
      applyStockDecrement(sale.items);

      setSales(prev => [sale, ...prev]);
      await dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'insert', payload: {
          id: sale.id, shop_id: sale.shopId, timestamp: sale.timestamp, total: sale.total,
          subtotal: sale.subtotal, tax: sale.tax, payment_method: sale.paymentMethod, order_status: sale.orderStatus,
          items: sale.items, currency: sale.currency, exchange_rate: sale.exchangeRate
      }});
  };

  const addCustomer = async (name: string, phone?: string, email?: string) => {
      if (!currentShop) return '';
      const id = generateId();
      await dbWrite({ table: DB_CONSTANTS.TABLE_CUSTOMERS, action: 'insert', payload: { id, shop_id: currentShop.id, name, phone, email } });
      setCustomers(prev => [...prev, { id, shopId: currentShop.id, name, phone, email, totalDebt: 0, lastInteraction: Date.now() }]);
      return id;
  };
  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
      // Map camelCase → snake_case for the DB payload
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.email !== undefined) payload.email = updates.email;
      if (updates.totalDebt !== undefined) payload.total_debt = updates.totalDebt;
      if (updates.lastInteraction !== undefined) payload.last_interaction = updates.lastInteraction;
      await dbWrite({ table: DB_CONSTANTS.TABLE_CUSTOMERS, action: 'update', payload, match: { id } });
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  /**
   * Record a debt repayment: reduce the customer's ledger and settle their
   * oldest open 'debt' sales (fully-covered ones flip to 'completed', which is
   * when they start counting as dashboard revenue).
   */
  const repayDebt = async (cid: string, amount: number) => {
      const customer = customers.find(c => c.id === cid);
      if (!customer || !(amount > 0)) return;

      const newDebt = Math.max(0, (customer.totalDebt || 0) - amount);

      let remaining = amount;
      const settledIds: string[] = [];
      const debtSales = sales
          .filter(s => s.customerId === cid && s.orderStatus === 'debt')
          .sort((a, b) => a.timestamp - b.timestamp);
      for (const s of debtSales) {
          if (remaining >= s.total) {
              remaining -= s.total;
              settledIds.push(s.id);
          } else {
              break;
          }
      }

      if (settledIds.length > 0) {
          setSales(prev => prev.map(s => settledIds.includes(s.id) ? { ...s, orderStatus: 'completed' } : s));
          for (const sid of settledIds) {
              await dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'update', payload: { order_status: 'completed' }, match: { id: sid } });
          }
      }

      setCustomers(prev => prev.map(c => c.id === cid ? { ...c, totalDebt: newDebt, lastInteraction: Date.now() } : c));
      await dbWrite({ table: DB_CONSTANTS.TABLE_CUSTOMERS, action: 'update', payload: { total_debt: newDebt, last_interaction: Date.now() }, match: { id: cid } });
  };

  const findOrCreateCustomer = async (phone: string, name?: string): Promise<Customer | null> => {
      if (!phone || !currentShop) return null;
      const existing = customers.find(c => c.phone === phone);
      if (existing) return existing;
      const id = await addCustomer(name || 'Customer', phone);
      if (!id) return null;
      return { id, shopId: currentShop.id, name: name || 'Customer', phone, totalDebt: 0, lastInteraction: Date.now() };
  };

  const addTable = async (name: string, capacity: number) => {
      if (!currentShop) return;
      const id = generateId();
      await dbWrite({ table: DB_CONSTANTS.TABLE_TABLES, action: 'insert', payload: { id, shop_id: currentShop.id, name, capacity, status: 'available', allow_ordering: false } });
      setTables(prev => [...prev, { id, shopId: currentShop.id, name, capacity, status: 'available', allowOrdering: false }]);
  };
  const updateTable = async (id: string, updates: Partial<Table>) => {
      // Map only real DB columns (snake_case); a stray camelCase key makes PostgREST reject the write.
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.capacity !== undefined) payload.capacity = updates.capacity;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.allowOrdering !== undefined) payload.allow_ordering = updates.allowOrdering;
      await dbWrite({ table: DB_CONSTANTS.TABLE_TABLES, action: 'update', payload, match: { id } });
      setTables(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  const addBooking = async (booking: any) => {
      if (!currentShop) return;
      const id = generateId();
      await dbWrite({ table: DB_CONSTANTS.TABLE_BOOKINGS, action: 'insert', payload: { id, shop_id: currentShop.id, customer_name: booking.customerName, phone: booking.phone, time: booking.time, guests: booking.guests, table_id: booking.tableId, notes: booking.notes } });
      setBookings(prev => [...prev, { ...booking, id, shopId: currentShop.id }]);
  };

  const updateSettings = async (updates: Partial<Settings>) => {
      if (!currentShop) return;
      await supabase.from(DB_CONSTANTS.TABLE_SETTINGS).update({
          tax_rate: updates.taxRate, enable_public_store: updates.enablePublicStore,
          enable_booking: updates.enableBooking, enable_attributes: updates.enableAttributes,
          enable_multi_roles: updates.enableMultiRoles, default_language: updates.defaultLanguage
      }).eq('shop_id', currentShop.id);
      setSettingsState(prev => ({ ...prev, ...updates }));
  };
  const updateShop = async (updates: Partial<Shop>) => {
      if (!currentShop) return;
      await supabase.from(DB_CONSTANTS.TABLE_SHOPS).update({ name: updates.name, address: updates.address, phone: updates.phone, logo_url: updates.logoUrl, type: updates.type }).eq('id', currentShop.id);
      setCurrentShop(prev => prev ? { ...prev, ...updates } : null);
  };

  const fetchMoreSales = async () => {};
  const hasMoreSales = false;
  /**
   * Staff verification of a customer's submitted payment (order_status
   * 'pending_verification').
   *  - Table orders: payment is verified → send items to the kitchen
   *    ('confirmed'); the sale completes when the table is finished.
   *  - Retail online orders: complete the sale now and decrement stock.
   */
  const verifyOrder = async (id: string) => {
      const sale = sales.find(s => s.id === id);
      if (!sale) return;

      if (sale.tableId) {
          await confirmOrderItems(id);
      } else {
          applyStockDecrement(sale.items);
          setSales(prev => prev.map(s => s.id === id ? { ...s, orderStatus: 'completed', paymentMethod: 'khqr' } : s));
          await dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'update', payload: { order_status: 'completed', payment_method: 'khqr' }, match: { id } });
      }
      broadcastTableUpdate(sale.tableId);
  };
  
  const cancelSale = async (id: string) => {
      try {
          const saleToCancel = sales.find(s => s.id === id);
          if (!saleToCancel) return;

          await dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'update', payload: { order_status: 'cancelled' }, match: { id } });

          setSales(prev => prev.map(s => s.id === id ? { ...s, orderStatus: 'cancelled' } : s));

          // If voiding/cancelling a previously valid order, restore product stock
          if (saleToCancel.orderStatus === 'completed' || saleToCancel.orderStatus === 'confirmed') {
              const updatedProducts = products.map(p => {
                  const itemsForProduct = saleToCancel.items.filter(item => item.id === p.id);
                  if (itemsForProduct.length === 0) return p;
                  if (p.trackStock === false) return p;

                  let newStock = p.stock || 0;
                  let newVariants = p.variants ? [...p.variants] : undefined;

                  itemsForProduct.forEach(item => {
                      if (item.variantId && newVariants) {
                          newVariants = newVariants.map(v => {
                              if (v.id === item.variantId) {
                                  return { ...v, stock: (v.stock || 0) + item.quantity };
                              }
                              return v;
                          });
                          newStock = newVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
                      } else {
                          newStock = newStock + item.quantity;
                      }
                  });

                  return {
                      ...p,
                      stock: newStock,
                      variants: newVariants
                  };
              });

              setProducts(updatedProducts);

              for (const p of updatedProducts) {
                  const originalProduct = products.find(op => op.id === p.id);
                  if (!originalProduct) continue;
                  if (originalProduct.stock !== p.stock || JSON.stringify(originalProduct.variants) !== JSON.stringify(p.variants)) {
                      dbWrite({ table: DB_CONSTANTS.TABLE_PRODUCTS, action: 'update', payload: { stock: p.stock, variants: p.variants }, match: { id: p.id } });
                  }
              }
          }
      } catch (err) {
          console.error("Failed to cancel sale:", err);
      }
  };
  
  const mapSaleRow = (s: any): Sale => ({
      id: s.id, shopId: s.shop_id, timestamp: s.timestamp, total: Number(s.total), subtotal: Number(s.subtotal),
      tax: Number(s.tax), paymentMethod: s.payment_method, orderStatus: s.order_status,
      items: typeof s.items === 'string' ? JSON.parse(s.items) : (s.items || []),
      currency: s.currency, exchangeRate: Number(s.exchange_rate),
      customerId: s.customer_id, tableId: s.table_id, paymentProofUrl: s.payment_proof_url, amountPaid: s.amount_paid
  });

  const refreshSales = async () => {
      if (!currentShop) return;
      const { data, error } = await supabase.from(DB_CONSTANTS.TABLE_SALES)
          .select('*').eq('shop_id', currentShop.id)
          .order('timestamp', { ascending: false }).limit(50);
      if (!error && data) setSales(data.map(mapSaleRow));
  };
  const exportSalesData = async () => {};

  const addExpense = async (expense: Partial<Expense>) => {
      if (!currentShop) return;
      const id = generateId();
      await dbWrite({ table: DB_CONSTANTS.TABLE_EXPENSES, action: 'insert', payload: {
          id, shop_id: currentShop.id, amount: expense.amount, category: expense.category,
          note: expense.note, date: expense.date
      }});
  };

  const getDashboardMetrics = async (start: number, end: number) => {
      const empty = { revenue: 0, expenses: 0, transactions: 0, tax: 0, discount: 0, topProducts: [] as { name: string; sales: number }[] };
      if (!currentShop) return empty;

      const [salesRes, expRes] = await Promise.all([
          supabase.from(DB_CONSTANTS.TABLE_SALES).select('*')
              .eq('shop_id', currentShop.id).gte('timestamp', start).lte('timestamp', end),
          supabase.from(DB_CONSTANTS.TABLE_EXPENSES).select('amount, date')
              .eq('shop_id', currentShop.id).gte('date', start).lte('date', end)
      ]);

      const completed = (salesRes.data || []).filter((s: any) => s.order_status === 'completed');
      let revenue = 0, tax = 0, discount = 0;
      const productSales: Record<string, number> = {};

      completed.forEach((s: any) => {
          revenue += Number(s.total) || 0;
          tax += Number(s.tax) || 0;
          const items = typeof s.items === 'string' ? JSON.parse(s.items) : (s.items || []);
          items.forEach((it: any) => {
              discount += (it.appliedDiscount?.amountSaved || 0) * (it.quantity || 1);
              if (it.name) productSales[it.name] = (productSales[it.name] || 0) + (it.quantity || 1);
          });
      });

      const expenses = (expRes.data || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      const topProducts = Object.entries(productSales)
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([name, sales]) => ({ name, sales }));

      return { revenue, expenses, transactions: completed.length, tax, discount, topProducts };
  };
  
  const addDiscountRule = async (rule: Partial<DiscountRule>) => {
      if (!currentShop) return;
      const newRuleId = generateId();
      const dbRule = {
          id: newRuleId,
          shop_id: currentShop.id,
          name: rule.name,
          type: rule.type,
          value: rule.value,
          conditions: rule.conditions,
          active: true
      };
      
      const { error } = await supabase.from(DB_CONSTANTS.TABLE_DISCOUNTS).insert(dbRule);
      if (!error) {
          setDiscountRules(prev => [...prev, { ...rule, id: newRuleId, shopId: currentShop.id, active: true } as DiscountRule]);
      } else {
          console.error("Error adding discount:", error);
      }
  };

  const deleteDiscountRule = async (id: string) => {
      await supabase.from(DB_CONSTANTS.TABLE_DISCOUNTS).delete().eq('id', id);
      setDiscountRules(prev => prev.filter(r => r.id !== id));
  };

  const addPaymentMethod = async (pm: Partial<PaymentMethod>) => {
      if (!currentShop) return;
      const id = generateId();
      const dbPm = {
          id,
          shop_id: currentShop.id,
          name: pm.name,
          account_name: pm.accountName,
          account_number: pm.accountNumber,
          qr_code_url: pm.qrCodeUrl,
          active: true
      };
      await supabase.from(DB_CONSTANTS.TABLE_PAYMENT_METHODS).insert(dbPm);
      setPaymentMethods(prev => [...prev, { ...pm, id, shopId: currentShop.id, active: true } as PaymentMethod]);
  };

  const updatePaymentMethod = async (id: string, updates: Partial<PaymentMethod>) => {
      const dbUpdates: any = {};
      if(updates.name) dbUpdates.name = updates.name;
      if(updates.accountName) dbUpdates.account_name = updates.accountName;
      if(updates.accountNumber) dbUpdates.account_number = updates.accountNumber;
      if(updates.qrCodeUrl) dbUpdates.qr_code_url = updates.qrCodeUrl;
      if(updates.active !== undefined) dbUpdates.active = updates.active;

      await supabase.from(DB_CONSTANTS.TABLE_PAYMENT_METHODS).update(dbUpdates).eq('id', id);
      setPaymentMethods(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePaymentMethod = async (id: string) => {
      await supabase.from(DB_CONSTANTS.TABLE_PAYMENT_METHODS).delete().eq('id', id);
      setPaymentMethods(prev => prev.filter(p => p.id !== id));
  };

  const connectPrinter = async () => { const res = await printer.connect(); setPrinterConnected(res); return res; };
  const printReceipt = async (s: Sale) => { if (currentShop) await printer.printReceipt(s, currentShop); };
  
  const startTableSession = async (tid: string) => { updateTable(tid, { status: 'occupied', allowOrdering: true }); };
  /**
   * Close out a dine-in order: record the payment method, mark the sale
   * 'completed' (it now counts as revenue), decrement stock for its items,
   * then free the table. Previously this only freed the table, so restaurant
   * sales never completed and never appeared in the dashboard.
   */
  const finishTableOrder = async (sid: string, tid: string, paymentMethod: string = 'cash') => {
      const sale = sales.find(s => s.id === sid);
      if (sale && sale.orderStatus !== 'completed' && sale.orderStatus !== 'cancelled') {
          applyStockDecrement(sale.items);
          setSales(prev => prev.map(s => s.id === sid ? { ...s, orderStatus: 'completed', paymentMethod } : s));
          await dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'update', payload: { order_status: 'completed', payment_method: paymentMethod }, match: { id: sid } });
          broadcastTableUpdate(tid);
      }
      updateTable(tid, { status: 'available', allowOrdering: false });
  };
  const confirmOrderItems = async (sid: string) => {
      const sale = sales.find(s => s.id === sid);
      if (!sale) return;
      // Send all not-yet-confirmed items to the kitchen.
      const updatedItems = sale.items.map(it =>
          (!it.status || it.status === 'pending') ? { ...it, status: 'confirmed' as OrderItemStatus } : it
      );
      setSales(prev => prev.map(s => s.id === sid ? { ...s, items: updatedItems, orderStatus: 'confirmed' } : s));
      await dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'update', payload: { items: updatedItems, order_status: 'confirmed' }, match: { id: sid } });
  };

  const updateOrderItemStatus = async (sid: string, iid: string, st: OrderItemStatus) => {
      const sale = sales.find(s => s.id === sid);
      if (!sale) return;
      const updatedItems = sale.items.map(it =>
          it.orderItemId === iid ? { ...it, status: st, served: st === 'served' } : it
      );
      setSales(prev => prev.map(s => s.id === sid ? { ...s, items: updatedItems } : s));
      await dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'update', payload: { items: updatedItems }, match: { id: sid } });
  };

  const removeItemFromOrder = async (sid: string, iid: string) => {
      const sale = sales.find(s => s.id === sid);
      if (!sale) return;
      const updatedItems = sale.items.filter(it => it.orderItemId !== iid);
      const subtotal = updatedItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
      const tax = subtotal * (settings.taxRate / 100);
      const total = subtotal + tax;
      setSales(prev => prev.map(s => s.id === sid ? { ...s, items: updatedItems, subtotal, tax, total } : s));
      await dbWrite({ table: DB_CONSTANTS.TABLE_SALES, action: 'update', payload: { items: updatedItems, subtotal, tax, total }, match: { id: sid } });
  };

  const categories = useMemo(() => {
      const catsSet = new Set<string>();
      catsSet.add('General');
      products.forEach(p => {
          if (p.category) {
              catsSet.add(p.category);
          }
      });
      return Array.from(catsSet).sort();
  }, [products]);

  return (
    <StoreContext.Provider value={{
      user, loadingAuth, currentShop, settings, language, setLanguage, t,
      createShop, updateShop, updateSettings,
      signInWithGoogle, signInAsDemoUser, signOut,
      staffList, activeStaff, loginAsStaff, switchStaff, activateStaffAsOwner, logoutStaff, addStaff, updateStaff, deleteStaff,
      products, categories, addProduct, updateProduct, getProductActivities, fetchMoreActivities, hasMoreActivities, renameCategory, deleteCategory,
      cart, addToCart, removeFromCart, updateCartQuantity, clearCart, checkout, addManualSale, getBestDiscountForItem,
      sales, fetchMoreSales, hasMoreSales, verifyOrder, cancelSale, refreshSales, exportSalesData,
      customers, addCustomer, updateCustomer, repayDebt, findOrCreateCustomer,
      tables, bookings, addTable, updateTable, addBooking, startTableSession, finishTableOrder, confirmOrderItems, updateOrderItemStatus, removeItemFromOrder,
      addExpense, getDashboardMetrics,
      discountRules, addDiscountRule, deleteDiscountRule,
      paymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod,
      printerConnected, connectPrinter, printReceipt,
      pendingWrites,
      formatPrice
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};