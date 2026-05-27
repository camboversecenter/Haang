
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { Plus, Users, Calendar, Sparkles, MessageSquare, ToggleLeft, ToggleRight, Share2, QrCode as QrIcon, X, QrCode, Receipt, CheckCircle, Bell, MessageCircle, Trash2, Send, Info, Power, Eye, Clock, ChefHat, Check, LogOut, History, FileText, Flame, ZoomIn, CalendarCheck, Filter, Armchair, MoreHorizontal, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactQRCode from 'react-qr-code';
import { consultBookingAgent } from '../services/geminiService';
import { Sale, TableMessage, Table, OrderItemStatus } from '../types';
import { supabase } from '../services/supabaseClient';

export default function Tables() {
  const { tables, bookings, addTable, updateTable, addBooking, settings, updateSettings, t, language, currentShop, sales, formatPrice, updateOrderItemStatus, removeItemFromOrder, confirmOrderItems, finishTableOrder, startTableSession } = useStore();
  const { showToast, showConfirm } = useUI();
  
  const [activeTab, setActiveTab] = useState<'layout' | 'schedule'>('layout');
  
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'alert'>('all');
  
  const [showAddTable, setShowAddTable] = useState(false);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [qrModal, setQrModal] = useState<{tableId: string, name: string} | null>(null);
  
  const [selectedTableOrder, setSelectedTableOrder] = useState<Sale | null>(null);
  const [viewingTableId, setViewingTableId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'order' | 'log'>('order');
  const [viewProofModal, setViewProofModal] = useState<string | null>(null);

  const [messages, setMessages] = useState<TableMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState('');

  const [newTable, setNewTable] = useState({ name: '', capacity: 4 });
  const [newBooking, setNewBooking] = useState({ customerName: '', phone: '', guests: 2, time: '', notes: '', tableId: '' });
  
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // --- Calendar State ---
  const [currentDate, setCurrentDate] = useState(new Date()); // Tracks the month being viewed
  const [selectedDate, setSelectedDate] = useState(new Date()); // Tracks the specific day selected

  const isRestaurant = currentShop?.type === 'restaurant';

  // Update time every minute for duration display
  useEffect(() => {
      const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      if (!currentShop) return;

      const fetchMessages = async () => {
          const { data } = await supabase
            .from('table_messages')
            .select('*')
            .eq('shop_id', currentShop.id);
          
          if (data) {
              setMessages(data.map(m => ({
                  id: m.id, shopId: m.shop_id, tableId: m.table_id, sender: m.sender,
                  message: m.message, type: m.type, createdAt: m.created_at
              })));
          }
      };
      fetchMessages();

      const channel = supabase
        .channel('staff_table_messages')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'table_messages', 
            filter: `shop_id=eq.${currentShop.id}` 
        }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const m = payload.new;
                setMessages(prev => [...prev, {
                    id: m.id, shopId: m.shop_id, tableId: m.table_id, sender: m.sender,
                    message: m.message, type: m.type, createdAt: m.created_at
                }]);
            } else if (payload.eventType === 'DELETE') {
                setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [currentShop]);

  useEffect(() => {
      if (viewingTableId) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages, viewingTableId]);

  useEffect(() => {
      if (viewingTableId) {
          const activeOrder = sales.find(s => s.tableId === viewingTableId && s.orderStatus !== 'completed' && s.orderStatus !== 'cancelled');
          setSelectedTableOrder(activeOrder || null);
      } else {
          setSelectedTableOrder(null);
      }
  }, [sales, viewingTableId]);

  const handleAddTable = () => { if (newTable.name) { addTable(newTable.name, newTable.capacity); setNewTable({ name: '', capacity: 4 }); setShowAddTable(false); showToast("Table added", "success"); } };
  
  const handleAddBooking = () => { 
      if (newBooking.customerName && newBooking.time) { 
          addBooking({ 
              ...newBooking, 
              time: new Date(newBooking.time).getTime(),
              tableId: newBooking.tableId || undefined
          }); 
          setNewBooking({ customerName: '', phone: '', guests: 2, time: '', notes: '', tableId: '' }); 
          setShowAddBooking(false); 
          showToast("Booking added", "success"); 
      } 
  };
  
  const askAi = async () => { if (!aiQuery) return; setAiLoading(true); const response = await consultBookingAgent(bookings, tables, aiQuery, language); setAiResponse(response); setAiLoading(false); };
  const getTableUrl = (tableId: string) => { try { const baseUrl = window.location.origin + window.location.pathname; const shopId = currentShop?.id || ''; return `${baseUrl}#/s/${shopId}?tableId=${tableId}`; } catch (e) { return window.location.href; } };

  const handleTableClick = (tableId: string) => {
      setViewingTableId(tableId);
      setDetailTab('order');
      const activeOrder = sales.find(s => s.tableId === tableId && s.orderStatus !== 'completed' && s.orderStatus !== 'cancelled');
      setSelectedTableOrder(activeOrder || null);
  };

  const handleClearMessages = async (tableId: string) => {
      const confirm = await showConfirm(language === 'km' ? "លុបសារ" : "Clear Messages", language === 'km' ? "តើអ្នកច្បាស់ទេថាចង់លុបសារទាំងអស់?" : "Are you sure you want to clear all messages for this table?");
      if (confirm) {
          setMessages(prev => prev.filter(m => m.tableId !== tableId));
          await supabase.from('table_messages').delete().eq('table_id', tableId);
      }
  };

  const handleSendReply = async () => {
      if (!replyText.trim() || !viewingTableId || !currentShop) return;
      const payload = { shop_id: currentShop.id, table_id: viewingTableId, sender: 'staff', message: replyText, type: 'text', created_at: Date.now() };
      const { error } = await supabase.from('table_messages').insert(payload);
      if (!error) { setReplyText(''); } else { console.error(error); }
  };

  const handleToggleOrdering = async (e: React.MouseEvent, table: Table) => {
      e.stopPropagation();
      const currentOrdering = table.allowOrdering;
      
      if (!currentOrdering) {
          const confirm = await showConfirm(language === 'km' ? "បើកតុ" : "Open Table", language === 'km' ? "ចាប់ផ្តើមការលក់ថ្មីសម្រាប់តុនេះ?" : "Start a new order session for this table?");
          if (confirm) {
              await startTableSession(table.id);
              showToast(language === 'km' ? "បានបើកតុ" : "Table session started", "success");
          }
      } else {
          const updates: Partial<Table> = { allowOrdering: false };
          updateTable(table.id, updates);
          showToast(language === 'km' ? "បានបិទការកម្ម៉ង់" : "Ordering disabled", "info");
      }
  };

  const handleDeleteItem = async (orderItemId: string) => {
      if (!selectedTableOrder) return;
      const confirm = await showConfirm(language === 'km' ? "លុបទំនិញ" : "Delete Item", language === 'km' ? "ដកទំនិញនេះចេញពីការកម្ម៉ង់?" : "Remove this item from the order?");
      if (confirm) { await removeItemFromOrder(selectedTableOrder.id, orderItemId); showToast(language === 'km' ? "បានលុបទំនិញ" : "Item removed", "success"); }
  };

  const handleChangeItemStatus = async (orderItemId: string, newStatus: OrderItemStatus) => {
      if (!selectedTableOrder) return;
      await updateOrderItemStatus(selectedTableOrder.id, orderItemId, newStatus);
  };

  const handleConfirmPending = async () => {
      if (!selectedTableOrder) return;
      await confirmOrderItems(selectedTableOrder.id);
      showToast(language === 'km' ? "បានបញ្ជាក់ការកម្ម៉ង់" : "Order items confirmed", "success");
  };

  const handleVerifyPayment = async () => {
      if (!selectedTableOrder) return;
      await confirmOrderItems(selectedTableOrder.id); 
      if (selectedTableOrder.orderStatus === 'pending_verification') {
           await supabase.from('sales').update({ order_status: 'confirmed' }).eq('id', selectedTableOrder.id);
      }
      showToast(language === 'km' ? "បានផ្ទៀងផ្ទាត់ការបង់ប្រាក់" : "Payment Verified & Order Confirmed", "success");
  };

  const handleFinishOrder = async () => {
      if (!selectedTableOrder || !viewingTableId) return;
      
      if (isRestaurant) {
          const hasPending = selectedTableOrder.items.some(i => i.status === 'pending');
          const hasUnserved = selectedTableOrder.items.some(i => i.status !== 'served');
          let msg = language === 'km' ? "បញ្ចប់ការលក់និងសម្អាតតុ?" : "Finish order and clear table?";
          if (hasPending) msg = language === 'km' ? "ព្រមាន៖ មានមុខម្ហូបខ្លះមិនទាន់ធ្វើ..." : "Warning: Some items are still pending. Finish anyway?";
          else if (hasUnserved) msg = language === 'km' ? "ព្រមាន៖ មុខម្ហូបខ្លះមិនទាន់លើកជូន..." : "Warning: Some items are not marked served. Finish anyway?";
    
          const confirm = await showConfirm(language === 'km' ? "បញ្ចប់ការលក់" : "Finish Order", msg);
          if (!confirm) return;
      } else {
          const confirm = await showConfirm(language === 'km' ? "បញ្ចប់ការលក់" : "Close Table/Room", language === 'km' ? "បញ្ចប់និងសម្អាត?" : "Finish current session and clear status?");
          if (!confirm) return;
      }

      const tableIdToClear = viewingTableId; 
      setSelectedTableOrder(null);
      setReplyText('');
      setMessages(prev => prev.filter(m => m.tableId !== tableIdToClear)); 
      setViewingTableId(null);
      await finishTableOrder(selectedTableOrder.id, tableIdToClear);
      showToast(language === 'km' ? "ការលក់ជោគជ័យ" : "Order completed", "success");
  };

  const getTableAlerts = (tableId: string) => {
      return messages.filter(m => m.tableId === tableId);
  };

  const getStatusColor = (status?: string) => {
      switch(status) {
          case 'served': return 'bg-green-100 text-green-700';
          case 'confirmed': return 'bg-blue-100 text-blue-700';
          case 'pending': return 'bg-orange-100 text-orange-700 animate-pulse';
          default: return 'bg-gray-100 text-gray-500';
      }
  };

  const getElapsed = (timestamp: number) => {
    const diff = currentTime - timestamp;
    if (diff < 0) return '0m';
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const chatMessages = getTableAlerts(viewingTableId || '').filter(m => m.type !== 'log');
  const logMessages = getTableAlerts(viewingTableId || '').filter(m => m.type === 'log');

  const filteredTables = tables.filter(t => {
      if (filter === 'all') return true;
      if (filter === 'available') return t.status === 'available';
      if (filter === 'occupied') return t.status === 'occupied';
      if (filter === 'alert') {
          const alerts = getTableAlerts(t.id);
          return alerts.some(m => m.type === 'alert_call' || m.type === 'alert_bill');
      }
      return true;
  });

  const downloadQr = (name: string) => {
      const svg = document.querySelector('#table-qr-container svg');
      if (!svg) return;
      
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      const size = 1000;
      canvas.width = size;
      canvas.height = size;
      
      img.onload = () => {
          if (ctx) {
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, size, size);
              const pngFile = canvas.toDataURL("image/png");
              const link = document.createElement("a");
              link.download = `${name.replace(/\s+/g, '_')}_Table_QR.png`;
              link.href = pngFile;
              link.click();
          }
      };
      
      // Handle unicode properly in base64
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // --- Calendar Logic ---
  const getDaysInMonth = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const nextMonth = () => {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() && 
             d1.getMonth() === d2.getMonth() && 
             d1.getFullYear() === d2.getFullYear();
  };

  const getBookingsForDate = (date: Date) => {
      return bookings.filter(b => isSameDay(new Date(b.time), date)).sort((a,b) => a.time - b.time);
  };

  const renderCalendar = () => {
      const daysInMonth = getDaysInMonth(currentDate);
      const startDay = getFirstDayOfMonth(currentDate);
      const today = new Date();
      
      const days = [];
      
      // Empty slots for previous month
      for (let i = 0; i < startDay; i++) {
          days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50/30 border border-gray-50"></div>);
      }

      // Actual days
      for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
          const dayBookings = getBookingsForDate(date);
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);

          days.push(
              <div 
                  key={day} 
                  onClick={() => setSelectedDate(date)}
                  className={`
                      h-24 border border-gray-100 p-1 cursor-pointer transition-colors relative flex flex-col items-start justify-start gap-1 overflow-hidden
                      ${isSelected ? 'bg-brand-50 border-brand-200' : 'hover:bg-gray-50'}
                      ${isToday ? 'bg-blue-50/50' : ''}
                  `}
              >
                  <span className={`
                      text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1
                      ${isToday ? 'bg-brand-600 text-white' : 'text-gray-700'}
                  `}>
                      {day}
                  </span>
                  
                  {/* Booking Info List */}
                  <div className="flex flex-col w-full gap-1">
                      {dayBookings.slice(0, 3).map((b, idx) => (
                          <div key={idx} className="bg-white/80 border border-gray-200 rounded text-[9px] px-1 py-0.5 truncate text-gray-700 font-medium w-full shadow-sm">
                              <span className="text-brand-600 font-bold mr-1">{new Date(b.time).getHours()}:{String(new Date(b.time).getMinutes()).padStart(2, '0')}</span>
                              {b.customerName}
                          </div>
                      ))}
                      {dayBookings.length > 3 && (
                          <div className="text-[9px] text-gray-400 font-bold pl-1">+{dayBookings.length - 3} more</div>
                      )}
                  </div>
              </div>
          );
      }

      return days;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-gray-100 flex flex-col md:flex-row justify-between items-center shadow-sm z-10 gap-3">
            <h1 className={`text-2xl font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>
                {activeTab === 'schedule' ? t('nav.bookings') : t('nav.tables')}
            </h1>
            
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
                {settings.enableBooking ? (
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl mr-2">
                        <button onClick={() => setActiveTab('layout')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'layout' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'}`}>{t('bk.layout')}</button>
                        <button onClick={() => setActiveTab('schedule')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'schedule' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'}`}>{t('bk.schedule')}</button>
                    </div>
                ) : null}

                {activeTab === 'layout' && (
                    <div className="flex items-center gap-2">
                        {['all', 'available', 'occupied', 'alert'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all border ${
                                    filter === f 
                                    ? 'bg-brand-600 text-white border-brand-600 shadow-md' 
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
            {activeTab === 'layout' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        <button onClick={() => setShowAddTable(true)} className="min-h-[180px] rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all group">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-brand-100 transition-colors mb-2">
                                <Plus size={24} />
                            </div>
                            <span className="font-bold text-sm">{t('bk.new_table')}</span>
                        </button>
                        
                        {filteredTables.map(table => {
                            const activeOrder = sales.find(s => s.tableId === table.id && s.orderStatus !== 'completed' && s.orderStatus !== 'cancelled');
                            const pendingCount = activeOrder?.items.filter(i => !i.status || i.status === 'pending').length || 0;
                            const cookingCount = activeOrder?.items.filter(i => i.status === 'confirmed').length || 0;
                            
                            const alerts = getTableAlerts(table.id);
                            const hasCall = alerts.some(m => m.type === 'alert_call');
                            const hasBill = alerts.some(m => m.type === 'alert_bill');
                            const hasMsg = alerts.some(m => m.type === 'text' && m.sender === 'customer');
                            
                            // Check for upcoming booking within next 24h
                            const nextBooking = bookings
                                .filter(b => b.tableId === table.id && b.time > Date.now() && b.time < Date.now() + 86400000)
                                .sort((a, b) => a.time - b.time)[0];

                            const isOccupied = table.status === 'occupied';

                            return (
                            <div 
                                key={table.id} 
                                className={`
                                    relative bg-white rounded-3xl p-5 shadow-sm border-2 transition-all flex flex-col gap-3 group
                                    ${hasCall || hasBill ? 'border-red-400 ring-4 ring-red-100 z-10' : (isOccupied ? 'border-brand-200' : 'border-gray-100 hover:border-brand-300 hover:shadow-lg')}
                                `}
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-xl text-gray-800 leading-none mb-1">{table.name}</h3>
                                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Users size={12}/> {table.capacity} Seats</span>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm ${
                                        isOccupied ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                    }`}>
                                        {isOccupied ? (language === 'km' ? 'រវល់' : 'BUSY') : (language === 'km' ? 'ទំនេរ' : 'FREE')}
                                    </div>
                                </div>

                                {/* Body */}
                                <div onClick={() => handleTableClick(table.id)} className="flex-1 cursor-pointer py-2">
                                    {/* Notifications */}
                                    {(hasCall || hasBill || hasMsg || activeOrder?.paymentProofUrl) && (
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {hasCall && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 animate-pulse shadow-sm"><Bell size={10} fill="currentColor" /> CALL</span>}
                                            {hasBill && <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 animate-pulse shadow-sm"><Receipt size={10} /> BILL</span>}
                                            {hasMsg && <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm"><MessageCircle size={10} /> MSG</span>}
                                            {activeOrder?.paymentProofUrl && <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-sm"><Check size={10} /> PAID?</span>}
                                        </div>
                                    )}

                                    {activeOrder ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold bg-gray-50 px-2 py-1 rounded-lg">
                                                    <Clock size={14} className="text-brand-500"/> 
                                                    {getElapsed(activeOrder.timestamp)}
                                                </div>
                                                <span className="font-black text-brand-600 text-lg">{formatPrice(activeOrder.total)}</span>
                                            </div>
                                            
                                            {isRestaurant && (
                                                <div className="flex gap-2 text-[10px] font-bold">
                                                    {pendingCount > 0 && <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-md flex-1 text-center border border-orange-100">{pendingCount} Pending</span>}
                                                    {cookingCount > 0 && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md flex-1 text-center border border-blue-100">{cookingCount} Cooking</span>}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-4 opacity-30">
                                            <Armchair size={40} className="mb-2 text-gray-400" />
                                            <span className="text-xs font-bold text-gray-400">{language === 'km' ? 'ទំនេរ' : 'Available'}</span>
                                        </div>
                                    )}

                                    {nextBooking && !activeOrder && (
                                        <div className="mt-2 bg-yellow-50 text-yellow-800 text-[10px] font-bold px-3 py-2 rounded-xl flex items-center gap-2 border border-yellow-100">
                                            <CalendarCheck size={14} />
                                            <span>Reserved: {new Date(nextBooking.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer Actions */}
                                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-50">
                                    <button 
                                        onClick={(e) => handleToggleOrdering(e, table)}
                                        className={`col-span-1 flex items-center justify-center p-2 rounded-xl transition-all active:scale-95 ${table.allowOrdering ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                                        title={table.allowOrdering ? 'Self-Ordering ON' : 'Self-Ordering OFF'}
                                    >
                                        <Power size={18} />
                                    </button>
                                    <button 
                                        onClick={() => setQrModal({tableId: table.id, name: table.name})}
                                        className="col-span-1 flex items-center justify-center p-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-brand-600 transition-colors active:scale-95"
                                        title="Show QR"
                                    >
                                        <QrIcon size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleTableClick(table.id)}
                                        className="col-span-2 bg-slate-900 text-white rounded-xl text-xs font-bold py-2 hover:bg-slate-800 transition-colors shadow-md shadow-slate-200 active:scale-95"
                                    >
                                        Manage
                                    </button>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            )}

            {activeTab === 'schedule' && (
                <div className="h-full flex flex-col md:flex-row gap-6">
                    {/* Left Side: Calendar & Detail */}
                    <div className="flex-1 flex flex-col gap-6">
                         
                         {/* Calendar Control */}
                         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                             <div className="flex justify-between items-center mb-6">
                                 <div className="flex items-center gap-4">
                                     <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
                                     <h2 className="text-xl font-bold text-gray-800">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                                     <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
                                 </div>
                                 <button onClick={() => setShowAddBooking(true)} className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-brand-200 flex items-center gap-2">
                                     <Plus size={16}/> {t('bk.book_btn')}
                                 </button>
                             </div>

                             <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                                 {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                     <div key={d} className="bg-gray-50 text-center text-xs font-bold text-gray-500 py-2">{d}</div>
                                 ))}
                                 {renderCalendar()}
                             </div>
                         </div>

                         {/* Selected Day Agenda */}
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex-1">
                             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                 <CalendarCheck size={18} className="text-brand-600"/> 
                                 Bookings for {selectedDate.toLocaleDateString()}
                             </h3>
                             
                             <div className="space-y-3">
                                 {getBookingsForDate(selectedDate).length === 0 ? (
                                     <p className="text-gray-400 text-sm text-center py-8">No bookings for this date.</p>
                                 ) : (
                                     getBookingsForDate(selectedDate).map(booking => (
                                         <div key={booking.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center hover:bg-brand-50 hover:border-brand-200 transition-colors cursor-pointer group">
                                             <div className="flex items-center gap-4">
                                                 <div className="bg-white p-2.5 rounded-lg shadow-sm font-bold text-brand-600 text-sm text-center min-w-[60px]">
                                                     {new Date(booking.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                 </div>
                                                 <div>
                                                     <h4 className="font-bold text-gray-800">{booking.customerName}</h4>
                                                     {booking.tableId && currentShop?.type === 'restaurant' && (
                                                         <span className="text-[10px] font-bold text-gray-500">
                                                             Table: {tables.find(t => t.id === booking.tableId)?.name || 'Unknown'}
                                                         </span>
                                                     )}
                                                     {booking.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{booking.notes}"</p>}
                                                 </div>
                                             </div>
                                             <div className="flex items-center gap-3">
                                                 <span className="bg-white text-gray-600 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">{booking.guests} {t('bk.guests')}</span>
                                                 {booking.phone && (
                                                     <a href={`tel:${booking.phone}`} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200">
                                                         <Info size={16} />
                                                     </a>
                                                 )}
                                             </div>
                                         </div>
                                     ))
                                 )}
                             </div>
                         </div>
                    </div>

                    {/* AI Sidebar */}
                    <div className="md:w-80 bg-white rounded-2xl shadow-card p-4 flex flex-col h-[50vh] md:h-auto border border-gray-100">
                        <div className="flex items-center gap-2 mb-4 text-brand-600"><Sparkles size={18} /><h3 className="font-bold">{t('bk.ai_assist')}</h3></div>
                        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-3 mb-3 text-sm text-gray-700">{aiResponse ? (<p className="whitespace-pre-wrap">{aiResponse}</p>) : (<p className="text-gray-400 italic">{currentShop?.type === 'restaurant' ? 'Ask about availability...' : 'Ask about appointment slots...'}</p>)}</div>
                        <div className="relative"><input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder={t('bk.ask_ai_ph')} className="w-full pl-3 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" onKeyDown={(e) => e.key === 'Enter' && askAi()} /><button onClick={askAi} disabled={aiLoading} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-600 hover:bg-brand-50 p-1 rounded-lg"><MessageSquare size={16} /></button></div>
                    </div>
                </div>
            )}
        </div>

        {viewingTableId && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out] flex flex-col max-h-[85vh]">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-lg text-gray-800">{tables.find(t => t.id === viewingTableId)?.name}</h3>
                        <div className="flex gap-2">
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button onClick={() => setDetailTab('order')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${detailTab === 'order' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'}`}>{language === 'km' ? 'ការកម្ម៉ង់' : 'Order'}</button>
                                <button onClick={() => setDetailTab('log')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${detailTab === 'log' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'}`}>{language === 'km' ? 'ប្រវត្តិ' : 'Log'}</button>
                            </div>
                            <button onClick={() => setViewingTableId(null)} className="p-2 bg-white rounded-full text-gray-500 hover:text-gray-800 shadow-sm"><X size={20} /></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-slate-50">
                        {detailTab === 'order' ? (
                            <>
                                <div className="p-4 bg-white mb-2">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase">{language === 'km' ? 'ការកម្ម៉ង់សកម្ម' : 'Active Order'}</h4>
                                        {/* Manual Status Toggle if needed */}
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => updateTable(viewingTableId, { status: 'available' })} 
                                                className={`text-[9px] px-2 py-1 rounded font-bold border ${tables.find(t => t.id === viewingTableId)?.status === 'available' ? 'bg-green-100 border-green-200 text-green-700' : 'border-gray-200 text-gray-400'}`}
                                            >
                                                {language === 'km' ? 'ទំនេរ' : 'Free'}
                                            </button>
                                            <button 
                                                onClick={() => updateTable(viewingTableId, { status: 'occupied' })} 
                                                className={`text-[9px] px-2 py-1 rounded font-bold border ${tables.find(t => t.id === viewingTableId)?.status === 'occupied' ? 'bg-red-100 border-red-200 text-red-700' : 'border-gray-200 text-gray-400'}`}
                                            >
                                                {language === 'km' ? 'រវល់' : 'Busy'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {selectedTableOrder ? (
                                        <div className="space-y-4">
                                            {selectedTableOrder.paymentProofUrl && (
                                                <div onClick={() => setViewProofModal(selectedTableOrder.paymentProofUrl || null)} className="bg-purple-50 border border-purple-100 p-3 rounded-xl mb-2 cursor-pointer hover:bg-purple-100 transition-colors group relative">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2 text-purple-700 font-bold text-xs"><ZoomIn size={14} /> Proof Uploaded</div>
                                                    </div>
                                                    <div className="relative overflow-hidden rounded-lg border border-purple-100 h-32 bg-white">
                                                        <img src={selectedTableOrder.paymentProofUrl} className="w-full h-full object-contain" />
                                                    </div>
                                                    {selectedTableOrder.orderStatus === 'pending_verification' && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleVerifyPayment(); }} className="w-full mt-3 bg-purple-600 text-white text-xs font-bold py-2 rounded-lg shadow-sm hover:bg-purple-700 flex items-center justify-center gap-2"><CheckCircle size={14} /> Verify</button>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                {selectedTableOrder.items.map((item, idx) => (
                                                    <div key={item.orderItemId || idx} className={`flex justify-between items-start p-2 rounded-lg border ${(!item.status || item.status === 'pending') ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2"><span className="font-bold text-sm text-gray-800">{item.quantity}x {item.name}</span></div>
                                                            {item.variantName && <p className="text-xs text-gray-400">{item.variantName}</p>}
                                                            {isRestaurant && (
                                                                <div className="flex flex-wrap gap-2 mt-1"><span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${getStatusColor(item.status || 'pending')}`}>{item.status || 'pending'}</span></div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="font-bold text-gray-600 text-sm">{formatPrice(item.price * item.quantity)}</span>
                                                            <button onClick={() => handleDeleteItem(item.orderItemId || '')} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {isRestaurant && selectedTableOrder.items.some(i => !i.status || i.status === 'pending') && (
                                                <button onClick={handleConfirmPending} className="w-full bg-brand-600 text-white text-xs font-bold py-3 rounded-xl shadow-md hover:bg-brand-700 animate-pulse mb-2">Confirm Pending Items</button>
                                            )}

                                            <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between items-center font-bold"><span>Total:</span><span className="text-brand-600 text-lg">{formatPrice(selectedTableOrder.total)}</span></div>
                                            <button onClick={handleFinishOrder} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><LogOut size={18} /> {isRestaurant ? (language === 'km' ? 'បញ្ចប់ការលក់ & សម្អាតតុ' : 'Finish & Clear Table') : (language === 'km' ? 'បញ្ចប់' : 'Close Table/Room')}</button>
                                        </div>
                                    ) : (<div className="text-center py-4 text-gray-400"><p className="text-xs">No active order</p></div>)}
                                </div>

                                <div className="p-4 bg-white">
                                    <div className="flex justify-between items-center mb-2"><h4 className="text-xs font-bold text-gray-400 uppercase">{language === 'km' ? 'សារ' : 'Chat'}</h4>{chatMessages.length > 0 && (<button onClick={() => handleClearMessages(viewingTableId)} className="text-[10px] text-red-500 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded"><Trash2 size={12} /> {language === 'km' ? 'លុប' : 'Clear'}</button>)}</div>
                                    <div className="space-y-2 mb-4">
                                        {chatMessages.length === 0 && <div className="text-center py-6 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200"><Info size={24} className="mx-auto mb-2 opacity-30"/><p className="text-xs">No messages.</p></div>}
                                        {chatMessages.map(msg => (<div key={msg.id} className={`flex ${msg.sender === 'staff' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.type !== 'text' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800 font-bold w-full text-center' : (msg.sender === 'staff' ? 'bg-brand-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none')}`}>{msg.message}</div></div>))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                    <div className="flex gap-2"><input className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500" placeholder={language === 'km' ? 'ឆ្លើយតប...' : 'Reply...'} value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendReply()} /><button onClick={handleSendReply} disabled={!replyText.trim()} className="bg-brand-600 text-white p-2 rounded-xl disabled:opacity-50"><Send size={18} /></button></div>
                                </div>
                            </>
                        ) : (
                            <div className="p-4 space-y-4">{/* Log View */}</div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {qrModal && (
             <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative animate-[scale-in_0.2s_ease-out]">
                    <button onClick={() => setQrModal(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20} /></button>
                    <div className="p-8 flex flex-col items-center">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">{qrModal.name}</h2>
                        <div className="bg-white p-4 rounded-2xl shadow-card border border-gray-100 mb-6" id="table-qr-container">
                            <ReactQRCode value={getTableUrl(qrModal.tableId)} size={200} level="M" fgColor="#312e81" bgColor="#FFFFFF" />
                        </div>
                        
                        <button 
                            onClick={() => downloadQr(qrModal.name)}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
                        >
                            <Download size={18} />
                            Download QR
                        </button>
                    </div>
                </div>
            </div>
        )}

        {viewProofModal && (
            <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setViewProofModal(null)}>
                <img src={viewProofModal} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
            </div>
        )}

        {showAddTable && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xs animate-[scale-in_0.2s_ease-out]">
                    <h3 className="font-bold text-lg mb-4">{t('bk.new_table')}</h3>
                    <input className="w-full p-2 border border-gray-200 rounded-lg mb-3" placeholder={t('bk.table_name')} value={newTable.name} onChange={e => setNewTable({...newTable, name: e.target.value})} />
                    <input type="number" className="w-full p-2 border border-gray-200 rounded-lg mb-4" placeholder={t('bk.capacity')} value={newTable.capacity} onChange={e => setNewTable({...newTable, capacity: parseInt(e.target.value)})} />
                    <div className="flex gap-2"><button onClick={() => setShowAddTable(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold text-gray-500">{t('common.cancel')}</button><button onClick={handleAddTable} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-bold">{t('common.add')}</button></div>
                </div>
            </div>
        )}

        {showAddBooking && (
             <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-[scale-in_0.2s_ease-out]">
                    <h3 className="font-bold text-lg mb-4">{t('bk.new_booking')}</h3>
                    <div className="space-y-3 mb-6">
                        <input className="w-full p-2 border border-gray-200 rounded-lg" placeholder={t('bk.cust_name')} value={newBooking.customerName} onChange={e => setNewBooking({...newBooking, customerName: e.target.value})} />
                        <input className="w-full p-2 border border-gray-200 rounded-lg" placeholder={t('set.phone')} value={newBooking.phone} onChange={e => setNewBooking({...newBooking, phone: e.target.value})} />
                        <input type="datetime-local" className="w-full p-2 border border-gray-200 rounded-lg" value={newBooking.time} onChange={e => setNewBooking({...newBooking, time: e.target.value})} />
                        
                        {/* Table Selector */}
                        <select 
                            className="w-full p-2 border border-gray-200 rounded-lg bg-white"
                            value={newBooking.tableId}
                            onChange={e => setNewBooking({...newBooking, tableId: e.target.value})}
                        >
                            <option value="">{language === 'km' ? 'មិនមានតុ' : 'No Table Assigned'}</option>
                            {tables.map(t => (
                                <option key={t.id} value={t.id}>{t.name} (Cap: {t.capacity})</option>
                            ))}
                        </select>

                        <input type="number" className="w-full p-2 border border-gray-200 rounded-lg" placeholder={t('bk.guests')} value={newBooking.guests} onChange={e => setNewBooking({...newBooking, guests: parseInt(e.target.value)})} />
                        <textarea className="w-full p-2 border border-gray-200 rounded-lg h-20" placeholder={t('bk.notes')} value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} />
                    </div>
                    <div className="flex gap-2"><button onClick={() => setShowAddBooking(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold text-gray-500">{t('common.cancel')}</button><button onClick={handleAddBooking} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-bold">{t('bk.book_btn')}</button></div>
                </div>
            </div>
        )}
    </div>
  );
}
