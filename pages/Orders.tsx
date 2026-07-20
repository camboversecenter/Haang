
import React, { useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { Search, FileText, ChevronRight, X, Plus, Camera, Loader2, Upload, Trash2, PenLine, Sparkles, CreditCard, QrCode, CheckCircle, Clock, AlertCircle, XCircle, Filter, Check, ChevronDown, Ban, Download } from 'lucide-react';
import ReceiptView from './ReceiptView';
import { Sale, CartItem } from '../types';
import { analyzePaperOrder } from '../services/geminiService';
import { supabase } from '../services/supabaseClient'; // Import for direct update if needed

const MAX_ITEMS_LIMIT = 50;

export default function Orders() {
  const { sales, language, t, currentShop, settings, addManualSale, products, formatPrice, verifyOrder, fetchMoreSales, hasMoreSales, activeStaff, cancelSale, exportSalesData } = useStore();
  const { showToast, showAlert, showConfirm } = useUI();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // We store only the ID, component below handles fetching via "receiptId" prop
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [scanTab, setScanTab] = useState<'manual' | 'scan'>('manual');
  const [scanning, setScanning] = useState(false);
  const [manualItems, setManualItems] = useState<{name: string, price: number, quantity: number}[]>([
      { name: '', price: 0, quantity: 1 }
  ]);
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 16));
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'khqr'>('cash');
  const [activeSearchRow, setActiveSearchRow] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Status Options with Translations
  const filters = [
      { id: 'all', label: t('status.all') },
      { id: 'pending', label: t('status.pending') },
      { id: 'confirmed', label: language === 'km' ? 'កំពុងដំណើរការ' : 'In Progress' },
      { id: 'completed', label: t('status.completed') },
      { id: 'cancelled', label: t('status.cancelled') },
      { id: 'pending_verification', label: t('status.verifying') },
      { id: 'debt', label: t('status.debt') },
  ];

  // Sync URL state
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const oId = params.get('orderId');
      if (oId && oId !== selectedOrderId) {
          setSelectedOrderId(oId);
      }
  }, []);

  const openOrder = (id: string) => {
      setSelectedOrderId(id);
      const url = new URL(window.location.href);
      url.searchParams.set('orderId', id);
      window.history.pushState({}, '', url);
  };

  const closeOrder = () => {
      setSelectedOrderId(null);
      const url = new URL(window.location.href);
      url.searchParams.delete('orderId');
      window.history.pushState({}, '', url);
  };

  const handleLoadMore = async () => {
      setLoadingMore(true);
      await fetchMoreSales();
      setLoadingMore(false);
  };

  const handleExport = async () => {
      setExporting(true);
      await exportSalesData();
      showToast(t('toast.export_success'), 'success');
      setExporting(false);
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.id.includes(search) || 
                          s.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = statusFilter === 'all' || s.orderStatus === statusFilter;
    
    return matchesSearch && matchesFilter;
  });

  const updateItem = (index: number, field: string, value: any) => {
      const updated = [...manualItems];
      updated[index] = { ...updated[index], [field]: value };
      setManualItems(updated);
  };

  const handleProductSelect = (index: number, product: any, variantPrice?: number) => {
      const updated = [...manualItems];
      const name = product.name;
      const price = variantPrice !== undefined ? variantPrice : product.price;
      
      updated[index] = { 
          ...updated[index], 
          name: name,
          price: price
      };
      setManualItems(updated);
      setActiveSearchRow(null);
  };

  const addNewLine = () => {
      if (manualItems.length >= MAX_ITEMS_LIMIT) {
          showToast(t('toast.max_item_limit'), "error");
          return;
      }
      setManualItems([...manualItems, { name: '', price: 0, quantity: 1 }]);
  };

  const removeLine = (index: number) => {
      const updated = manualItems.filter((_, i) => i !== index);
      setManualItems(updated);
  };

  const calculateTotal = () => {
      return manualItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSaveOrder = () => {
      const total = calculateTotal();
      if (total <= 0) {
          showAlert(t('alert.invalid_amt_title'), t('alert.invalid_amt_msg'));
          return;
      }

      const newSale: Sale = {
          id: Date.now().toString(),
          shopId: currentShop!.id,
          timestamp: new Date(manualDate).getTime(),
          items: manualItems.map((i, idx) => ({
              id: `manual-${Date.now()}-${idx}`,
              shopId: currentShop!.id,
              name: i.name || 'Custom Item',
              price: i.price,
              quantity: i.quantity,
              stock: 0,
              category: 'Manual'
          } as CartItem)),
          subtotal: total,
          tax: 0,
          total: total,
          paymentMethod: paymentMethod,
          orderStatus: 'completed',
          currency: settings.currency,
          exchangeRate: settings.exchangeRate
      };

      addManualSale(newSale);
      setShowAddModal(false);
      setManualItems([{ name: '', price: 0, quantity: 1 }]);
      showToast(t('toast.order_saved'), "success");
  };

  const handleVerify = async (saleId: string) => {
      await verifyOrder(saleId);
      showToast("Order verified and completed!", "success");
      closeOrder();
  };

  const handleReject = async (saleId: string) => {
      const confirm = await showConfirm("Reject Order", "Are you sure you want to cancel this order? This cannot be undone.");
      if (confirm) {
          // cancelSale is offline-safe (sync queue), updates local state (no
          // full page reload), and restores stock when the order had already
          // been confirmed/completed.
          await cancelSale(saleId);
          showToast("Order cancelled", "info");
          closeOrder();
      }
  };

  const handleVoidOrder = async (saleId: string) => {
      // Permission check: Only Admin or Manager can void completed orders
      const role = activeStaff?.role || 'cashier';
      if (role !== 'admin' && role !== 'manager') {
          showAlert("Permission Denied", "Only Admins or Managers can void completed transactions.");
          return;
      }

      const confirm = await showConfirm(t('ord.cancel_title'), t('ord.cancel_msg'));
      if (confirm) {
          await cancelSale(saleId);
          showToast(t('toast.sale_cancelled'), "success");
          closeOrder();
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setScanning(true);
          
          try {
              const parsedItems = await analyzePaperOrder(file);
              if (parsedItems.length > 0) {
                  if (parsedItems.length > MAX_ITEMS_LIMIT) {
                      showAlert(t('alert.imp_limit_title'), t('alert.imp_limit_msg'));
                      setManualItems(parsedItems.slice(0, MAX_ITEMS_LIMIT));
                  } else {
                      setManualItems(parsedItems);
                  }
                  setScanTab('manual');
                  showToast("Scan successful!", "success");
              } else {
                  showAlert(t('alert.scan_fail_title'), t('alert.scan_fail_msg'));
              }
          } catch (err) {
              console.error(err);
              showToast("Error analyzing image", "error");
          } finally {
              setScanning(false);
          }
      }
  };

  const getFilteredSuggestions = (query: string) => {
      if (!query) return products.slice(0, 5); 
      const lowerQuery = query.toLowerCase();
      return products.filter(p => 
          p.name.toLowerCase().includes(lowerQuery) || 
          p.barcode?.includes(query)
      ).slice(0, 5);
  };

  const getStatusLabel = (status?: string) => {
      switch(status) {
          case 'pending': return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1"><Clock size={10} /> {t('status.pending')}</span>;
          case 'pending_verification': return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> {t('status.verifying')}</span>;
          case 'confirmed': return <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1"><Clock size={10} /> {language === 'km' ? 'កំពុងដំណើរការ' : 'In Progress'}</span>;
          case 'completed': return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1"><CheckCircle size={10} /> {t('status.completed')}</span>;
          case 'cancelled': return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1"><XCircle size={10} /> {t('status.cancelled')}</span>;
          case 'debt': return <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1"><AlertCircle size={10} /> {t('status.debt')}</span>;
          default: return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">{status || 'Unknown'}</span>;
      }
  };

  // Find the selected order object from the ID
  const selectedOrderObj = sales.find(s => s.id === selectedOrderId);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="p-4 bg-slate-50 sticky top-0 z-10 border-b border-gray-200/50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
             <h1 className={`text-2xl font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{t('nav.orders')}</h1>
             <div className="flex gap-2">
                 <button 
                    onClick={handleExport}
                    disabled={exporting}
                    className="bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-transform"
                 >
                     {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                     <span className="hidden sm:inline">{t('ord.export')}</span>
                 </button>
                 <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-brand-600 text-white px-3 py-2 rounded-xl text-sm font-bold shadow-lg shadow-brand-200 flex items-center gap-2 active:scale-95 transition-transform"
                 >
                     <Plus size={18} />
                     <span className="hidden sm:inline">{t('ord.add')}</span>
                 </button>
             </div>
        </div>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
            type="text" 
            placeholder={t('pos.search')}
            className="w-full pl-10 pr-4 py-3 rounded-2xl border-none bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            />
        </div>
        
        {/* Status Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {filters.map(f => (
                <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                        statusFilter === f.id 
                        ? 'bg-brand-600 text-white border-brand-600 shadow-md' 
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    {f.label}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-4 space-y-3 no-scrollbar">
        {filteredSales.map((sale) => (
            <div 
                key={sale.id} 
                onClick={() => openOrder(sale.id)}
                className="bg-white p-4 rounded-2xl shadow-card flex items-center justify-between group hover:border-brand-200 border border-transparent transition-all cursor-pointer active:scale-[0.98]"
            >
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${sale.orderStatus === 'completed' ? 'bg-green-50 text-green-600' : 'bg-brand-50 text-brand-600'}`}>
                        <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                             <span className="font-bold text-gray-900 text-sm">#{sale.id.slice(-6)}</span>
                             {getStatusLabel(sale.orderStatus)}
                        </div>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">
                            {new Date(sale.timestamp).toLocaleDateString()} • {new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                         <p className="text-xs text-gray-500 mt-1 truncate max-w-[180px]">
                            {sale.items.length} items: {sale.items.map(i => i.name).join(', ')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="font-bold text-gray-900 text-lg block whitespace-nowrap">{formatPrice(sale.total)}</span>
                        <span className="text-[10px] text-gray-400 uppercase font-bold bg-gray-100 px-1.5 py-0.5 rounded">{sale.paymentMethod}</span>
                    </div>
                    <ChevronRight className="text-gray-300" size={20} />
                </div>
            </div>
        ))}
        {filteredSales.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-2">
                <Filter size={32} className="opacity-20"/>
                <span className="text-sm font-medium">No orders match your filter.</span>
            </div>
        )}
        
        {/* Load More Button */}
        {hasMoreSales && filteredSales.length > 0 && statusFilter === 'all' && search === '' && (
            <button 
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 bg-gray-50 text-gray-600 text-sm font-bold rounded-2xl border border-gray-200 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
            >
                {loadingMore ? <Loader2 className="animate-spin" size={16} /> : <ChevronDown size={16} />}
                Load More Orders
            </button>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
             <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-[scale-in_0.2s_ease-out]">
                 <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                     <h3 className="font-bold text-lg text-gray-800">{t('ord.add')}</h3>
                     <button onClick={() => setShowAddModal(false)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-800">
                         <X size={20} />
                     </button>
                 </div>
                 
                 <div className="flex p-2 bg-gray-50 gap-2">
                     <button 
                        onClick={() => setScanTab('manual')}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${scanTab === 'manual' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-400'}`}
                     >
                         <PenLine size={16} /> {t('ord.manual')}
                     </button>
                     <button 
                        onClick={() => setScanTab('scan')}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${scanTab === 'scan' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-400'}`}
                     >
                         <Camera size={16} /> {t('ord.scan')}
                     </button>
                 </div>

                 <div className="flex-1 overflow-y-auto p-4">
                     {scanTab === 'scan' ? (
                         <div className="h-full flex flex-col items-center justify-center text-center p-6">
                             <div className="w-24 h-24 bg-brand-50 rounded-full flex items-center justify-center text-brand-500 mb-6 relative">
                                 {scanning ? <Loader2 size={48} className="animate-spin" /> : <Sparkles size={48} />}
                             </div>
                             <h3 className="font-bold text-lg text-gray-800 mb-2">{t('ord.scan')}</h3>
                             <p className="text-gray-500 text-sm mb-8">
                                 {t('ord.scan_desc')}
                             </p>
                             
                             <label className="w-full">
                                 <input 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                    disabled={scanning}
                                 />
                                 <div className="bg-brand-600 text-white w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform">
                                     <Camera size={20} />
                                     {scanning ? 'Analyzing...' : t('pos.scan_camera')}
                                 </div>
                             </label>
                         </div>
                     ) : (
                         <div className="space-y-4">
                             <div>
                                 <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                                 <input 
                                    type="datetime-local" 
                                    value={manualDate}
                                    onChange={(e) => setManualDate(e.target.value)}
                                    className="w-full p-3 bg-gray-50 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500"
                                 />
                             </div>

                             <div className="relative">
                                 <div className="flex justify-between items-center mb-2">
                                     <label className="text-xs font-bold text-gray-500 uppercase">Items ({manualItems.length}/{MAX_ITEMS_LIMIT})</label>
                                     {manualItems.length >= MAX_ITEMS_LIMIT && (
                                         <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">Limit Reached</span>
                                     )}
                                 </div>
                                 <div className="space-y-2">
                                     {manualItems.map((item, idx) => (
                                         <div key={idx} className="flex gap-2 items-center relative z-0">
                                             <div className="flex-1 relative">
                                                <input 
                                                    placeholder="Item name"
                                                    value={item.name}
                                                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                                    onFocus={() => setActiveSearchRow(idx)}
                                                    className="w-full p-2 bg-gray-50 rounded-lg text-sm border-none outline-none focus:ring-1 focus:ring-brand-500"
                                                />
                                                {/* Suggestions Dropdown */}
                                                {activeSearchRow === idx && (
                                                    <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl z-50 max-h-40 overflow-y-auto border border-gray-100 mt-1">
                                                        <div 
                                                            className="fixed inset-0 z-40" 
                                                            onClick={() => setActiveSearchRow(null)}
                                                        ></div>
                                                        <div className="relative z-50">
                                                            {getFilteredSuggestions(item.name).map(p => (
                                                                <div 
                                                                    key={p.id}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault(); 
                                                                        handleProductSelect(idx, p);
                                                                    }}
                                                                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                                >
                                                                    <div className="flex justify-between items-center">
                                                                        <span className={`font-bold text-gray-800 text-sm ${language === 'km' ? 'font-display' : ''}`}>
                                                                            {p.name}
                                                                        </span>
                                                                        <span className="text-brand-600 font-bold text-xs">{formatPrice(p.price)}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                             </div>

                                             <input 
                                                type="number"
                                                placeholder="Qty"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                className="w-14 p-2 bg-gray-50 rounded-lg text-sm text-center outline-none focus:ring-1 focus:ring-brand-500"
                                             />
                                             <input 
                                                type="number"
                                                placeholder="Price (៛)"
                                                value={item.price}
                                                onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value) || 0)}
                                                className="w-20 p-2 bg-gray-50 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-brand-500"
                                             />
                                             {manualItems.length > 1 && (
                                                 <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">
                                                     <Trash2 size={18} />
                                                 </button>
                                             )}
                                         </div>
                                     ))}
                                     <button 
                                        onClick={addNewLine} 
                                        disabled={manualItems.length >= MAX_ITEMS_LIMIT}
                                        className={`text-xs font-bold flex items-center gap-1 mt-2 ${manualItems.length >= MAX_ITEMS_LIMIT ? 'text-gray-300 cursor-not-allowed' : 'text-brand-600'}`}
                                     >
                                         <Plus size={12} /> Add Line
                                     </button>
                                 </div>
                             </div>

                             <div className="pt-4 border-t border-gray-100">
                                 <div className="flex justify-between items-center mb-4">
                                     <span className="font-bold text-gray-500">Total Amount</span>
                                     <span className="text-2xl font-black text-gray-800">{formatPrice(calculateTotal())}</span>
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-3 mb-6">
                                     <button 
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-sm ${paymentMethod === 'cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-400'}`}
                                     >
                                         <CreditCard size={16} /> Cash
                                     </button>
                                     <button 
                                        onClick={() => setPaymentMethod('khqr')}
                                        className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-sm ${paymentMethod === 'khqr' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 text-gray-400'}`}
                                     >
                                         <QrCode size={16} /> KHQR
                                     </button>
                                 </div>

                                 <button 
                                    onClick={handleSaveOrder}
                                    className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-brand-200 active:scale-95 transition-transform"
                                 >
                                     {t('ord.save')}
                                 </button>
                             </div>
                         </div>
                     )}
                 </div>
             </div>
        </div>
      )}

      {selectedOrderId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
            <div className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md bg-transparent md:bg-white rounded-none md:rounded-2xl overflow-hidden flex flex-col">
                 <div className="absolute top-4 right-4 z-50 md:z-10">
                    <button 
                        onClick={closeOrder}
                        className="bg-white/20 md:bg-gray-100 p-2 rounded-full text-white md:text-gray-600 hover:bg-white/40 md:hover:bg-gray-200 transition-colors backdrop-blur-md"
                    >
                        <X size={24} />
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto bg-slate-100 md:bg-white no-scrollbar">
                     <ReceiptView receiptId={selectedOrderId} onBack={closeOrder} />
                     
                     {/* Retail Verification UI */}
                     {selectedOrderObj && selectedOrderObj.orderStatus === 'pending_verification' && (
                         <div className="p-4 bg-white border-t border-gray-100">
                             <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-4">
                                 <h3 className="font-bold text-purple-800 text-sm mb-2 flex items-center gap-2">
                                     <Loader2 size={16} className="animate-spin" /> Payment Verification Needed
                                 </h3>
                                 <p className="text-xs text-purple-600 mb-4">
                                     This order is waiting for your confirmation. Please check the proof below.
                                 </p>
                                 
                                 {selectedOrderObj.paymentProofUrl ? (
                                     <div className="rounded-lg overflow-hidden border border-gray-200 mb-4 bg-white">
                                         <img src={selectedOrderObj.paymentProofUrl} className="w-full h-auto object-contain max-h-60" />
                                     </div>
                                 ) : (
                                     <div className="text-center py-4 bg-white border border-dashed border-gray-300 rounded-lg text-gray-400 text-xs italic mb-4">
                                         No payment proof uploaded.
                                     </div>
                                 )}

                                 <div className="flex gap-2">
                                     <button 
                                        onClick={() => handleReject(selectedOrderObj.id)}
                                        className="flex-1 py-3 bg-red-100 text-red-700 font-bold rounded-xl text-sm hover:bg-red-200 transition-colors"
                                     >
                                         Reject
                                     </button>
                                     <button 
                                        onClick={() => handleVerify(selectedOrderObj.id)}
                                        className="flex-[2] py-3 bg-brand-600 text-white font-bold rounded-xl text-sm shadow-md shadow-brand-200 hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
                                     >
                                         <Check size={18} /> Confirm & Complete
                                     </button>
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* VOID BUTTON (Admin Only) */}
                     {selectedOrderObj && selectedOrderObj.orderStatus === 'completed' && (activeStaff?.role === 'admin' || activeStaff?.role === 'manager') && (
                         <div className="p-4 bg-white border-t border-gray-100">
                             <button 
                                onClick={() => handleVoidOrder(selectedOrderObj.id)}
                                className="w-full py-3 border-2 border-red-100 bg-red-50 text-red-600 font-bold rounded-xl text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                             >
                                 <Ban size={18} /> {t('ord.cancel_btn')}
                             </button>
                         </div>
                     )}
                 </div>
            </div>
        </div>
      )}
    </div>
  );
}
