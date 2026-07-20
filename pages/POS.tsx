
import React, { useState, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { Search, Plus, Minus, Trash2, CreditCard, QrCode, ShoppingBag, ChevronUp, ChevronDown, ScanBarcode, Camera, CheckCircle, Layers, Users, UserPlus, AlertCircle, Tag, MoreHorizontal, X, Gift, Printer, ArrowRight } from 'lucide-react';
import { BarcodeScanner } from '../components/BarcodeScanner';
import QRCode from 'react-qr-code';
import { Sale, Product, ProductVariant, Customer } from '../types';
import ReceiptView from './ReceiptView';

export default function POS() {
  const { products, cart, addToCart, updateCartQuantity, removeFromCart, checkout, t, language, clearCart, currentShop, settings, formatPrice, customers, addCustomer, getBestDiscountForItem, paymentMethods } = useStore();
  const { showToast, showConfirm } = useUI();
  const [search, setSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  // KHQR payment step: show the configured merchant QR for the customer to scan
  const [khqrModalMethod, setKhqrModalMethod] = useState<import('../types').PaymentMethod | null>(null);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category || 'General')))];
  const [activeCategory, setActiveCategory] = useState('All');

  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{code: string, time: number} | null>(null);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.barcode?.includes(search);
    const matchesCategory = activeCategory === 'All' || (p.category || 'General') === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const cartWithDiscounts = cart.map(item => {
      const { finalPrice, discountAmount, rule } = getBestDiscountForItem(item, selectedCustomer?.id);
      return { ...item, finalPrice, discountAmount, rule };
  });

  const subtotal = cartWithDiscounts.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
  const taxAmount = subtotal * (settings.taxRate / 100);
  const cartTotal = subtotal + taxAmount;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalSavings = cartWithDiscounts.reduce((sum, item) => sum + (item.discountAmount * item.quantity), 0);

  const handleProductClick = (product: Product) => {
      const displayStock = product.stock ?? 0;
      if (displayStock <= 0 && product.trackStock !== false) {
          showToast(language === 'km' ? 'អស់ពីស្តុក' : 'Item is out of stock', 'error');
          return;
      }

      if (product.variants && product.variants.length > 0) {
          setVariantModalProduct(product);
      } else {
          addToCart(product);
      }
  };

  const handleVariantSelect = (variant: ProductVariant) => {
      if (variant.stock <= 0 && variantModalProduct?.trackStock !== false) {
           showToast(language === 'km' ? 'ជម្រើសនេះអស់ពីស្តុក' : 'Variant is out of stock', 'error');
           return;
      }

      if (variantModalProduct) {
          addToCart(variantModalProduct, variant);
          setVariantModalProduct(null);
      }
  };

  const handleCheckout = (method: 'cash' | 'khqr' | 'credit' | 'dity_card') => {
    try {
        if (method === 'credit' && !selectedCustomer) {
            showToast(language === 'km' ? 'សូមជ្រើសរើសអតិថិជនជាមុនសិន' : "Please select a customer for credit sales", "error");
            return;
        }

        const sale = checkout(method, selectedCustomer?.id);
        
        if (sale) {
            setLastSale(sale);
            setShowCheckout(false);
            setIsMobileCartOpen(false);
            setSelectedCustomer(null);
        } else {
            showToast(language === 'km' ? 'កន្ត្រកទំនិញទទេ' : "Cart is empty", "error");
        }
    } catch (e) {
        console.error("Checkout Error:", e);
        showToast(language === 'km' ? 'មានបញ្ហាក្នុងការគិតលុយ' : "An error occurred during checkout", "error");
    }
  };

  const handleCancelOrder = async () => {
      if (cart.length === 0 && !selectedCustomer) {
          showToast(t('pos.empty_cart'), "info");
          return;
      }

      const confirm = await showConfirm(
          t('pos.cancel_order'), 
          t('pos.confirm_cancel')
      );

      if (confirm) {
          clearCart();
          setSelectedCustomer(null);
          setShowCheckout(false);
          setIsMobileCartOpen(false);
          showToast(language === 'km' ? 'បានលុបចោល' : "Order Cancelled", "info");
      }
  };

  const handleCreateCustomer = async () => {
      if (!newCustomerName) return;
      const id = await addCustomer(newCustomerName, newCustomerPhone);
      if (id) {
          // Force fetch from local store or construct optimistic object
          const newCust = customers.find(c => c.id === id) || { 
              id, 
              shopId: currentShop!.id, 
              name: newCustomerName, 
              phone: newCustomerPhone, 
              totalDebt: 0, 
              lastInteraction: Date.now() 
          } as Customer;
          
          setSelectedCustomer(newCust);
          setIsAddingCustomer(false);
          setNewCustomerName('');
          setNewCustomerPhone('');
      }
  };

  // Resolve a scanned value to a product. Supports both raw barcodes AND the
  // app's own product QR codes, which encode a URL containing "?productId=<id>".
  const findScannedProduct = (raw: string): Product | undefined => {
      const code = raw.trim();
      if (code.includes('productId=')) {
          const idMatch = code.match(/productId=([^&\s]+)/);
          const pid = idMatch ? decodeURIComponent(idMatch[1]) : null;
          if (pid) {
              const byId = products.find(p => p.id === pid);
              if (byId) return byId;
          }
      }
      return products.find(p => p.barcode === code);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        const match = findScannedProduct(search);
        if (match) {
             handleProductClick(match);
            setSearch('');
        }
    }
  };

  const handleScan = (code: string) => {
      const now = Date.now();
      // Debounce: If same code scanned within 1.5 seconds, ignore to prevent duplicate rapid scans
      if (lastScanRef.current && lastScanRef.current.code === code && (now - lastScanRef.current.time < 1500)) {
          return;
      }

      const product = findScannedProduct(code);
      if (product) {
          handleProductClick(product);
          // Update ref
          lastScanRef.current = { code, time: now };
          // NOTE: We do NOT close the scanner here to allow continuous scanning
          showToast(language === 'km' ? `បានបន្ថែម ${product.name}` : `Added ${product.name}`, 'success');
      } else {
          // Throttle error toast as well
          if (!lastScanRef.current || lastScanRef.current.code !== code || (now - lastScanRef.current.time > 2000)) {
              showToast(language === 'km' ? `រកមិនឃើញទំនិញ៖ ${code}` : `Product not found: ${code}`, 'error');
              lastScanRef.current = { code, time: now };
          }
      }
  };

  const focusSearch = () => {
      searchInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full md:flex-row relative bg-slate-50">
      {/* Left Side: Product List */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        
        {/* Search & Categories Header */}
        <div className="p-4 md:p-6 pb-2 space-y-3 shrink-0">
          {/* Search Bar Row */}
          <div className="flex gap-3">
            <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder={t('pos.search')}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-none bg-white shadow-card focus:ring-2 focus:ring-brand-500/50 focus:outline-none transition-all placeholder:text-gray-400 text-gray-700 font-medium"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
            </div>
            
            <button 
                onClick={() => setShowScanner(true)}
                className="md:hidden bg-white text-gray-700 p-3.5 rounded-2xl shadow-card active:scale-95 transition-all hover:text-brand-600"
                title={t('pos.scan_camera')}
            >
                <Camera size={24} />
            </button>

            <button 
                onClick={focusSearch}
                className="hidden md:block bg-white p-3.5 rounded-2xl shadow-card text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                title="Focus Scanner"
            >
                <ScanBarcode size={24} />
            </button>
          </div>
          
          {/* Categories Pill List */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 mask-linear-fade">
            {categories.map(cat => (
                <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                        activeCategory === cat 
                        ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-200 scale-105' 
                        : 'bg-white text-gray-500 border-transparent shadow-sm hover:bg-gray-50 hover:border-gray-200'
                    }`}
                >
                    {cat === 'All' ? t('status.all') : cat}
                </button>
            ))}
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 overflow-y-auto px-4 pb-32 md:pb-6 pt-2 scroll-smooth">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 pb-4">
            {filteredProducts.map(product => {
                let displayStock = product.stock ?? 0;
                let hasVariants = product.variants && product.variants.length > 0;
                let isTracked = product.trackStock !== false;
                let isOutOfStock = isTracked && displayStock <= 0;

                return (
                  <div 
                    key={product.id} 
                    onClick={() => handleProductClick(product)}
                    className={`
                        group bg-white rounded-3xl p-3 shadow-card transition-all duration-200 cursor-pointer flex flex-col relative border border-transparent
                        ${isOutOfStock ? 'opacity-80' : 'hover:shadow-glow hover:-translate-y-1 hover:border-brand-200'}
                        active:scale-[0.98]
                    `}
                  >
                    {/* Image Container */}
                    <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden relative mb-3">
                       {product.imageUrl && product.imageUrl.length > 10 ? (
                           <img 
                              src={product.imageUrl} 
                              alt={product.name} 
                              className={`w-full h-full object-cover transition-transform duration-500 ${isOutOfStock ? 'grayscale' : 'group-hover:scale-110'}`} 
                              loading="lazy" 
                           />
                       ) : (
                           <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                               <ShoppingBag size={32} />
                           </div>
                       )}
                       
                       {/* Stock Badge */}
                       {(isTracked || isOutOfStock) && displayStock < 5 && (
                         <div className={`absolute top-2 left-2 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm z-20 flex items-center gap-1 ${isOutOfStock ? 'bg-red-500/90' : 'bg-orange-500/90'}`}>
                           {isOutOfStock ? <AlertCircle size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                           {isOutOfStock ? t('inv.out_of_stock') : `${t('inv.low_stock')}: ${displayStock}`}
                         </div>
                       )}

                       {/* Variant Indicator */}
                       {hasVariants && (
                            <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md text-white p-1.5 rounded-lg z-20">
                                <Layers size={12} />
                            </div>
                       )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="mb-1">
                          <h3 className={`font-bold text-gray-800 text-sm leading-snug ${language === 'km' ? 'font-display' : ''} line-clamp-2`}>
                              {product.name}
                          </h3>
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">{product.category || 'General'}</p>
                      </div>
                      
                      <div className="mt-auto flex justify-between items-center">
                        <span className={`font-extrabold text-brand-700 ${hasVariants ? 'text-sm' : 'text-base'}`}>
                            {hasVariants && <span className="text-[10px] font-normal text-gray-400 mr-0.5">fr</span>}
                            {formatPrice(product.price)}
                        </span>
                        
                        <button 
                            disabled={isOutOfStock}
                            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isOutOfStock ? 'bg-gray-100 text-gray-300' : 'bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white'}`}
                        >
                            {isOutOfStock ? <AlertCircle size={16} /> : <Plus size={16} strokeWidth={3} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
          
          {/* Empty State */}
          {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <ShoppingBag size={48} className="mb-4 text-gray-200" />
                  <p className="font-bold">No products found.</p>
                  <p className="text-sm">Try searching for something else.</p>
              </div>
          )}
        </div>
      </div>

      {/* Right Side: Desktop Sidebar Cart */}
      <div className="hidden md:flex flex-col w-96 bg-white border-l border-gray-100 h-full shadow-xl z-20 relative">
        {/* Cart Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
            <h2 className={`text-xl font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>
                {t('pos.total')}
            </h2>
            <div className="flex items-center gap-2">
                 <span className="bg-brand-50 text-brand-600 px-2 py-1 rounded-lg text-xs font-bold">{totalItems} items</span>
                 <button 
                    onClick={handleCancelOrder} 
                    className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Cancel Order"
                 >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
        
        {/* Customer Selector */}
        <div className="px-5 pt-4 pb-2">
             {selectedCustomer ? (
                <div className="flex justify-between items-center bg-brand-50/50 border border-brand-100 p-3 rounded-2xl animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-100 p-2 rounded-xl text-brand-600"><Users size={18} /></div>
                        <div>
                            <p className="font-bold text-sm text-brand-900">{selectedCustomer.name}</p>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-brand-500">{selectedCustomer.phone || 'No phone'}</p>
                                {selectedCustomer.orderCount && selectedCustomer.orderCount > 2 && <span className="text-[9px] bg-brand-200 text-brand-700 px-1 rounded font-bold">VIP</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><X size={16}/></button>
                </div>
            ) : (
                <div className="flex gap-2">
                     <div className="relative flex-1">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select 
                            className="w-full bg-gray-50 border border-transparent hover:border-gray-200 text-gray-600 text-sm font-bold rounded-xl py-3 pl-9 pr-3 outline-none appearance-none transition-all cursor-pointer"
                            onChange={(e) => {
                                const c = customers.find(cust => cust.id === e.target.value);
                                if (c) setSelectedCustomer(c);
                            }}
                            value=""
                        >
                             <option value="" disabled>{language === 'km' ? 'ជ្រើសរើសអតិថិជន' : 'Select Customer'}</option>
                             {customers.map(c => (
                                 <option key={c.id} value={c.id}>{c.name}</option>
                             ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                     </div>
                     <button onClick={() => setShowCheckout(true)} className="bg-gray-50 hover:bg-brand-50 text-brand-600 p-3 rounded-xl transition-colors">
                         <UserPlus size={20} />
                     </button>
                 </div>
            )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 scroll-smooth">
             {cartWithDiscounts.map((item, idx) => (
                 <CartItemRow 
                    key={`${item.id}-${item.variantId || idx}`} 
                    item={item} 
                    updateQty={updateCartQuantity} 
                    language={language} 
                    formatPrice={formatPrice} 
                 />
             ))}
             {cart.length === 0 && <EmptyCartState t={t} />}
        </div>

        {/* Cart Footer */}
        <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] space-y-3 z-10">
            <div className="flex justify-between items-center text-sm text-gray-500">
                <span>{t('pos.subtotal')}</span>
                <span className="font-bold text-gray-800">{formatPrice(subtotal)}</span>
            </div>
            {totalSavings > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600 animate-pulse">
                    <span className="flex items-center gap-1 font-bold"><Tag size={12}/> Savings</span>
                    <span className="font-bold">-{formatPrice(totalSavings)}</span>
                </div>
            )}
             <div className="flex justify-between items-center text-sm text-gray-500">
                <span>{t('pos.tax')} ({settings.taxRate}%)</span>
                <span className="font-bold text-gray-800">{formatPrice(taxAmount)}</span>
            </div>
            
            <div className="border-t border-dashed border-gray-200 my-2"></div>
            
            <div className="flex justify-between items-center">
                <span className="text-gray-800 font-bold text-lg">{t('pos.total')}</span>
                <span className="text-3xl font-black text-brand-600 tracking-tight">{formatPrice(cartTotal)}</span>
            </div>
            
            <button 
                disabled={cart.length === 0}
                onClick={() => setShowCheckout(true)}
                className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 group"
            >
                <span>{t('pos.pay')}</span>
                <ChevronUp className="rotate-90 group-hover:translate-x-1 transition-transform" size={20} />
            </button>
        </div>
      </div>

      {/* Mobile Cart Floating Bar */}
      <div className={`md:hidden fixed bottom-[85px] left-4 right-4 z-40 transition-transform duration-300 ease-in-out`}>
          {/* Expanded Cart Content */}
          <div className={`bg-white rounded-t-3xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 origin-bottom ${isMobileCartOpen ? 'max-h-[60vh] opacity-100 mb-0' : 'max-h-0 opacity-0 mb-4'}`}>
              <div className="p-4 bg-gray-50 flex justify-between items-center border-b border-gray-100">
                  <span className={`font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{language === 'km' ? 'កន្ត្រកទំនិញ' : 'Current Order'}</span>
                  <button 
                    onClick={handleCancelOrder} 
                    className="text-red-500 text-xs font-bold px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    CLEAR
                  </button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto max-h-[40vh] bg-white">
                  {cartWithDiscounts.map((item, idx) => (
                      <CartItemRow 
                        key={`${item.id}-${item.variantId || idx}`} 
                        item={item} 
                        updateQty={updateCartQuantity} 
                        language={language} 
                        formatPrice={formatPrice} 
                      />
                  ))}
                  {cart.length === 0 && <EmptyCartState t={t} />}
              </div>
          </div>

          {/* Floating Button */}
          <button 
            onClick={() => cart.length > 0 && setIsMobileCartOpen(!isMobileCartOpen)}
            disabled={cart.length === 0}
            className={`w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl shadow-slate-900/20 flex items-center justify-between transition-all active:scale-95 ${isMobileCartOpen ? 'rounded-t-none' : ''}`}
          >
              <div className="flex items-center gap-3">
                  <div className="bg-brand-500 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner">
                      {totalItems}
                  </div>
                  <div className="flex flex-col items-start">
                      <span className="text-xs text-slate-400 font-medium">{cart.length === 0 ? t('pos.empty_cart') : (isMobileCartOpen ? t('common.close') : t('pos.view_cart'))}</span>
                      <span className="font-bold text-xl leading-none tracking-tight">{formatPrice(cartTotal)}</span>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                 {isMobileCartOpen ? <ChevronDown className="text-slate-400" /> : <ChevronUp className="text-slate-400" />}
                 <div className="h-8 w-px bg-slate-700 mx-1"></div>
                 <div 
                    onClick={(e) => { e.stopPropagation(); setShowCheckout(true); }}
                    className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors"
                 >
                    {t('pos.pay')}
                 </div>
              </div>
          </button>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden animate-[scale-in_0.2s_ease-out] shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 overflow-y-auto no-scrollbar">
                    <div className="text-center mb-8 relative">
                        <button onClick={() => setShowCheckout(false)} className="absolute top-0 right-0 p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-800"><X size={20}/></button>
                        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600 shadow-inner">
                            <ShoppingBag size={36} />
                        </div>
                        <h2 className={`text-2xl font-bold mb-1 text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{t('pos.pay')}</h2>
                        <p className="text-5xl font-black text-brand-600 mb-2 tracking-tighter">{formatPrice(cartTotal)}</p>
                        {totalSavings > 0 && <span className="inline-block text-xs text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full">{t('pos.you_saved')} {formatPrice(totalSavings)}!</span>}
                    </div>

                    {/* Customer Selection */}
                    <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        {selectedCustomer ? (
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl"><Users size={20} /></div>
                                    <div>
                                        <p className={`font-bold text-sm text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{selectedCustomer.name}</p>
                                        <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded">Change</button>
                            </div>
                        ) : isAddingCustomer ? (
                            <div className="space-y-3 animate-in fade-in">
                                <input 
                                    placeholder="Customer Name" 
                                    className="w-full p-3 text-sm border-2 border-transparent focus:border-brand-500 bg-white rounded-xl outline-none transition-all"
                                    value={newCustomerName}
                                    onChange={e => setNewCustomerName(e.target.value)}
                                    autoFocus
                                />
                                <input 
                                    placeholder="Phone Number" 
                                    className="w-full p-3 text-sm border-2 border-transparent focus:border-brand-500 bg-white rounded-xl outline-none transition-all"
                                    value={newCustomerPhone}
                                    onChange={e => setNewCustomerPhone(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleCreateCustomer} className="flex-1 bg-brand-600 text-white py-2.5 rounded-xl text-sm font-bold shadow-md">{t('common.save')}</button>
                                    <button onClick={() => setIsAddingCustomer(false)} className="flex-1 bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-bold">{t('common.cancel')}</button>
                                </div>
                            </div>
                        ) : (
                             <div className="flex gap-2">
                                 <div className="relative flex-1">
                                    <select 
                                        className="w-full bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl p-3 outline-none appearance-none"
                                        onChange={(e) => {
                                            const c = customers.find(cust => cust.id === e.target.value);
                                            if (c) setSelectedCustomer(c);
                                        }}
                                        value=""
                                    >
                                        <option value="" disabled>{language === 'km' ? 'ជ្រើសរើសអតិថិជន' : 'Select Customer'}</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                 </div>
                                 <button onClick={() => setIsAddingCustomer(true)} className="bg-brand-100 text-brand-600 p-3 rounded-xl hover:bg-brand-200 transition-colors">
                                     <UserPlus size={20} />
                                 </button>
                             </div>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                        <button 
                            type="button"
                            onClick={() => handleCheckout('cash')}
                            className="group w-full flex items-center justify-between p-4 border-2 border-transparent bg-gray-50 hover:bg-white hover:border-green-500 rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-4">
                                <div className="bg-green-100 p-3 rounded-xl text-green-600 group-hover:scale-110 transition-transform"><CreditCard size={24} /></div>
                                <div className="text-left">
                                    <span className="font-bold text-gray-800 block text-lg">{language === 'km' ? 'បង់ប្រាក់សុទ្ធ' : 'Cash'}</span>
                                    <span className="text-xs text-gray-400 font-medium">Pay with cash</span>
                                </div>
                            </div>
                            <ChevronUp className="rotate-90 text-gray-300 group-hover:text-green-500" />
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => {
                                // Show the shop's configured KHQR/bank QR so the
                                // customer can actually scan it at the register;
                                // fall back to direct completion if none is set up.
                                const method = paymentMethods.find(pm => pm.active && pm.qrCodeUrl);
                                if (method) setKhqrModalMethod(method);
                                else handleCheckout('khqr');
                            }}
                            className="group w-full flex items-center justify-between p-4 border-2 border-transparent bg-gray-50 hover:bg-white hover:border-red-500 rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                        >
                             <div className="flex items-center gap-4">
                                <div className="bg-red-100 p-3 rounded-xl text-red-600 group-hover:scale-110 transition-transform"><QrCode size={24} /></div>
                                <div className="text-left">
                                    <span className="font-bold text-gray-800 block text-lg">KHQR</span>
                                    <span className="text-xs text-gray-400 font-medium">{language === 'km' ? 'ស្កេនបង់ប្រាក់' : 'Scan to pay'}</span>
                                </div>
                            </div>
                            <ChevronUp className="rotate-90 text-gray-300 group-hover:text-red-500" />
                        </button>

                        <button 
                            type="button"
                            onClick={() => handleCheckout('dity_card')}
                            className="group w-full flex items-center justify-between p-4 border-2 border-transparent bg-gray-50 hover:bg-white hover:border-purple-500 rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                        >
                             <div className="flex items-center gap-4">
                                <div className="bg-purple-100 p-3 rounded-xl text-purple-600 group-hover:scale-110 transition-transform"><Gift size={24} /></div>
                                <div className="text-left">
                                    <span className="font-bold text-gray-800 block text-lg">{t('pos.dity_card') || 'DiTy Card'}</span>
                                    <span className="text-xs text-gray-400 font-medium">{t('pos.dity_card_desc') || 'Gift / Member Card'}</span>
                                </div>
                            </div>
                            <ChevronUp className="rotate-90 text-gray-300 group-hover:text-purple-500" />
                        </button>

                        <button 
                            type="button"
                            onClick={() => handleCheckout('credit')}
                            className={`group w-full flex items-center justify-between p-4 border-2 border-transparent bg-gray-50 hover:bg-white hover:border-orange-500 rounded-2xl transition-all shadow-sm active:scale-[0.98] ${!selectedCustomer ? 'opacity-70' : ''}`}
                        >
                             <div className="flex items-center gap-4">
                                <div className="bg-orange-100 p-3 rounded-xl text-orange-600 group-hover:scale-110 transition-transform"><Users size={24} /></div>
                                <div className="text-left">
                                    <span className="font-bold text-gray-800 block text-lg">{language === 'km' ? 'ជំពាក់' : 'Credit / Debt'}</span>
                                    <span className="text-xs text-gray-400 font-medium">{language === 'km' ? 'បង់ពេលក្រោយ' : 'Pay later'}</span>
                                </div>
                            </div>
                            <ChevronUp className="rotate-90 text-gray-300 group-hover:text-orange-500" />
                        </button>

                        <button 
                            type="button"
                            onClick={handleCancelOrder}
                            className="group w-full flex items-center justify-center gap-2 p-4 border-2 border-red-50 bg-red-50 hover:bg-red-100 hover:border-red-200 rounded-2xl transition-all active:scale-[0.98] text-red-600 mt-2"
                        >
                            <Trash2 size={20} />
                            <span className="font-bold">{t('pos.cancel') || 'Cancel Transaction'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Variant Selector Modal */}
      {variantModalProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
             <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden animate-[scale-in_0.2s_ease-out] shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                         <h3 className={`font-bold text-xl text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>
                             {variantModalProduct.name}
                         </h3>
                         <p className="text-sm text-gray-500 font-medium">{t('pos.select_variant')}</p>
                    </div>
                    <button onClick={() => setVariantModalProduct(null)} className="p-2 bg-white rounded-full hover:bg-gray-100 text-gray-400 shadow-sm border border-gray-100">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto space-y-2 bg-white">
                    {variantModalProduct.variants?.map(variant => (
                        <button
                            key={variant.id}
                            onClick={() => handleVariantSelect(variant)}
                            className="w-full flex justify-between items-center p-4 rounded-2xl border-2 border-transparent hover:border-brand-500 bg-gray-50 hover:bg-brand-50 transition-all group"
                        >
                            <div className="text-left">
                                <span className="font-bold text-gray-800 block text-lg">{variant.options.join(' / ')}</span>
                                <span className={`text-xs font-bold ${variant.stock <= 0 && variantModalProduct.trackStock !== false ? 'text-red-500' : 'text-gray-400'}`}>
                                    {variantModalProduct.trackStock === false ? t('var.available') : (variant.stock <= 0 ? t('inv.out_of_stock') : `${variant.stock} ${t('inv.in_stock')}`)}
                                </span>
                            </div>
                            <span className="font-black text-lg text-brand-600 group-hover:scale-105 transition-transform">{formatPrice(variant.price)}</span>
                        </button>
                    ))}
                </div>
             </div>
        </div>
      )}

      {/* Success / Receipt QR Modal */}
      {lastSale && (
          <div className="fixed inset-0 bg-brand-900/90 backdrop-blur-xl z-[70] flex items-center justify-center p-6">
              <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-[scale-in_0.3s_ease-out] relative overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="p-8 text-center bg-brand-600 text-white">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600 shadow-lg">
                          <CheckCircle size={36} strokeWidth={3} />
                      </div>
                      <h2 className={`text-2xl font-bold mb-1 ${language === 'km' ? 'font-display' : ''}`}>{language === 'km' ? 'ជោគជ័យ!' : 'Success!'}</h2>
                      <p className="opacity-80 text-sm">{language === 'km' ? 'ការលក់ត្រូវបានកត់ត្រា' : 'Transaction recorded'}</p>
                  </div>
                  
                  <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                      {/* Receipt View Component */}
                      <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm mb-6">
                          <ReceiptView sale={lastSale} />
                      </div>
                      
                      <button 
                        onClick={() => {
                            setLastSale(null);
                            // If mobile, keep cart closed
                            setIsMobileCartOpen(false);
                        }}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                      >
                          <span>{t('pos.start_new')}</span>
                          <ArrowRight size={20} />
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Barcode Scanner Overlay */}
      {showScanner && (
          <BarcodeScanner
              onScan={handleScan}
              onClose={() => setShowScanner(false)}
          />
      )}

      {/* KHQR Merchant QR — customer scans, cashier confirms */}
      {khqrModalMethod && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center animate-[scale-in_0.2s_ease-out]">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-gray-800">{khqrModalMethod.name}</h3>
                      <button onClick={() => setKhqrModalMethod(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={18} /></button>
                  </div>
                  <img src={khqrModalMethod.qrCodeUrl} alt="Payment QR" className="w-56 h-56 object-contain mx-auto rounded-2xl border border-gray-100 shadow-inner bg-white" />
                  {(khqrModalMethod.accountName || khqrModalMethod.accountNumber) && (
                      <p className="text-xs text-gray-500 mt-3 font-medium">{khqrModalMethod.accountName} {khqrModalMethod.accountNumber ? `· ${khqrModalMethod.accountNumber}` : ''}</p>
                  )}
                  <p className="text-2xl font-black text-brand-600 mt-3">{formatPrice(cartTotal)}</p>
                  <p className="text-xs text-gray-400 mt-1">{language === 'km' ? 'អតិថិជនស្កេន QR ដើម្បីបង់ប្រាក់' : 'Customer scans the QR to pay'}</p>
                  <button
                      onClick={() => { setKhqrModalMethod(null); handleCheckout('khqr'); }}
                      className="w-full mt-5 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                      <CheckCircle size={18} /> {language === 'km' ? 'ទទួលបានប្រាក់ — បញ្ចប់' : 'Payment received — Complete'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}

const EmptyCartState = ({ t }: { t: (key: string) => string }) => (
    <div className="h-64 flex flex-col items-center justify-center text-gray-400 opacity-50">
        <ShoppingBag size={48} className="mb-2" />
        <span className="font-bold">{t('pos.empty_cart')}</span>
    </div>
);

const CartItemRow = ({ item, updateQty, language, formatPrice }: any) => {
    return (
        <div className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-2xl shadow-sm transition-all hover:border-brand-200 group">
            <div className="min-w-0 flex-1 mr-4">
                <p className={`font-bold text-gray-800 text-sm truncate ${language === 'km' ? 'font-display' : ''}`}>{item.name}</p>
                {item.variantName && <p className="text-xs text-gray-400 font-medium">{item.variantName}</p>}
                
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-brand-600 font-bold text-xs">{formatPrice(item.finalPrice || item.price)}</p>
                    {item.discountAmount > 0 && (
                        <span className="text-[9px] bg-red-100 text-red-600 px-1.5 rounded font-bold">-{formatPrice(item.discountAmount)}</span>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1">
                <button 
                    onClick={() => updateQty(item.id, -1, item.variantId)} 
                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 hover:text-red-500 active:scale-95 transition-all"
                >
                    {item.quantity === 1 ? <Trash2 size={14}/> : <Minus size={14}/>}
                </button>
                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                <button 
                    onClick={() => updateQty(item.id, 1, item.variantId)} 
                    className="w-8 h-8 flex items-center justify-center bg-brand-600 text-white rounded-lg shadow-sm shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all"
                >
                    <Plus size={14}/>
                </button>
            </div>
        </div>
    );
};
