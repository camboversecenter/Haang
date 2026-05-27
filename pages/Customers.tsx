
import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { Search, Plus, User, Phone, DollarSign, Clock, ChevronRight, X, Wallet, History, ArrowDownLeft, ArrowUpRight, FileText, Mail, Edit2 } from 'lucide-react';
import { Sale, Customer } from '../types';
import ReceiptView from './ReceiptView';

export default function Customers() {
  const { customers, addCustomer, updateCustomer, repayDebt, t, language, formatPrice, settings, sales } = useStore();
  const { showToast } = useUI();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showRepayModal, setShowRepayModal] = useState<string | null>(null);
  
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Sale | null>(null);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [repayAmount, setRepayAmount] = useState('');

  const filteredCustomers = customers.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const totalDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0);

  const handleOpenAdd = () => {
      setEditingCustomer(null);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setShowModal(true);
  };

  const handleOpenEdit = (customer: Customer) => {
      setEditingCustomer(customer);
      setFormName(customer.name);
      setFormPhone(customer.phone || '');
      setFormEmail(customer.email || '');
      setShowModal(true);
  };

  const handleSave = async () => {
      if (!formName) return;
      
      if (editingCustomer) {
          await updateCustomer(editingCustomer.id, {
              name: formName,
              phone: formPhone,
              email: formEmail
          });
          showToast("Customer updated", "success");
      } else {
          await addCustomer(formName, formPhone, formEmail);
          showToast("Customer added", "success");
      }
      
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setShowModal(false);
  };

  const handleRepay = () => {
      if (!showRepayModal || !repayAmount) return;
      let amount = parseFloat(repayAmount);
      if (amount <= 0 || isNaN(amount)) return;
      
      repayDebt(showRepayModal, amount);
      setRepayAmount('');
      setShowRepayModal(null);
      showToast("Payment recorded", "success");
  };

  const getCustomerTransactions = (customerId: string) => {
      return sales.filter(s => {
          if (s.customerId !== customerId) return false;
          const isCreditPurchase = s.paymentMethod === 'credit';
          const isRepayment = s.items.some(i => i.id === 'debt-repay');
          return isCreditPurchase || isRepayment;
      }).sort((a, b) => b.timestamp - a.timestamp);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="p-4 bg-slate-50 sticky top-0 z-10 border-b border-gray-200/50">
          <div className="flex justify-between items-center mb-4">
              <h1 className={`text-2xl font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{t('nav.customers')}</h1>
              <button 
                onClick={handleOpenAdd}
                className="bg-brand-600 text-white px-3 py-2 rounded-xl text-sm font-bold shadow-lg shadow-brand-200 flex items-center gap-2"
              >
                  <Plus size={18} /> {t('common.add')}
              </button>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 mb-4 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">{t('cust.total_debt')}</p>
                  <p className="text-2xl font-black text-orange-600">{formatPrice(totalDebt)}</p>
              </div>
              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                  <Wallet size={20} />
              </div>
          </div>

          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
             <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('pos.search')}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border-none bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
             />
          </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-4 space-y-3 no-scrollbar">
          {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-white p-4 rounded-2xl shadow-card flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-sm border-2 border-white shadow-sm relative">
                          {customer.name.substring(0,2).toUpperCase()}
                          {customer.email && <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white" title="Linked"></div>}
                      </div>
                      <div>
                          <h3 className={`font-bold text-gray-900 ${language === 'km' ? 'font-display' : ''}`}>{customer.name}</h3>
                          <div className="flex flex-col">
                              {customer.phone && (
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                    <Phone size={10} /> {customer.phone}
                                </div>
                              )}
                              {customer.email && (
                                <div className="flex items-center gap-2 text-xs text-brand-600 mt-0.5">
                                    <Mail size={10} /> {customer.email}
                                </div>
                              )}
                          </div>
                      </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                          <p className={`font-bold text-lg ${customer.totalDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {customer.totalDebt > 0 ? `-${formatPrice(customer.totalDebt)}` : '0 ៛'}
                          </p>
                      </div>
                      <div className="flex gap-2">
                          <button 
                            onClick={() => handleOpenEdit(customer)}
                            className="text-gray-400 hover:text-brand-600 bg-gray-50 p-2 rounded-lg transition-colors"
                          >
                              <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setHistoryCustomer(customer)}
                            className="text-gray-400 hover:text-brand-600 bg-gray-50 p-2 rounded-lg transition-colors"
                            title="View History"
                          >
                              <History size={16} />
                          </button>
                          {customer.totalDebt > 0 && (
                              <button 
                                onClick={() => setShowRepayModal(customer.id)}
                                className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-2 rounded-lg hover:bg-brand-100 transition-colors"
                              >
                                  {t('cust.pay_debt')}
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          ))}
          {filteredCustomers.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No customers found.</div>
          )}
      </div>

      {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-xs animate-[scale-in_0.2s_ease-out]">
                  <h3 className="font-bold text-lg mb-4">{editingCustomer ? 'Edit Customer' : t('cust.new')}</h3>
                  
                  <div className="space-y-3 mb-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Name</label>
                          <input className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" value={formName} onChange={e => setFormName(e.target.value)} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Phone</label>
                          <input className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email (For Account Linking)</label>
                          <input className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="customer@gmail.com" type="email"/>
                      </div>
                  </div>

                  <div className="flex gap-2">
                      <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">{t('common.cancel')}</button>
                      <button onClick={handleSave} className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold">{t('common.save')}</button>
                  </div>
              </div>
          </div>
      )}

      {showRepayModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-xs animate-[scale-in_0.2s_ease-out]">
                  <h3 className="font-bold text-lg mb-4">{t('cust.pay_debt')}</h3>
                  <p className="text-sm text-gray-500 mb-4">
                      {t('cust.total_debt')}: <span className="font-bold text-red-500">{formatPrice(customers.find(c => c.id === showRepayModal)?.totalDebt || 0)}</span>
                  </p>
                  
                  <div className="relative mb-4">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">៛</span>
                      <input 
                        type="number"
                        className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-brand-500" 
                        placeholder="Amount in Riel"
                        value={repayAmount} 
                        onChange={e => setRepayAmount(e.target.value)} 
                        autoFocus 
                      />
                  </div>

                  <div className="flex gap-2">
                      <button onClick={() => setShowRepayModal(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">{t('common.cancel')}</button>
                      <button onClick={handleRepay} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200">{t('common.confirm')}</button>
                  </div>
              </div>
          </div>
      )}

      {historyCustomer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl animate-[scale-in_0.2s_ease-out]">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                      <div>
                          <h3 className={`font-bold text-lg text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{historyCustomer.name}</h3>
                          <p className="text-xs text-gray-500 font-bold">{t('cust.history')}</p>
                      </div>
                      <button onClick={() => setHistoryCustomer(null)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-200">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                      {getCustomerTransactions(historyCustomer.id).length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-gray-400">
                              <History size={48} className="mb-2 opacity-30" />
                              <p className="text-sm">No transaction history found.</p>
                          </div>
                      ) : (
                          getCustomerTransactions(historyCustomer.id).map(tx => {
                              const isRepayment = tx.items.some(i => i.id === 'debt-repay');
                              return (
                                  <div 
                                    key={tx.id} 
                                    onClick={() => setSelectedTransaction(tx)}
                                    className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-brand-300 transition-colors"
                                  >
                                      <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-full ${isRepayment ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                              {isRepayment ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                          </div>
                                          <div>
                                              <p className="font-bold text-sm text-gray-800">
                                                  {isRepayment ? t('cust.payment_received') : t('cust.credit_purchase')}
                                              </p>
                                              <p className="text-[10px] text-gray-400">
                                                  {new Date(tx.timestamp).toLocaleDateString()} • {new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                              </p>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className={`font-bold ${isRepayment ? 'text-green-600' : 'text-red-500'}`}>
                                              {isRepayment ? '+' : '-'}{formatPrice(tx.total)}
                                          </p>
                                          <div className="flex items-center justify-end gap-1 text-[10px] text-brand-500 font-bold mt-0.5">
                                              <FileText size={10} /> {t('common.view')}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })
                      )}
                  </div>
                  
                  <div className="p-4 border-t border-gray-100 bg-white rounded-b-3xl">
                      <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-bold text-gray-500">{t('cust.total_debt')}</span>
                          <span className={`text-xl font-black ${historyCustomer.totalDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {formatPrice(historyCustomer.totalDebt)}
                          </span>
                      </div>
                      <button 
                        onClick={() => { setHistoryCustomer(null); setShowRepayModal(historyCustomer.id); }}
                        disabled={historyCustomer.totalDebt <= 0}
                        className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-50 disabled:shadow-none transition-all"
                      >
                          {t('cust.pay_debt')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
            <div className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md bg-transparent md:bg-white rounded-none md:rounded-2xl overflow-hidden flex flex-col">
                 <div className="absolute top-4 right-4 z-50 md:z-10">
                    <button 
                        onClick={() => setSelectedTransaction(null)}
                        className="bg-white/20 md:bg-gray-100 p-2 rounded-full text-white md:text-gray-600 hover:bg-white/40 md:hover:bg-gray-200 transition-colors backdrop-blur-md"
                    >
                        <X size={24} />
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto bg-slate-100 md:bg-white no-scrollbar">
                     <ReceiptView sale={selectedTransaction} onBack={() => setSelectedTransaction(null)} />
                 </div>
            </div>
        </div>
      )}
    </div>
  );
}
