import React, { useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Sparkles, TrendingUp, DollarSign, Package, TrendingDown, Wallet, Plus, Calendar, X, ArrowDownCircle, ArrowUpCircle, Users, Filter, Tag, Percent, Loader2 } from 'lucide-react';
import { generateBusinessInsight } from '../services/geminiService';
import { ExpenseCategory, Sale, Expense } from '../types';

type FilterType = 'month' | 'year' | 'custom';

export default function Dashboard() {
  const { products, customers, language, t, addExpense, getDashboardMetrics, formatPrice } = useStore();
  const { showToast } = useUI();
  
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metrics, setMetrics] = useState<{
      revenue: number,
      expenses: number,
      transactions: number,
      tax: number,
      discount: number,
      topProducts: {name: string, sales: number}[]
  }>({ revenue: 0, expenses: 0, transactions: 0, tax: 0, discount: 0, topProducts: [] });

  const [insight, setInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // --- Filtering State ---
  const [filterType, setFilterType] = useState<FilterType>('month');
  const [dateRange, setDateRange] = useState<{start: number, end: number}>({ start: 0, end: 0 });
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // --- Filter Logic ---
  useEffect(() => {
      const now = new Date();
      let start = 0;
      let end = now.getTime();

      if (filterType === 'month') {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          start = firstDay.getTime();
      } else if (filterType === 'year') {
          const firstDay = new Date(now.getFullYear(), 0, 1);
          start = firstDay.getTime();
      } else if (filterType === 'custom') {
          // If custom dates are set, use them
          if (customStart) start = new Date(customStart).getTime();
          if (customEnd) {
              const e = new Date(customEnd);
              e.setHours(23, 59, 59, 999); // End of selected day
              end = e.getTime();
          }
      }
      
      setDateRange({ start, end });
  }, [filterType, customStart, customEnd]);

  // --- Fetch Metrics on Range Change ---
  useEffect(() => {
      const loadMetrics = async () => {
          if (dateRange.start === 0) return;
          setLoadingMetrics(true);
          const data = await getDashboardMetrics(dateRange.start, dateRange.end);
          setMetrics(data);
          setLoadingMetrics(false);
      };
      loadMetrics();
  }, [dateRange, getDashboardMetrics]);

  // --- Expense Modal State ---
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
      amount: '',
      category: 'restock' as ExpenseCategory,
      note: '',
      date: new Date().toISOString().slice(0, 10)
  });

  // --- Metrics Calculation ---
  const netProfit = metrics.revenue - metrics.expenses;
  const lowStockCount = products.filter(p => p.stock < 5 && p.trackStock !== false).length;
  const totalOutstandingDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0); 

  const handleGetInsight = async () => {
    setLoadingAi(true);
    // Construct minimal sales data structure for AI context based on aggregates
    // Since we don't have all sale objects in memory, we pass the aggregates
    const mockSalesForAi: Sale[] = Array(metrics.transactions).fill({ total: metrics.revenue / (metrics.transactions || 1) } as any);
    const result = await generateBusinessInsight(mockSalesForAi, products, language);
    setInsight(result);
    setLoadingAi(false);
  };

  const handleSaveExpense = () => {
      const val = parseFloat(expenseForm.amount);
      if (isNaN(val) || val <= 0) {
          showToast(t('toast.valid_amount'), "error");
          return;
      }

      addExpense({
          amount: val, // Assumed Riel directly
          category: expenseForm.category,
          note: expenseForm.note,
          date: new Date(expenseForm.date).getTime()
      });

      // Optimistic Update
      setMetrics(prev => ({...prev, expenses: prev.expenses + val}));

      showToast(t('toast.exp_added'), "success");
      setShowExpenseModal(false);
      setExpenseForm({ ...expenseForm, amount: '', note: '' });
  };

  const categories: {id: ExpenseCategory, label: string, icon: string}[] = [
      { id: 'restock', label: t('exp.restock'), icon: '📦' },
      { id: 'salary', label: t('exp.salary'), icon: '👷' },
      { id: 'rent', label: t('exp.rent'), icon: '🏠' },
      { id: 'utilities', label: t('exp.utilities'), icon: '💡' },
      { id: 'other', label: t('exp.other'), icon: '📝' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto no-scrollbar relative">
      <div className="p-5 space-y-5 pb-24 md:pb-5">
        
        {/* --- Header with Filter --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <h2 className={`text-xl font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{t('dash.sales_summary')}</h2>
             
             <div className="flex flex-wrap gap-2 items-center">
                 {/* Filter Type Toggle */}
                 <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex">
                     <button 
                        onClick={() => setFilterType('month')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'month' ? 'bg-brand-50 text-brand-600' : 'text-gray-500'}`}
                     >
                         {t('dash.this_month')}
                     </button>
                     <button 
                        onClick={() => setFilterType('year')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'year' ? 'bg-brand-50 text-brand-600' : 'text-gray-500'}`}
                     >
                         {t('dash.this_year')}
                     </button>
                     <button 
                        onClick={() => setFilterType('custom')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'custom' ? 'bg-brand-50 text-brand-600' : 'text-gray-500'}`}
                     >
                         {t('dash.custom')}
                     </button>
                 </div>

                 <button 
                    onClick={() => setShowExpenseModal(true)}
                    className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2 hover:bg-red-100 transition-colors ml-auto md:ml-0"
                 >
                     <MinusCircleIcon />
                     <span className={language === 'km' ? 'font-display' : ''}>{t('dash.add_expense')}</span>
                 </button>
             </div>
        </div>

        {/* Custom Date Inputs (Visible only when filterType is custom) */}
        {filterType === 'custom' && (
            <div className="flex items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100 animate-in slide-in-from-top-2">
                <div className="flex-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">{t('dash.start_date')}</label>
                    <input 
                        type="date" 
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full text-xs font-bold text-gray-700 bg-transparent outline-none"
                    />
                </div>
                <div className="w-px h-8 bg-gray-100"></div>
                <div className="flex-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">{t('dash.end_date')}</label>
                    <input 
                        type="date" 
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full text-xs font-bold text-gray-700 bg-transparent outline-none"
                    />
                </div>
            </div>
        )}

        {/* Loading Overlay for Metrics */}
        {loadingMetrics && (
            <div className="text-center py-4">
                <Loader2 className="animate-spin mx-auto text-brand-600" />
            </div>
        )}

        {/* Key Metrics Grid */}
        {!loadingMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Income */}
            <div className="bg-white p-5 rounded-3xl shadow-card border-b-4 border-green-500 md:col-span-2">
                <div className="flex justify-between items-start mb-2">
                    <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                        <ArrowDownCircle size={20} className="rotate-180" />
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dash.income')}</span>
                </div>
                <p className="text-2xl font-black text-gray-800">{formatPrice(metrics.revenue)}</p>
                <p className="text-xs text-gray-400 mt-1">{metrics.transactions} transactions</p>
            </div>

            {/* Expense */}
            <div className="bg-white p-5 rounded-3xl shadow-card border-b-4 border-red-500 md:col-span-2">
                <div className="flex justify-between items-start mb-2">
                     <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                        <ArrowDownCircle size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dash.expense')}</span>
                </div>
                <p className="text-2xl font-black text-gray-800">{formatPrice(metrics.expenses)}</p>
            </div>

            {/* Net Profit */}
            <div className={`bg-white p-5 rounded-3xl shadow-card border-b-4 md:col-span-2 ${netProfit >= 0 ? 'border-brand-500' : 'border-gray-500'}`}>
                <div className="flex justify-between items-start mb-2">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${netProfit >= 0 ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-600'}`}>
                        <Wallet size={20} />
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dash.profit')}</span>
                </div>
                <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-brand-600' : 'text-gray-600'}`}>
                    {formatPrice(netProfit)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{language === 'km' ? 'លំហូរសាច់ប្រាក់' : 'Cash Flow'}</p>
            </div>

             {/* VAT Report */}
             <div className="bg-white p-4 rounded-3xl shadow-card border-b-4 border-purple-400">
                <div className="flex justify-between items-start mb-2">
                     <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                        <Percent size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">{t('dash.total_vat')}</span>
                </div>
                <p className="text-lg font-black text-purple-600">{formatPrice(metrics.tax)}</p>
            </div>

            {/* Discount Report */}
            <div className="bg-white p-4 rounded-3xl shadow-card border-b-4 border-teal-400">
                <div className="flex justify-between items-start mb-2">
                     <div className="w-8 h-8 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center">
                        <Tag size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">{t('dash.total_discount')}</span>
                </div>
                <p className="text-lg font-black text-teal-600">{formatPrice(metrics.discount)}</p>
            </div>

             {/* Outstanding Debt (Lifetime) */}
            <div className="bg-white p-4 rounded-3xl shadow-card border-b-4 border-orange-400">
                <div className="flex justify-between items-start mb-2">
                     <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                        <Users size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">{t('dash.credit')}</span>
                </div>
                <p className="text-lg font-black text-orange-500">{formatPrice(totalOutstandingDebt)}</p>
            </div>
        </div>
        )}

        {/* Low Stock Alert Banner */}
        {lowStockCount > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3">
                <Package className="text-orange-500" size={24} />
                <div>
                    <h3 className="font-bold text-orange-700 text-sm">{t('dash.inventory_alert')}</h3>
                    <p className="text-xs text-orange-600">{lowStockCount} {t('inv.low_stock')}</p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Chart */}
            <div className="bg-white p-6 rounded-3xl shadow-card">
                <h2 className={`font-bold text-lg mb-6 text-slate-800 ${language === 'km' ? 'font-display' : ''}`}>{t('dash.top_selling')}</h2>
                {!loadingMetrics && metrics.topProducts.length > 0 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.topProducts}>
                                <XAxis dataKey="name" fontSize={11} tick={{fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                                <YAxis fontSize={11} tick={{fill: '#94a3b8'}} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'}}
                                    cursor={{fill: '#f1f5f9', radius: 4}}
                                />
                                <Bar dataKey="sales" radius={[6, 6, 6, 6]} barSize={40}>
                                    {metrics.topProducts.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                        {loadingMetrics ? 'Loading...' : (language === 'km' ? 'មិនមានទិន្នន័យលក់ទេ។' : 'No sales data for this period.')}
                    </div>
                )}
            </div>

            {/* AI Insight Section */}
            <div className="relative overflow-hidden bg-brand-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-brand-500/30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent-500/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md border border-white/10">
                            <Sparkles className="text-yellow-300" size={20} />
                        </div>
                        <h2 className={`text-xl font-bold ${language === 'km' ? 'font-display' : ''}`}>
                            {t('dash.ai_insight')}
                        </h2>
                    </div>
                    
                    {!insight ? (
                        <div className="py-2">
                            <p className="mb-6 text-brand-100 font-medium leading-relaxed max-w-lg">
                                {language === 'km' 
                                ? "AI របស់យើងនឹងវិភាគទិន្នន័យរបស់អ្នកដើម្បីផ្តល់យុទ្ធសាស្ត្រលក់ដ៏ឆ្លាតវៃ។" 
                                : "Our AI analyzes your transaction history to provide actionable strategies for growth."}
                            </p>
                            <button 
                                onClick={handleGetInsight}
                                disabled={loadingAi}
                                className="bg-white text-brand-600 px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-black/5 hover:bg-brand-50 transition-all active:scale-95 disabled:opacity-80 flex items-center gap-2"
                            >
                                {loadingAi ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>{language === 'km' ? 'កំពុងវិភាគ...' : 'Analyzing Data...'}</span>
                                    </>
                                ) : (
                                    <span>{t('dash.ask_ai')}</span>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white/10 rounded-2xl p-5 backdrop-blur-md border border-white/10">
                            <div className={`prose prose-invert prose-sm max-w-none ${language === 'km' ? 'font-display leading-loose' : ''}`}>
                                {insight.split('\n').map((line, i) => (
                                    <p key={i} className="mb-2 last:mb-0">{line}</p>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                                <button 
                                    onClick={() => setInsight(null)}
                                    className="text-xs font-bold text-brand-200 hover:text-white uppercase tracking-wider"
                                >
                                    {language === 'km' ? 'វិភាគម្តងទៀត' : 'Refresh Analysis'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-[scale-in_0.2s_ease-out] shadow-2xl">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className={`font-bold text-lg text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>
                        {t('dash.add_expense')}
                    </h3>
                    <button onClick={() => setShowExpenseModal(false)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-800">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('inv.price')} (៛)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                                ៛
                            </span>
                            <input 
                                type="number" 
                                value={expenseForm.amount}
                                onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                                className="w-full pl-10 pr-4 py-3.5 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-500 font-bold text-lg"
                                placeholder="0"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('inv.category')}</label>
                         <div className="grid grid-cols-2 gap-2">
                             {categories.map(cat => (
                                 <button
                                    key={cat.id}
                                    onClick={() => setExpenseForm({...expenseForm, category: cat.id})}
                                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-sm font-bold transition-all ${
                                        expenseForm.category === cat.id 
                                        ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm' 
                                        : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                                    }`}
                                 >
                                     <span>{cat.icon}</span>
                                     <span className={language === 'km' ? 'font-display' : ''}>{cat.label}</span>
                                 </button>
                             ))}
                         </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="date"
                                value={expenseForm.date}
                                onChange={e => setExpenseForm({...expenseForm, date: e.target.value})}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-500 text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Note (Optional)</label>
                        <input 
                            value={expenseForm.note}
                            onChange={e => setExpenseForm({...expenseForm, note: e.target.value})}
                            className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-500 text-sm"
                            placeholder="..."
                        />
                    </div>

                    <button 
                        onClick={handleSaveExpense}
                        className="w-full py-4 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all mt-4"
                    >
                        {t('set.save')}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

const MinusCircleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);