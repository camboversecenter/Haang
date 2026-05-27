
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { Product, Sale, TableMessage, CartItem, ProductVariant, Customer, Shop, Settings, Table } from '../types';
import { ShoppingCart, X, Plus, Minus, Search, ShoppingBag, Flame, ChevronLeft, CheckCircle, Globe, Ban, Store as StoreIcon, Bell, Receipt, MessageCircle, Send, Lock, UserPlus, Phone, CreditCard, Upload, Loader2, Sparkles, MapPin, Trash2, Clock, ChefHat, History, FileText, User, ChevronRight, RefreshCw, LogIn, LogOut } from 'lucide-react';
import { Logo } from '../components/Logo';
import QRCode from 'react-qr-code';
import { supabase } from '../services/supabaseClient';
import { useUI } from '../store/UIContext';
import { DB_CONSTANTS } from '../services/supabaseSchema';
import { analyzePaymentProof } from '../services/geminiService';
import { uploadProductImage } from '../services/storageService';
import ReceiptView from './ReceiptView';

// Helper for unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// UI Translations (Reused from existing)
const UI_TEXT: any = {
  en: {
    offline_title: 'Store Currently Offline',
    offline_desc: 'The owner has disabled online ordering at this time. Please try again later.',
    search_placeholder: 'Search items...',
    all: 'All',
    view_cart: 'View Cart',
    total: 'Total',
    your_order: 'Your Order',
    total_amount: 'Total Amount',
    place_order: 'Place Order',
    ordering_disabled: 'Ordering Disabled',
    link_info: 'Contact Information',
    linked_success: 'Linked Successfully',
    name_ph: 'Your Name',
    phone_ph: 'Phone Number (Required)',
    link_btn: 'Save Info',
    order_items: 'Order Items',
    tap_checkbox: 'Tap checkbox to confirm you received the item.',
    list_items: 'List of ordered items.',
    served: 'Served',
    subtotal: 'Subtotal',
    vat: 'VAT',
    service_mode: 'Table Closed',
    service_desc: 'Please ask a staff member to open this table for you.',
    you_are_at: 'You are at',
    table_chat: 'Table Chat',
    support: 'Support',
    no_messages: 'No messages yet.',
    type_message: 'Type a message...',
    popularity: 'Popularity',
    sold: 'sold',
    unavailable: 'Currently Unavailable',
    add_to_cart: 'Add to Cart',
    add_to_order: 'Add to Bill',
    added_to_order: 'Added to Order',
    order_received: 'Order Received!',
    order_sent: 'Your order has been sent to the kitchen.',
    track_status: 'Track Order Status',
    call_staff: 'Call Staff',
    bill: 'Bill',
    payment: 'Payment',
    chat: 'Chat',
    menu: 'Menu',
    my_bill: 'My Bill',
    calling_staff: 'Calling Staff...',
    bill_requested: 'Bill Requested',
    bill_msg: 'Bill Requested',
    payment_methods: 'Payment Methods',
    scan_pay: 'Pay with AI Scan',
    report_payment: 'Upload Payment Proof',
    upload_proof: 'Upload Receipt',
    verifying: 'Verifying...',
    payment_verified: 'Payment Verified',
    payment_pending: 'Payment Pending Verification',
    sold_out: 'Sold Out',
    hot: 'Hot',
    active_order: 'Active Order',
    view_bill: 'View Bill',
    status_pending: 'Pending',
    status_confirmed: 'Cooking',
    status_served: 'Served',
    remove_item: 'Remove',
    activity_log: 'Activity Log',
    log_added: 'Added',
    log_removed: 'Removed',
    log_confirmed: 'Confirmed',
    view_log: 'View Activity Log',
    guest: 'Guest',
    no_active_order: 'No active orders yet.',
    pay_total: 'Pay Total',
    select_payment: 'Select Payment Method',
    upload_success: 'Receipt Uploaded Successfully',
    refresh: 'Refresh Status',
    select_variant: 'Select Option',
    available: 'Available',
    submit_order: 'Submit Order',
    cust_details: 'Customer Details',
    history: 'History',
    login: 'Sign In',
    logout: 'Sign Out',
    hello: 'Hello',
    past_orders: 'Past Orders'
  },
  km: {
    offline_title: 'ហាងនេះកំពុងបិទជាបណ្តោះអាសន្ន',
    offline_desc: 'ម្ចាស់ហាងបានបិទការកម្ម៉ង់តាមអនឡាញ។ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។',
    search_placeholder: 'ស្វែងរកមុខម្ហូប...',
    all: 'ទាំងអស់',
    view_cart: 'មើលកន្ត្រក',
    total: 'សរុប',
    your_order: 'ការកម្ម៉ង់របស់អ្នក',
    total_amount: 'ទឹកប្រាក់សរុប',
    place_order: 'ដាក់ការកម្ម៉ង់',
    ordering_disabled: 'ការកម្ម៉ង់ត្រូវបានបិទ',
    link_info: 'ព័ត៌មានទំនាក់ទំនង',
    linked_success: 'បានភ្ជាប់ជោគជ័យ',
    name_ph: 'ឈ្មោះរបស់អ្នក',
    phone_ph: 'លេខទូរស័ព្ទ (ចាំបាច់)',
    link_btn: 'រក្សាទុក',
    order_items: 'មុខម្ហូបដែលបានកម្ម៉ង់',
    tap_checkbox: 'ចុចប្រអប់ដើម្បីបញ្ជាក់ថាទទួលបានម្ហូប។',
    list_items: 'បញ្ជីមុខម្ហូបដែលបានកម្ម៉ង់',
    served: 'បានទទួល',
    subtotal: 'សរុបបឋម',
    vat: 'ពន្ធ',
    service_mode: 'តុនេះមិនទាន់បើកទេ',
    service_desc: 'សូមហៅបុគ្គលិកដើម្បីបើកតុនេះ។',
    you_are_at: 'អ្នកកំពុងនៅ',
    table_chat: 'ការជជែក',
    support: 'ជំនួយ',
    no_messages: 'មិនទាន់មានសារ។',
    type_message: 'សរសេរសារ...',
    popularity: 'ភាពពេញនិយម',
    sold: 'បានលក់',
    unavailable: 'មិនមាននៅពេលនេះ',
    add_to_cart: 'ដាក់ចូលកន្ត្រក',
    add_to_order: 'កម្ម៉ង់ភ្លាមៗ',
    added_to_order: 'បានបន្ថែមទៅការកម្ម៉ង់',
    order_received: 'ទទួលបានការកម្ម៉ង់!',
    order_sent: 'ទទួលបានការកម្ម៉ង់!',
    track_status: 'តាមដានស្ថានភាព',
    call_staff: 'ហៅបុគ្គលិក',
    bill: 'វិក្កយបត្រ',
    payment: 'បង់ប្រាក់',
    chat: 'ជជែក',
    menu: 'ម៉ឺនុយ',
    my_bill: 'វិក្កយបត្រ',
    calling_staff: 'កំពុងហៅបុគ្គលិក...',
    bill_requested: 'បានស្នើសុំគិតលុយ',
    bill_msg: 'បានស្នើសុំគិតលុយ',
    payment_methods: 'វិធីទូទាត់',
    scan_pay: 'ស្កេនទូទាត់ (AI)',
    report_payment: 'បញ្ចូលវិក្កយបត្រ',
    upload_proof: 'បញ្ចូលវិក្កយបត្រ',
    verifying: 'កំពុងផ្ទៀងផ្ទាត់...',
    payment_verified: 'ការទូទាត់បានផ្ទៀងផ្ទាត់',
    payment_pending: 'រង់ចាំការត្រួតពិនិត្យ',
    sold_out: 'អស់ស្តុក',
    hot: 'ពេញនិយម',
    active_order: 'ការកម្ម៉ង់សកម្ម',
    view_bill: 'មើលវិក្កយបត្រ',
    status_pending: 'រង់ចាំ',
    status_confirmed: 'កំពុងចម្អិន',
    status_served: 'បានទទួល',
    remove_item: 'លុប',
    activity_log: 'ប្រវត្តិកម្ម៉ង់',
    log_added: 'បានបន្ថែម',
    log_removed: 'បានលុប',
    log_confirmed: 'បានបញ្ជាក់',
    view_log: 'មើលប្រវត្តិកម្ម៉ង់',
    guest: 'ភ្ញៀវ',
    no_active_order: 'មិនទាន់មានការកម្ម៉ង់។',
    pay_total: 'ទឹកប្រាក់ត្រូវបង់',
    select_payment: 'ជ្រើសរើសវិធីទូទាត់',
    upload_success: 'បានបញ្ចូលវិក្កយបត្រជោគជ័យ',
    refresh: 'ផ្ទុកទិន្នន័យឡើងវិញ',
    select_variant: 'ជ្រើសរើសជម្រើស',
    available: 'មាន',
    submit_order: 'បញ្ជាក់ការកម្ម៉ង់',
    cust_details: 'ព័ត៌មានអតិថិជន',
    history: 'ប្រវត្តិ',
    login: 'ចូលប្រើ',
    logout: 'ចាកចេញ',
    hello: 'សួស្តី',
    past_orders: 'ប្រវត្តិកម្ម៉ង់មុនៗ'
  }
};

export default function PublicStore() {
  const { language, setLanguage, formatPrice, cart, addToCart, updateCartQuantity, clearCart, findOrCreateCustomer, addManualSale: addManualSaleContext } = useStore();
  const { showToast, showConfirm } = useUI();
  
  // Local State for Public Data (Independent of Context/Auth)
  const [publicShop, setPublicShop] = useState<Shop | null>(null);
  const [publicProducts, setPublicProducts] = useState<Product[]>([]);
  const [publicSettings, setPublicSettings] = useState<Settings | null>(null);
  const [publicTables, setPublicTables] = useState<Table[]>([]);
  const [publicSales, setPublicSales] = useState<Sale[]>([]); // For popularity check
  const [publicPaymentMethods, setPublicPaymentMethods] = useState<any[]>([]);

  const [loadingShop, setLoadingShop] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);

  // UI State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentTableId, setCurrentTableId] = useState<string | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'bill' | 'payment' | 'history'>('menu');
  const [activeTableOrder, setActiveTableOrder] = useState<Sale | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<TableMessage[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  
  // Retail specific state
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Customer Auth State
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [customerDbRecord, setCustomerDbRecord] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<Sale[]>([]);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<Sale | null>(null);

  const t_ui = UI_TEXT[language] || UI_TEXT['en'];

  // 1. Initialize Shop from URL
  useEffect(() => {
    const parseUrl = async () => {
        setLoadingShop(true);
        const hash = window.location.hash; // e.g., #/s/SHOP_ID?tableId=...
        const hashParams = hash.split('?');
        const pathParts = hashParams[0].split('/');
        
        // Extract Shop ID
        let sId: string | null = null;
        if (pathParts.includes('s') && pathParts[pathParts.indexOf('s') + 1]) {
            sId = pathParts[pathParts.indexOf('s') + 1];
        }

        // Extract Query Params
        let tId: string | null = null;
        if (hashParams[1]) {
            const params = new URLSearchParams(hashParams[1]);
            tId = params.get('tableId');
        } else {
            // Check standard search params fallback
            const params = new URLSearchParams(window.location.search);
            if (params.get('tableId')) tId = params.get('tableId');
        }

        if (sId) {
            setShopId(sId);
            if (tId) setCurrentTableId(tId);
            await loadPublicData(sId);
        } else {
            setLoadingShop(false);
        }
    };
    parseUrl();
  }, []);

  // 2. Fetch Data Independently
  const loadPublicData = async (sId: string) => {
      try {
          // Fetch Shop
          const { data: shop } = await supabase.from(DB_CONSTANTS.TABLE_SHOPS).select('*').eq('id', sId).single();
          if (shop) {
              setPublicShop({ id: shop.id, name: shop.name, type: shop.type, logoUrl: shop.logo_url, address: shop.address, phone: shop.phone, ownerId: shop.owner_id });
          }

          // Fetch Settings
          const { data: setts } = await supabase.from(DB_CONSTANTS.TABLE_SETTINGS).select('*').eq('shop_id', sId).single();
          if (setts) {
              setPublicSettings({
                  taxRate: Number(setts.tax_rate),
                  currency: setts.currency,
                  exchangeRate: Number(setts.exchange_rate),
                  enablePublicStore: setts.enable_public_store,
                  enableBooking: setts.enable_booking,
                  enableAttributes: setts.enable_attributes,
                  enableMultiRoles: setts.enable_multi_roles,
                  defaultLanguage: setts.default_language || 'km'
              });
              if (setts.default_language) setLanguage(setts.default_language);
          }

          // Fetch Products
          const { data: prods } = await supabase.from(DB_CONSTANTS.TABLE_PRODUCTS).select('*').eq('shop_id', sId);
          if (prods) {
              setPublicProducts(prods.map((p: any) => ({ ...p, shopId: p.shop_id, imageUrl: p.image_url, trackStock: p.track_stock })));
          }

          // Fetch Tables (for validation)
          const { data: tabs } = await supabase.from(DB_CONSTANTS.TABLE_TABLES).select('*').eq('shop_id', sId);
          if (tabs) {
              setPublicTables(tabs.map((t: any) => ({ id: t.id, shopId: t.shop_id, name: t.name, capacity: t.capacity, status: t.status, allowOrdering: t.allow_ordering })));
          }

          // Fetch Payment Methods
          const { data: pms } = await supabase.from(DB_CONSTANTS.TABLE_PAYMENT_METHODS).select('*').eq('shop_id', sId).eq('active', true);
          if (pms) {
              setPublicPaymentMethods(pms.map((p: any) => ({ id: p.id, shopId: p.shop_id, name: p.name, accountName: p.account_name, accountNumber: p.account_number, qrCodeUrl: p.qr_code_url, active: p.active })));
          }

          // Fetch simplified sales for popularity (optional optimization: RPC call)
          const { data: salesHistory } = await supabase.from('sales').select('items').eq('shop_id', sId).limit(100);
          if (salesHistory) {
              // Just map minimal needed
              setPublicSales(salesHistory.map((s:any) => ({ items: typeof s.items === 'string' ? JSON.parse(s.items) : s.items } as Sale)));
          }

      } catch (err) {
          console.error("Public Load Error", err);
      } finally {
          setLoadingShop(false);
      }
  };

  // 3. Auth Listener for Customers
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
            setCustomerUser(data.user);
            fetchLinkedCustomer(data.user.email);
        }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
            setCustomerUser(session.user);
            fetchLinkedCustomer(session.user.email);
        } else {
            setCustomerUser(null);
            setCustomerDbRecord(null);
            setCustomerHistory([]);
        }
    });

    return () => authListener.subscription.unsubscribe();
  }, [shopId]);

  const fetchLinkedCustomer = async (email?: string) => {
      if (!email || !shopId) return;
      const { data } = await supabase.from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .eq('email', email)
        .single();
      
      if (data) {
          setCustomerDbRecord({
              id: data.id,
              shopId: data.shop_id,
              name: data.name,
              phone: data.phone,
              email: data.email,
              totalDebt: data.total_debt,
              lastInteraction: 0
          });
          fetchCustomerHistory(data.id);
      }
  };

  const fetchCustomerHistory = async (customerId: string) => {
      if (!shopId) return;
      const { data } = await supabase.from('sales')
        .select('*')
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .order('timestamp', { ascending: false });
      
      if (data) {
          const mappedSales: Sale[] = data.map((s: any) => ({
              id: s.id,
              shopId: s.shop_id,
              timestamp: s.timestamp,
              total: Number(s.total),
              subtotal: Number(s.subtotal),
              tax: Number(s.tax),
              paymentMethod: s.payment_method,
              orderStatus: s.order_status,
              items: typeof s.items === 'string' ? JSON.parse(s.items) : s.items,
              currency: s.currency,
              exchangeRate: Number(s.exchange_rate),
              customerId: s.customer_id,
              paymentProofUrl: s.payment_proof_url
          }));
          setCustomerHistory(mappedSales);
      }
  };

  const handleCustomerLogin = async () => {
      await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.href }
      });
  };

  const handleCustomerLogout = async () => {
      await supabase.auth.signOut();
      window.location.reload();
  };

  const handleHistoryProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0] || !selectedHistoryOrder) return;
      const file = e.target.files[0];
      setVerifyingPayment(true);
      try {
           const publicUrl = await uploadProductImage(file, 'Haang');
           if (publicUrl) {
               await supabase.from(DB_CONSTANTS.TABLE_SALES)
                 .update({ payment_proof_url: publicUrl, order_status: 'pending_verification' })
                 .eq('id', selectedHistoryOrder.id);
               
               setCustomerHistory(prev => prev.map(s => s.id === selectedHistoryOrder.id ? { ...s, paymentProofUrl: publicUrl, orderStatus: 'pending_verification' } : s));
               setSelectedHistoryOrder(prev => prev ? { ...prev, paymentProofUrl: publicUrl, orderStatus: 'pending_verification' } : null);
               
               showToast(t_ui.upload_success, 'success');
           }
      } catch (err) {
          showToast("Error uploading proof", "error");
      } finally {
          setVerifyingPayment(false);
      }
  };

  // Active Order Management
  const fetchActiveOrder = async () => {
      if (!currentTableId || !shopId) return;
      setIsRefreshing(true);
      
      const { data } = await supabase
        .from(DB_CONSTANTS.TABLE_SALES)
        .select('*') 
        .eq('shop_id', shopId)
        .eq('table_id', currentTableId)
        .in('order_status', ['pending', 'pending_verification', 'confirmed'])
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle(); 
      
      if (data) {
          updateLocalOrder(data);
      } else {
          setActiveTableOrder(null);
      }
      setIsRefreshing(false);
  };

  // Re-fetch on focus
  useEffect(() => {
      const onFocus = () => { if (currentTableId) fetchActiveOrder(); };
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
  }, [currentTableId]);

  // Realtime for specific shop table
  useEffect(() => {
      if (currentTableId && shopId) {
          fetchActiveOrder();

          const channel = supabase
            .channel(`public_order:${currentTableId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'sales', 
                filter: `table_id=eq.${currentTableId}` 
            }, async (payload) => {
                const data = payload.new as any;
                if (payload.eventType === 'DELETE' || (data && (data.order_status === 'completed' || data.order_status === 'cancelled'))) {
                    setActiveTableOrder(null); setPaymentProofUrl(null); setCustName(''); setCustPhone('');
                } else if (data && ['pending', 'pending_verification', 'confirmed'].includes(data.order_status)) {
                     updateLocalOrder(data);
                }
            })
            .on('broadcast', { event: 'table_update' }, ({ payload }) => {
                if (payload.tableId === currentTableId) {
                    fetchActiveOrder();
                }
            })
            .subscribe();

          return () => { supabase.removeChannel(channel); };
      }
  }, [currentTableId, shopId]);

  const updateLocalOrder = async (data: any) => {
      const parsedItems = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
      const sale: Sale = {
          id: data.id,
          shopId: data.shop_id,
          timestamp: data.timestamp,
          total: data.total,
          subtotal: data.subtotal,
          tax: data.tax,
          paymentMethod: data.payment_method,
          orderStatus: data.order_status,
          items: parsedItems || [],
          currency: data.currency,
          exchangeRate: data.exchange_rate,
          customerId: data.customer_id,
          tableId: data.table_id,
          paymentProofUrl: data.payment_proof_url
      };
      
      setActiveTableOrder(sale);
      if(data.payment_proof_url) setPaymentProofUrl(data.payment_proof_url);
      
      if (data.customer_id) {
           const { data: cData } = await supabase.from('customers').select('name, phone').eq('id', data.customer_id).single();
           if (cData) { setCustName(cData.name); setCustPhone(cData.phone || ''); }
      }
  };

  const sendLocalTableMessage = async (tableId: string, message: string, type: 'text' | 'alert_call' | 'alert_bill' | 'log') => {
      if (!shopId) return;
      await supabase.from(DB_CONSTANTS.TABLE_MESSAGES).insert({
          shop_id: shopId,
          table_id: tableId,
          sender: 'customer',
          message,
          type,
          created_at: Date.now()
      });
  };

  const handleDirectAdd = async (product: Product, variant?: any) => {
      if (!shopId) return;
      let currentOrder = activeTableOrder;

      // Create new order if none exists
      if (!currentOrder && currentTableId) {
          const newSaleId = generateId();
          const newSale: Sale = {
              id: newSaleId,
              shopId: shopId,
              timestamp: Date.now(),
              total: 0,
              subtotal: 0,
              tax: 0,
              paymentMethod: 'online_pending',
              orderStatus: 'pending',
              items: [],
              currency: publicSettings?.currency || 'KHR',
              exchangeRate: publicSettings?.exchangeRate || 4000,
              tableId: currentTableId
          };
          setActiveTableOrder(newSale);
          currentOrder = newSale;
          
          await supabase.from(DB_CONSTANTS.TABLE_SALES).insert({
              id: newSale.id,
              shop_id: newSale.shopId,
              timestamp: newSale.timestamp,
              total: 0,
              subtotal: 0,
              tax: 0,
              payment_method: 'online_pending',
              order_status: 'pending',
              items: [],
              currency: newSale.currency,
              exchange_rate: newSale.exchangeRate,
              table_id: currentTableId
          });
      }

      if (!currentOrder) return;

      const newItem: CartItem = {
          ...product,
          price: variant ? variant.price : product.price,
          stock: variant ? variant.stock : product.stock,
          quantity: 1,
          variantId: variant?.id,
          variantName: variant?.options?.join(', '),
          orderItemId: generateId(),
          status: 'pending',
          served: false
      };

      const currentItems = currentOrder.items ? [...currentOrder.items] : [];
      const existingIdx = currentItems.findIndex(i => i.id === newItem.id && i.variantId === newItem.variantId && i.status === 'pending');

      if (existingIdx > -1) {
          currentItems[existingIdx] = { ...currentItems[existingIdx], quantity: currentItems[existingIdx].quantity + 1 };
      } else {
          currentItems.push(newItem);
      }

      const taxRate = publicSettings?.taxRate || 0;
      const newSubtotal = currentItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const newTax = newSubtotal * (taxRate / 100);
      const newTotal = newSubtotal + newTax;

      const updatedOrder = { ...currentOrder, items: currentItems, subtotal: newSubtotal, tax: newTax, total: newTotal };
      setActiveTableOrder(updatedOrder);
      showToast(`${t_ui.added_to_order}: ${product.name}`, "success");
      setSelectedProduct(null);

      const { error } = await supabase.from(DB_CONSTANTS.TABLE_SALES).update({ items: currentItems, subtotal: newSubtotal, tax: newTax, total: newTotal }).eq('id', currentOrder.id);

      if (error) {
          showToast("Failed to save item", "error");
          fetchActiveOrder();
      } else {
          sendLocalTableMessage(currentTableId!, `[ITEM_ADDED] +1 ${newItem.name}`, 'log');
          // Broadcast update
          const channel = supabase.channel(`public_order:${currentTableId}`);
          channel.send({ type: 'broadcast', event: 'table_update', payload: { tableId: currentTableId } });
      }
  };

  const handleUploadPaymentProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0] || !activeTableOrder) return;
      const file = e.target.files[0];
      setVerifyingPayment(true);
      try {
          const analysis = await analyzePaymentProof(file);
          let statusMessage = "Receipt Uploaded";
          if (analysis.amount > 0) {
              const expectedTotal = activeTableOrder.total;
              if (Math.abs(analysis.amount - expectedTotal) < 500) { 
                  statusMessage = `AI Verified: ${formatPrice(analysis.amount)}`;
                  showToast(statusMessage, "success");
              } else {
                  statusMessage = `Amount Mismatch: Detected ${formatPrice(analysis.amount)}`;
                  showToast(statusMessage, "info");
              }
          }
          const publicUrl = await uploadProductImage(file, 'Haang');
          if (publicUrl) {
              await supabase.from(DB_CONSTANTS.TABLE_SALES).update({ payment_proof_url: publicUrl, order_status: 'pending_verification' }).eq('id', activeTableOrder.id);
              setPaymentProofUrl(publicUrl);
              if (currentTableId) {
                  sendLocalTableMessage(currentTableId!, `Payment Reported via AI. ${statusMessage}`, 'alert_bill');
                  // Notify staff
                  const channel = supabase.channel(`public_order:${currentTableId}`);
                  channel.send({ type: 'broadcast', event: 'table_update', payload: { tableId: currentTableId } });
              }
              showToast(t_ui.upload_success, 'success');
          }
      } catch (err) { console.error(err); showToast("Error processing receipt", "error"); } finally { setVerifyingPayment(false); }
  };

  const handleRetailCheckout = async () => {
      if (!custName || !custPhone) {
          showToast("Please enter Name and Phone", "error");
          return;
      }
      if (!shopId) return;
      setSubmittingOrder(true);

      try {
          // Find or create customer manually using public access
          let custId = '';
          const { data: existingCust } = await supabase.from('customers').select('id').eq('shop_id', shopId).eq('phone', custPhone).single();
          
          if (existingCust) {
              custId = existingCust.id;
          } else {
              const newId = generateId();
              await supabase.from('customers').insert({
                  id: newId, shop_id: shopId, name: custName, phone: custPhone, email: customerUser?.email, total_debt: 0
              });
              custId = newId;
          }

          const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const taxRate = publicSettings?.taxRate || 0;
          const tax = cartTotal * (taxRate / 100);
          const newSale: Sale = {
              id: generateId(),
              shopId: shopId,
              timestamp: Date.now(),
              total: cartTotal + tax,
              subtotal: cartTotal,
              tax: tax,
              paymentMethod: 'online_pending',
              orderStatus: 'pending_verification',
              items: cart.map(i => ({...i, status: 'pending'})),
              currency: publicSettings?.currency || 'KHR',
              exchangeRate: publicSettings?.exchangeRate || 4000,
              customerId: custId,
          };

          // Use Context util if safe, OR manual insert
          // We'll manual insert to avoid context currentShop dependency
          await supabase.from(DB_CONSTANTS.TABLE_SALES).insert({
              id: newSale.id,
              shop_id: newSale.shopId,
              timestamp: newSale.timestamp,
              total: newSale.total,
              subtotal: newSale.subtotal,
              tax: newSale.tax,
              payment_method: newSale.paymentMethod,
              order_status: newSale.orderStatus,
              items: newSale.items,
              currency: newSale.currency,
              exchange_rate: newSale.exchangeRate,
              customer_id: newSale.customerId
          });
          
          setActiveTableOrder(newSale);
          clearCart();
          setShowCart(false);
          setShowCustomerForm(false);
          setActiveTab('payment');
          showToast("Order Placed! Please upload receipt.", "success");

      } catch (error) {
          console.error(error);
          showToast("Order Failed. Try again.", "error");
      } finally {
          setSubmittingOrder(false);
      }
  };

  const handleLinkCustomer = async () => { 
      if (activeTableOrder && custName && shopId) { 
          // Find/Create
          let custId = '';
          const { data: existingCust } = await supabase.from('customers').select('id').eq('shop_id', shopId).eq('phone', custPhone).single();
          if (existingCust) custId = existingCust.id;
          else {
              const newId = generateId();
              await supabase.from('customers').insert({ id: newId, shop_id: shopId, name: custName, phone: custPhone, total_debt: 0 });
              custId = newId;
          }

          await supabase.from(DB_CONSTANTS.TABLE_SALES).update({ customer_id: custId }).eq('id', activeTableOrder.id);
          setIsEditingInfo(false); 
          showToast(t_ui.linked_success, "success"); 
          fetchActiveOrder();
      } 
  };

  const handleDeleteItem = async (itemId: string) => { 
      if (activeTableOrder) { 
          const confirm = await showConfirm(t_ui.remove_item, "Are you sure?"); 
          if (confirm) { 
              const newItems = activeTableOrder.items.filter(i => i.orderItemId !== itemId);
              const newSub = newItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
              const newTax = newSub * ((publicSettings?.taxRate || 0) / 100);
              const newTot = newSub + newTax;
              
              await supabase.from(DB_CONSTANTS.TABLE_SALES).update({ items: newItems, subtotal: newSub, tax: newTax, total: newTot }).eq('id', activeTableOrder.id);
              fetchActiveOrder();
              showToast("Item removed", "success"); 
          } 
      } 
  };

  const handleCallStaff = async () => { if (currentTableId && !sendingMsg) { setSendingMsg(true); await sendLocalTableMessage(currentTableId, "Calling Staff", 'alert_call'); showToast(t_ui.calling_staff, 'success'); setSendingMsg(false); } };
  const handleRequestBill = async () => { if (currentTableId && !sendingMsg) { setSendingMsg(true); await sendLocalTableMessage(currentTableId, "Requesting Bill", 'alert_bill'); showToast(t_ui.bill_requested, 'success'); setSendingMsg(false); } };

  // Render Logic
  if (loadingShop) return <div className="flex h-screen items-center justify-center text-brand-600"><Loader2 className="animate-spin" /></div>;
  if (!publicShop) return <div className="flex h-screen items-center justify-center">Shop Not Found</div>;
  
  if (publicSettings && !publicSettings.enablePublicStore) return <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center"><div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-400"><StoreIcon size={48} /></div><h1 className={`text-2xl font-bold text-gray-800 mb-2 ${language === 'km' ? 'font-display' : ''}`}>{t_ui.offline_title}</h1><p className="text-gray-500 max-w-xs">{t_ui.offline_desc}</p></div>;

  const assignedTable = publicTables.find(t => t.id === currentTableId);
  const isTableContext = !!currentTableId;
  const isRestaurant = publicShop.type === 'restaurant';
  const orderingEnabled = isRestaurant && isTableContext ? (assignedTable?.allowOrdering) : true;

  if (assignedTable && !orderingEnabled) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-400 animate-pulse"><Ban size={48} /></div>
            <h1 className={`text-2xl font-bold text-gray-800 mb-2 ${language === 'km' ? 'font-display' : ''}`}>{t_ui.service_mode}</h1>
            <p className="text-gray-500 max-w-xs mb-8 leading-relaxed">{t_ui.service_desc}</p>
            <button onClick={fetchActiveOrder} disabled={isRefreshing} className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"><RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /><span>{t_ui.refresh}</span></button>
        </div>
      );
  }

  // Helper stats
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  const getProductPopularity = (productId: string) => {
      let count = 0;
      publicSales.forEach(s => { const item = s.items.find(i => i.id === productId); if (item) count += item.quantity; });
      return count;
  };

  const filteredProducts = publicProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === t_ui.all || p.category === activeCategory;
      return matchesSearch && matchesCategory;
  });
  const categories = [t_ui.all, ...Array.from(new Set(publicProducts.map(p => p.category)))];

  const getStatusBadge = (status?: string) => {
      switch(status) {
          case 'served': return <div className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-md font-bold"><CheckCircle size={10} /> {t_ui.status_served}</div>;
          case 'confirmed': return <div className="flex items-center gap-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-bold"><ChefHat size={10} /> {t_ui.status_confirmed}</div>;
          case 'pending': default: return <div className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md font-bold animate-pulse"><Clock size={10} /> {t_ui.status_pending}</div>;
      }
  };

  const orderLogs = chatMessages.filter(m => m.type === 'log');

  // --- RENDER (Using public* state variables) ---
  return (
    <div className="min-h-screen bg-slate-50 pb-28">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Logo className="w-8 h-8" textClassName="text-lg" />
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                    <div className="flex flex-col">
                        <span className={`font-bold text-gray-700 truncate max-w-[100px] leading-tight ${language === 'km' ? 'font-display' : ''}`}>{publicShop.name}</span>
                        {isTableContext && (
                            <span className="text-[10px] text-brand-600 font-bold bg-brand-50 px-1.5 rounded w-fit">
                                Table: {assignedTable ? assignedTable.name : '...'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setLanguage(language === 'en' ? 'km' : 'en')} className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-full">
                        <Globe size={14} className="text-gray-500" />
                        <span className="text-xs font-bold text-gray-600">{language.toUpperCase()}</span>
                    </button>
                    {/* Public Login */}
                    {customerUser ? (
                        <div className="flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-full border border-brand-100" onClick={handleCustomerLogout}>
                            <User size={14} className="text-brand-600" />
                            <span className="text-xs font-bold text-brand-700 max-w-[60px] truncate">{customerDbRecord?.name || 'User'}</span>
                        </div>
                    ) : (
                        <button onClick={handleCustomerLogin} className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-full shadow-sm">
                            <LogIn size={14} />
                            <span className="text-xs font-bold">{t_ui.login}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* View Switcher */}
            <div className="px-4 pb-2">
                <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('menu')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap px-2 ${activeTab === 'menu' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'}`}>{t_ui.menu}</button>
                    {(isRestaurant && isTableContext) && <button onClick={() => setActiveTab('bill')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap px-2 ${activeTab === 'bill' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'}`}>{t_ui.bill}</button>}
                    {(isRestaurant && isTableContext) && <button onClick={() => setActiveTab('payment')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap px-2 ${activeTab === 'payment' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'}`}>{t_ui.payment}</button>}
                    
                    {/* History Tab (Only if logged in) */}
                    {customerUser && (
                        <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap px-2 ${activeTab === 'history' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'}`}>{t_ui.history}</button>
                    )}
                </div>
            </div>

            {/* F&B Functions (Only on Menu) */}
            {isRestaurant && isTableContext && activeTab === 'menu' && orderingEnabled && (
                <div className="px-4 pb-4 mt-2">
                    <div className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                        <button onClick={handleCallStaff} disabled={sendingMsg} className="flex-1 py-2 flex flex-col items-center justify-center gap-1 bg-white rounded-lg shadow-sm border border-orange-100 active:scale-95 transition-transform disabled:opacity-50"><Bell size={18} className="text-orange-500" /><span className="text-[10px] font-bold text-orange-600">{t_ui.call_staff}</span></button>
                        <button onClick={handleRequestBill} disabled={sendingMsg} className="flex-1 py-2 flex flex-col items-center justify-center gap-1 bg-white rounded-lg shadow-sm border border-green-100 active:scale-95 transition-transform disabled:opacity-50"><Receipt size={18} className="text-green-500" /><span className="text-[10px] font-bold text-green-600">{t_ui.bill}</span></button>
                        <button onClick={() => setShowChat(true)} className="flex-1 py-2 flex flex-col items-center justify-center gap-1 bg-white rounded-lg shadow-sm border border-blue-100 active:scale-95 transition-transform"><MessageCircle size={18} className="text-blue-500" /><span className="text-[10px] font-bold text-blue-600">{t_ui.chat}</span></button>
                    </div>
                </div>
            )}

            {/* Search (Only on Menu) */}
            {orderingEnabled && activeTab === 'menu' && (
                <div className="px-4 pb-4 space-y-3 mt-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t_ui.search_placeholder} className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-brand-500 transition-all outline-none" />
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'bg-white text-gray-500 border border-gray-100'}`}>{cat}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Menu Grid */}
        {activeTab === 'menu' && orderingEnabled && (
            <div className="p-4 grid grid-cols-2 gap-3">
                {filteredProducts.map(product => {
                    const isTracked = product.trackStock !== false;
                    const isOutOfStock = isTracked && (product.stock ?? 0) <= 0;
                    return (
                        <div key={product.id} onClick={() => { setSelectedProduct(product); }} className="bg-white p-2 rounded-2xl shadow-sm border border-gray-50 active:scale-[0.98] transition-transform relative">
                            <div className="aspect-square bg-gray-100 rounded-xl mb-3 overflow-hidden relative">
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                                {isOutOfStock && <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center"><span className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg transform -rotate-12">{t_ui.sold_out}</span></div>}
                                {getProductPopularity(product.id) > 5 && !isOutOfStock && <div className="absolute top-1 left-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm z-20"><Flame size={8} fill="currentColor" />{t_ui.hot}</div>}
                            </div>
                            <div>
                                <h3 className={`font-bold text-gray-800 text-sm leading-tight line-clamp-2 min-h-[2.5em] ${language === 'km' ? 'font-display' : ''} ${isOutOfStock ? 'text-gray-400' : ''}`}>{product.name}</h3>
                                <div className="flex justify-between items-end mt-2">
                                    <span className={`font-extrabold ${isOutOfStock ? 'text-gray-300' : 'text-brand-700'}`}>{formatPrice(product.price)}</span>
                                    
                                    {!isOutOfStock && (
                                        <div 
                                            className="w-7 h-7 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 active:scale-90 transition-transform"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (product.variants && product.variants.length > 0) {
                                                    setSelectedProduct(product);
                                                } else if (isRestaurant) {
                                                    handleDirectAdd(product);
                                                } else {
                                                    addToCart(product);
                                                }
                                            }}
                                        >
                                            <Plus size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Bill Tab */}
        {activeTab === 'bill' && (
            <div className="p-4 space-y-4">
                {!activeTableOrder ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <ShoppingBag size={48} className="mb-4 text-gray-200" />
                        <p className="font-bold">{t_ui.no_active_order}</p>
                        <button onClick={() => setActiveTab('menu')} className="mt-4 text-brand-600 font-bold text-sm">
                            {t_ui.menu}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Status Banner */}
                        {activeTableOrder.orderStatus === 'pending_verification' && (
                            <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                                <Loader2 className="animate-spin text-orange-500" />
                                <div>
                                    <h4 className="font-bold text-orange-700">{t_ui.payment_pending}</h4>
                                    <p className="text-xs text-orange-600">Please wait for staff confirmation.</p>
                                </div>
                            </div>
                        )}

                        {/* Customer Link Info */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-brand-100 overflow-hidden">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><User size={18} className="text-brand-500" /> {t_ui.link_info}</h3>
                                {activeTableOrder.customerId && !isEditingInfo ? (
                                    <button onClick={() => setIsEditingInfo(true)} className="text-xs text-brand-600 font-bold bg-brand-50 px-2 py-1 rounded-lg">Edit</button>
                                ) : null}
                            </div>
                            
                            {activeTableOrder.customerId && !isEditingInfo ? (
                                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-sm">
                                        {custName.substring(0,2).toUpperCase() || <User size={16}/>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{custName}</p>
                                        <p className="text-xs text-gray-500">{custPhone || 'No Phone'}</p>
                                    </div>
                                    <div className="ml-auto">
                                        <CheckCircle size={18} className="text-green-500" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 animate-in fade-in">
                                    <div className="space-y-2">
                                        <input 
                                            placeholder={t_ui.name_ph} 
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 transition-all" 
                                            value={custName} 
                                            onChange={e => setCustName(e.target.value)} 
                                        />
                                        <input 
                                            placeholder={t_ui.phone_ph} 
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 transition-all" 
                                            value={custPhone} 
                                            onChange={e => setCustPhone(e.target.value)} 
                                            type="tel"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleLinkCustomer} 
                                        disabled={!custName}
                                        className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                                    >
                                        {t_ui.link_btn}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Order List */}
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-gray-800">{t_ui.order_items}</h3>
                                <span className="text-[10px] text-gray-400 font-medium">{activeTableOrder.items.length} items</span>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {activeTableOrder.items.map((item, idx) => (
                                    <div key={item.orderItemId || idx} className="p-4 flex items-start gap-4">
                                        {(!item.status || item.status === 'pending') ? (
                                            <button 
                                                onClick={() => handleDeleteItem(item.orderItemId || '')}
                                                className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 active:scale-95 transition-colors self-center"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        ) : (
                                            <div className="w-8 h-8 flex items-center justify-center self-center text-gray-300"><Lock size={16} /></div>
                                        )}
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className={`font-bold text-sm text-gray-800`}>{item.quantity}x {item.name}</span>
                                                    {item.variantName && <p className="text-xs text-gray-400">{item.variantName}</p>}
                                                    <div className="mt-1">
                                                        {getStatusBadge(item.status)}
                                                    </div>
                                                </div>
                                                <span className="font-bold text-gray-600 text-sm">{formatPrice(item.price * item.quantity)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="bg-white rounded-2xl p-6 shadow-card space-y-3">
                            <div className="flex justify-between text-sm text-gray-500"><span>{t_ui.subtotal}</span><span>{formatPrice(activeTableOrder.subtotal || 0)}</span></div>
                            <div className="flex justify-between text-sm text-gray-500"><span>{t_ui.vat} ({publicSettings?.taxRate || 0}%)</span><span>{formatPrice(activeTableOrder.tax || 0)}</span></div>
                            <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between text-lg font-black text-gray-900"><span>{t_ui.total}</span><span>{formatPrice(activeTableOrder.total || 0)}</span></div>
                        </div>

                        {/* Order Logs Section */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><History size={16}/> {t_ui.activity_log}</h3>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-4 pr-1">
                                {orderLogs.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No activity yet.</p>}
                                {orderLogs.map(log => (
                                    <div key={log.id} className="flex gap-3 text-xs">
                                        <div className="flex flex-col items-center">
                                            <div className="w-2 h-2 rounded-full bg-brand-300 mb-1"></div>
                                            <div className="w-px h-full bg-brand-100"></div>
                                        </div>
                                        <div className="pb-2 flex-1">
                                            <p className="text-gray-700 font-medium">{log.message}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(log.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
            <div className="p-4 space-y-6">
                {!activeTableOrder ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <ShoppingBag size={48} className="mb-4 text-gray-200" />
                        <p className="font-bold">{t_ui.no_active_order}</p>
                        <button onClick={() => setActiveTab('menu')} className="mt-4 text-brand-600 font-bold text-sm">
                            {t_ui.menu}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="bg-brand-600 text-white rounded-2xl p-6 shadow-lg shadow-brand-200">
                            <p className="text-brand-100 font-medium text-sm mb-1">{t_ui.pay_total}</p>
                            <p className="text-4xl font-black">{formatPrice(activeTableOrder.total)}</p>
                        </div>

                        {publicPaymentMethods.length > 0 && activeTableOrder.orderStatus !== 'completed' && (
                            <div className="bg-white rounded-2xl shadow-card p-6 border-2 border-brand-50">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-brand-500"/> {t_ui.payment_methods}</h3>
                                
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {publicPaymentMethods.filter((pm:any) => pm.active).map((pm:any) => (
                                        <button
                                            key={pm.id}
                                            onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === pm.id ? null : pm.id)}
                                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selectedPaymentMethod === pm.id ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                                        >
                                            <div className="bg-white p-2 rounded-lg shadow-sm">
                                                <CreditCard size={20} className="text-gray-500"/>
                                            </div>
                                            <span className="text-xs font-bold text-center">{pm.name}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Selected Payment Detail */}
                                {selectedPaymentMethod && (
                                    <div className="animate-[scale-in_0.2s_ease-out]">
                                        {publicPaymentMethods.find((pm:any) => pm.id === selectedPaymentMethod)?.qrCodeUrl && (
                                            <div className="flex flex-col items-center mb-6">
                                                <div className="w-56 h-56 bg-white rounded-2xl p-2 border-2 border-brand-200 shadow-lg mb-4">
                                                    <img 
                                                        src={publicPaymentMethods.find((pm:any) => pm.id === selectedPaymentMethod)?.qrCodeUrl} 
                                                        alt="Payment QR" 
                                                        className="w-full h-full object-contain rounded-xl" 
                                                    />
                                                </div>
                                                <p className="text-sm font-bold text-gray-700">{t_ui.scan_pay}</p>
                                                <p className="text-xs text-gray-500">
                                                    {publicPaymentMethods.find((pm:any) => pm.id === selectedPaymentMethod)?.accountName} <br/>
                                                    {publicPaymentMethods.find((pm:any) => pm.id === selectedPaymentMethod)?.accountNumber}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* AI Scan Pay Button */}
                                <div className="border-t border-gray-100 pt-4">
                                    <label className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer hover:shadow-xl">
                                        {verifyingPayment ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20} />
                                                <span>{t_ui.verifying}</span>
                                            </>
                                        ) : paymentProofUrl ? (
                                            <>
                                                <CheckCircle size={20} className="text-green-400" />
                                                <span>{t_ui.payment_verified}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} className="text-brand-300" />
                                                <span>{t_ui.report_payment}</span>
                                            </>
                                        )}
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={handleUploadPaymentProof}
                                            disabled={verifyingPayment}
                                        />
                                    </label>
                                    {paymentProofUrl && (
                                        <p className="text-[10px] text-green-600 font-bold text-center mt-2 bg-green-50 py-1 rounded-lg">
                                            Receipt uploaded successfully.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                    <History size={20} className="text-brand-600" />
                    <h3 className="font-bold text-gray-800">{t_ui.past_orders}</h3>
                </div>

                {customerHistory.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <History size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No history found.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {customerHistory.map(sale => (
                            <div 
                                key={sale.id} 
                                onClick={() => setSelectedHistoryOrder(sale)}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:border-brand-200 transition-colors"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-800">#{sale.id.slice(-6)}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                            sale.orderStatus === 'completed' ? 'bg-green-100 text-green-700' : 
                                            sale.orderStatus === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {sale.orderStatus}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(sale.timestamp).toLocaleDateString()} • {new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-brand-600">{formatPrice(sale.total)}</span>
                                    <ChevronRight size={16} className="text-gray-300" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* Floating Actions */}
        {orderingEnabled && activeTab === 'menu' && (
            <div className="fixed bottom-6 left-4 right-4 z-50 flex flex-col gap-2">
                {/* Restaurant: Show active bill button */}
                {isRestaurant && activeTableOrder && activeTableOrder.orderStatus !== 'completed' && (
                    <button 
                        onClick={() => setActiveTab('bill')}
                        className="bg-brand-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-bounce-in active:scale-95 transition-transform"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-xl"><Receipt size={24} /></div>
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] uppercase font-bold text-brand-200">{t_ui.active_order}</span>
                                <span className="font-black text-xl leading-none">{formatPrice(activeTableOrder.total)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 font-bold text-sm bg-white/10 px-3 py-1.5 rounded-lg">
                            {t_ui.view_bill} <ChevronRight size={16} />
                        </div>
                    </button>
                )}
                
                {/* Retail: Show Cart Button */}
                {!isRestaurant && cart.length > 0 && !showCart && !selectedProduct && (
                    <button onClick={() => setShowCart(true)} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between active:scale-95 transition-transform">
                        <div className="flex items-center gap-3"><div className="bg-brand-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{totalItems}</div><div className="flex flex-col items-start"><span className="text-xs text-gray-400">{t_ui.total}</span><span className="font-bold text-lg leading-none">{formatPrice(cartTotal)}</span></div></div>
                        <div className="flex items-center gap-2 font-bold text-sm">{t_ui.view_cart} <ChevronLeft className="rotate-180" size={16} /></div>
                    </button>
                )}
            </div>
        )}

      {/* Retail Cart Modal */}
      {showCart && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center sm:p-4">
              <div className="bg-white w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl animate-[slide-up_0.3s_ease-out]">
                  {/* Header */}
                  <div className="p-6 pb-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <h2 className={`text-xl font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{t_ui.your_order}</h2>
                      <button onClick={() => setShowCart(false)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-800 shadow-sm"><X size={20}/></button>
                  </div>
                  
                  {/* List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {cart.map((item, idx) => (
                          <div key={item.id + idx} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl">
                              <div>
                                  <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                                  {item.variantName && <p className="text-xs text-gray-400">{item.variantName}</p>}
                                  <p className="text-brand-600 font-bold text-xs mt-1">{formatPrice(item.price)}</p>
                              </div>
                              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                  <button onClick={() => updateCartQuantity(item.id, -1, item.variantId)} className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm"><Minus size={14}/></button>
                                  <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                  <button onClick={() => updateCartQuantity(item.id, 1, item.variantId)} className="w-7 h-7 flex items-center justify-center bg-brand-600 text-white rounded shadow-sm"><Plus size={14}/></button>
                              </div>
                          </div>
                      ))}
                  </div>

                  {/* Footer */}
                  <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                      <div className="flex justify-between items-center mb-4">
                          <span className="text-gray-500 font-bold">{t_ui.total_amount}</span>
                          <span className="text-2xl font-black text-brand-600">{formatPrice(cartTotal)}</span>
                      </div>
                      <button 
                        onClick={() => setShowCustomerForm(true)} 
                        className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-[0.98] transition-all"
                      >
                          {t_ui.place_order}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Customer Form Modal (Retail Only) */}
      {showCustomerForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-[scale-in_0.2s_ease-out]">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className={`text-xl font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{t_ui.cust_details}</h3>
                      <button onClick={() => setShowCustomerForm(false)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-800"><X size={20}/></button>
                  </div>
                  
                  {/* Google Auto-Fill Info */}
                  {customerUser && (
                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-4 flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                              G
                          </div>
                          <div>
                              <p className="text-xs font-bold text-blue-800">Signed in as {customerUser.email}</p>
                              <p className="text-[10px] text-blue-600">History will be saved to this account.</p>
                          </div>
                      </div>
                  )}

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Name</label>
                          <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                              <input 
                                value={custName}
                                onChange={e => setCustName(e.target.value)}
                                placeholder={t_ui.name_ph}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-500 font-medium"
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Phone</label>
                          <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                              <input 
                                value={custPhone}
                                onChange={e => setCustPhone(e.target.value)}
                                placeholder={t_ui.phone_ph}
                                type="tel"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-500 font-medium"
                              />
                          </div>
                      </div>
                      
                      <button 
                        onClick={handleRetailCheckout}
                        disabled={submittingOrder || !custName || !custPhone}
                        className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                      >
                          {submittingOrder ? <Loader2 className="animate-spin" /> : t_ui.submit_order}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* History Detail Modal */}
      {selectedHistoryOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
            <div className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md bg-transparent md:bg-white rounded-none md:rounded-2xl overflow-hidden flex flex-col">
                 <div className="absolute top-4 right-4 z-50 md:z-10">
                    <button 
                        onClick={() => setSelectedHistoryOrder(null)}
                        className="bg-white/20 md:bg-gray-100 p-2 rounded-full text-white md:text-gray-600 hover:bg-white/40 md:hover:bg-gray-200 transition-colors backdrop-blur-md"
                    >
                        <X size={24} />
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto bg-slate-100 md:bg-white no-scrollbar">
                     <ReceiptView sale={selectedHistoryOrder} onBack={() => setSelectedHistoryOrder(null)} />
                     
                     {/* Add Payment Proof Upload Section if Status allows */}
                     {['pending', 'pending_verification'].includes(selectedHistoryOrder.orderStatus) && (
                         <div className="p-6 bg-white border-t border-gray-100">
                             <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                                 <h4 className="font-bold text-brand-800 mb-2 flex items-center gap-2">
                                     <Sparkles size={16} /> {t_ui.report_payment}
                                 </h4>
                                 <p className="text-xs text-brand-600 mb-4">
                                     Please upload your payment receipt to confirm this order.
                                 </p>
                                 
                                 <label className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-brand-700">
                                     {verifyingPayment ? (
                                         <Loader2 className="animate-spin" size={18} />
                                     ) : (
                                         <Upload size={18} />
                                     )}
                                     <span>{verifyingPayment ? 'Uploading...' : 'Upload Receipt'}</span>
                                     <input 
                                         type="file" 
                                         className="hidden" 
                                         accept="image/*"
                                         onChange={handleHistoryProofUpload}
                                         disabled={verifyingPayment}
                                     />
                                 </label>
                                 {selectedHistoryOrder.paymentProofUrl && (
                                     <div className="mt-3 text-center">
                                         <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-md">
                                             Receipt on file. Wait for verification.
                                         </span>
                                     </div>
                                 )}
                             </div>
                         </div>
                     )}
                 </div>
            </div>
        </div>
      )}

      {/* Variant Selector Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
             <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden animate-[scale-in_0.2s_ease-out] shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                         <h3 className={`font-bold text-xl text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>
                             {selectedProduct.name}
                         </h3>
                         <p className="text-sm text-gray-500 font-medium">{t_ui.select_variant || 'Select Option'}</p>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="p-2 bg-white rounded-full hover:bg-gray-100 text-gray-400 shadow-sm border border-gray-100">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto space-y-2 bg-white">
                    {selectedProduct.variants?.map(variant => (
                        <button
                            key={variant.id}
                            onClick={() => {
                                if (isRestaurant) {
                                    handleDirectAdd(selectedProduct, variant);
                                } else {
                                    addToCart(selectedProduct, variant);
                                    setSelectedProduct(null);
                                }
                            }}
                            className="w-full flex justify-between items-center p-4 rounded-2xl border-2 border-transparent hover:border-brand-500 bg-gray-50 hover:bg-brand-50 transition-all group"
                        >
                            <div className="text-left">
                                <span className="font-bold text-gray-800 block text-lg">{variant.options.join(' / ')}</span>
                                <span className={`text-xs font-bold ${variant.stock <= 0 && selectedProduct.trackStock !== false ? 'text-red-500' : 'text-gray-400'}`}>
                                    {selectedProduct.trackStock === false ? (t_ui.available || 'Available') : (variant.stock <= 0 ? t_ui.sold_out : `${variant.stock} in stock`)}
                                </span>
                            </div>
                            <span className="font-black text-lg text-brand-600 group-hover:scale-105 transition-transform">{formatPrice(variant.price)}</span>
                        </button>
                    ))}
                </div>
             </div>
        </div>
      )}
    </div>
  );
}
