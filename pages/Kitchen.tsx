
import React, { useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { ChefHat, Clock, CheckCircle, Flame, Check, Loader2 } from 'lucide-react';
import { OrderItemStatus } from '../types';
import { supabase } from '../services/supabaseClient';

export default function Kitchen() {
  const { sales, tables, updateOrderItemStatus, t, language, refreshSales, currentShop } = useStore();

  // Translations specifically for Kitchen
  const K_TEXT: any = {
      en: {
          title: "Kitchen Display",
          live: "Live",
          empty: "All orders completed!",
          pending: "To Cook",
          cooking: "Cooking",
          done: "Done",
          elapsed: "m",
          tap_hint: "Tap item to change status"
      },
      km: {
          title: "អេក្រង់ផ្ទះបាយ",
          live: "ផ្ទាល់",
          empty: "មិនមានការកម្ម៉ង់ទេ!",
          pending: "ចម្អិន",
          cooking: "កំពុងចម្អិន",
          done: "រួចរាល់",
          elapsed: "នាទី",
          tap_hint: "ចុចលើមុខម្ហូបដើម្បីប្តូរស្ថានភាព"
      }
  };

  const txt = K_TEXT[language] || K_TEXT['en'];

  // Real-time listener for Sales updates
  useEffect(() => {
      if (!currentShop) return;

      const channel = supabase
        .channel('kitchen-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sales', filter: `shop_id=eq.${currentShop.id}` },
          (payload) => {
            refreshSales(); // Trigger global refresh when DB changes
          }
        )
        .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [currentShop]);

  // Filter for active orders (confirmed, cooking)
  // We explicitly show items that are 'confirmed' (by staff) or 'cooking' (by chef).
  // We ignore 'pending' (not sent yet) and 'served' (completed).
  const activeOrders = sales
    .filter(s => 
        (s.orderStatus === 'pending' || s.orderStatus === 'pending_verification' || s.orderStatus === 'confirmed') && 
        s.items.some(i => (i.status === 'confirmed' || i.status === 'cooking') && i.status !== 'cancelled')
    )
    .sort((a, b) => a.timestamp - b.timestamp); // FIFO: Oldest orders first

  const handleItemStatus = (saleId: string, itemId: string, currentStatus?: OrderItemStatus) => {
      let nextStatus: OrderItemStatus = 'cooking'; 
      
      // Workflow: Confirmed -> Cooking -> Served
      if (!currentStatus || currentStatus === 'confirmed') {
          nextStatus = 'cooking'; // Chef starts cooking
      } else if (currentStatus === 'cooking') {
          nextStatus = 'served'; // Chef finishes
      }

      updateOrderItemStatus(saleId, itemId, nextStatus);
  };

  const getElapsedTime = (timestamp: number) => {
      const diff = Date.now() - timestamp;
      const minutes = Math.floor(diff / 60000);
      return `${minutes}${txt.elapsed}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-800 shadow-md z-10 flex justify-between items-center border-b border-slate-700">
            <h1 className={`text-xl font-bold flex items-center gap-2 ${language === 'km' ? 'font-display' : ''}`}>
                <ChefHat className="text-orange-500" />
                {txt.title}
            </h1>
            <div className="flex items-center gap-2 text-sm font-bold bg-slate-700 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                {txt.live}
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
            {activeOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <CheckCircle size={64} className="mb-4 opacity-20" />
                    <p className={`text-lg font-bold ${language === 'km' ? 'font-display' : ''}`}>{txt.empty}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activeOrders.map(order => {
                        const tableName = tables.find(t => t.id === order.tableId)?.name || 'Unknown';
                        // Only show items relevant to kitchen
                        const relevantItems = order.items.filter(i => (i.status === 'confirmed' || i.status === 'cooking') && i.status !== 'cancelled');
                        
                        if (relevantItems.length === 0) return null;

                        return (
                            <div key={order.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col shadow-lg animate-[scale-in_0.2s_ease-out]">
                                {/* Ticket Header */}
                                <div className="bg-slate-700 p-3 flex justify-between items-center">
                                    <div>
                                        <h3 className={`font-bold text-lg text-white ${language === 'km' ? 'font-display' : ''}`}>{tableName}</h3>
                                        <p className="text-xs text-slate-400 font-mono">#{order.id.slice(-4)}</p>
                                    </div>
                                    <div className="bg-slate-900 px-2 py-1 rounded text-orange-400 font-mono font-bold text-sm">
                                        {getElapsedTime(order.timestamp)}
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="p-2 flex-1 space-y-2">
                                    {relevantItems.map((item, idx) => (
                                        <div 
                                            key={item.orderItemId || idx} 
                                            onClick={() => handleItemStatus(order.id, item.orderItemId || '', item.status)}
                                            className={`p-3 rounded-lg cursor-pointer transition-all border-l-4 flex justify-between items-start ${
                                                item.status === 'cooking' 
                                                ? 'bg-blue-900/30 border-blue-500 hover:bg-blue-900/50' 
                                                : 'bg-yellow-900/20 border-yellow-500 hover:bg-yellow-900/30'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-start gap-2">
                                                    <span className="font-bold text-lg text-white">{item.quantity}x</span>
                                                    <div>
                                                        <span className={`font-bold text-white ${language === 'km' ? 'font-display' : ''}`}>{item.name}</span>
                                                        {item.variantName && (
                                                            <p className="text-xs text-slate-400">{item.variantName}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-1">
                                                {item.status === 'cooking' ? (
                                                    <div className="bg-blue-500 text-white px-2 py-1 rounded-md flex items-center gap-1 font-bold text-[10px] animate-pulse">
                                                        <Flame size={12} fill="currentColor" /> {txt.cooking}
                                                    </div>
                                                ) : (
                                                    <div className="text-yellow-500 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/50">
                                                        {txt.pending}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Ticket Footer */}
                                <div className="p-2 bg-slate-800/50 border-t border-slate-700">
                                    <div className={`text-center text-xs text-slate-500 ${language === 'km' ? 'font-display' : ''}`}>
                                        {txt.tap_hint}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
  );
}
