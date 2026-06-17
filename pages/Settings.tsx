import React, { useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { Save, Settings as SettingsIcon, Coins, Percent, RefreshCw, Globe, Calendar, ToggleLeft, ToggleRight, Store, MapPin, Phone, Upload, Loader2, Edit2, Layers, Sparkles, LogOut, Users, Plus, Trash2, Key, Tag, Clock, X, ShoppingBag, Utensils, CreditCard, QrCode, Printer, Bluetooth } from 'lucide-react';
import { uploadProductImage, deleteFile } from '../services/storageService';
import { generateLogo } from '../services/geminiService';
import { Staff, StaffRole, DiscountRule, DiscountType, PaymentMethod } from '../types';

export default function Settings() {
  const { settings, updateSettings, updateShop, currentShop, t, language, signOut, staffList, addStaff, updateStaff, deleteStaff, discountRules, addDiscountRule, deleteDiscountRule, categories, products, setLanguage, paymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, connectPrinter, printerConnected } = useStore();
  const { showToast, showAlert, showConfirm } = useUI();
  
  const [activeTab, setActiveTab] = useState<'general' | 'staff' | 'discounts' | 'payments' | 'hardware'>('general');

  const [form, setForm] = useState({
      taxRate: 0,
      enablePublicStore: true,
      enableBooking: false,
      enableAttributes: false,
      enableMultiRoles: false,
      defaultLanguage: 'km'
  });

  const [profileForm, setProfileForm] = useState<{
      name: string;
      address: string;
      phone: string;
      logoUrl: string;
      type: 'retail' | 'restaurant';
  }>({
      name: '',
      address: '',
      phone: '',
      logoUrl: '',
      type: 'retail'
  });

  // ... (Staff, Discount, Payment States unchanged) ...
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState<Partial<Staff>>({ name: '', pin: '', role: 'cashier' });

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountForm, setDiscountForm] = useState<{
      name: string;
      type: DiscountType;
      value: number;
      ruleType: 'simple' | 'bulk' | 'category' | 'loyalty' | 'weekly' | 'period' | 'time';
      targetIds: string[]; 
      minQty?: number;
      startDate?: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      days: number[];
  }>({ name: '', type: 'percentage', value: 10, ruleType: 'simple', days: [], targetIds: [] });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<Partial<PaymentMethod>>({ name: '', accountName: '', accountNumber: '', qrCodeUrl: '' });
  const [pendingQrFile, setPendingQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);

  const daysOfWeek = [
      { id: 1, label: 'Mo' }, { id: 2, label: 'Tu' }, { id: 3, label: 'We' },
      { id: 4, label: 'Th' }, { id: 5, label: 'Fr' }, { id: 6, label: 'Sa' },
      { id: 0, label: 'Su' }
  ];

  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingLogo, setGeneratingLogo] = useState(false);

  useEffect(() => {
      if (settings) {
        setForm({
            taxRate: settings.taxRate,
            enablePublicStore: settings.enablePublicStore ?? true,
            enableBooking: settings.enableBooking ?? false,
            enableAttributes: settings.enableAttributes ?? false,
            enableMultiRoles: settings.enableMultiRoles ?? false,
            defaultLanguage: settings.defaultLanguage ?? 'km'
        });
      }
      if (currentShop) {
          setProfileForm({
              name: currentShop.name,
              address: currentShop.address || '',
              phone: currentShop.phone || '',
              logoUrl: currentShop.logoUrl || '',
              type: currentShop.type || 'retail'
          });
          setLogoPreview(currentShop.logoUrl || null);
      }
  }, [settings, currentShop]);

  const handleSave = async () => {
      setSaving(true);
      try {
          let finalLogoUrl = profileForm.logoUrl;
          
          if (pendingLogoFile) {
              if (finalLogoUrl && !finalLogoUrl.startsWith('blob:')) {
                  try {
                      await deleteFile(finalLogoUrl, 'Haang');
                  } catch (err) {
                      console.warn('Failed to delete old logo:', err);
                  }
                  finalLogoUrl = '';
              }

              const newUrl = await uploadProductImage(pendingLogoFile, 'Haang');
              if (newUrl) {
                  finalLogoUrl = newUrl;
              } else {
                  showToast("Failed to upload new logo", "error");
              }
          }

          updateSettings({
              taxRate: Number(form.taxRate),
              enablePublicStore: form.enablePublicStore,
              enableBooking: form.enableBooking,
              enableAttributes: form.enableAttributes,
              enableMultiRoles: form.enableMultiRoles,
              defaultLanguage: form.defaultLanguage as any
          });

          updateShop({
              name: profileForm.name,
              address: profileForm.address,
              phone: profileForm.phone,
              logoUrl: finalLogoUrl,
              type: profileForm.type
          });

          setPendingLogoFile(null);
          showToast(t('toast.settings_saved'), "success");
      } catch (error) {
          console.error("Failed to save settings", error);
          showToast("Failed to save settings", "error");
      } finally {
          setSaving(false);
      }
  };

  // ... (Other handlers identical: handleLogoUpload, handleGenerateLogo, staff, discount, payment) ...
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setPendingLogoFile(file);
          setLogoPreview(URL.createObjectURL(file)); 
      }
  };

  const handleGenerateLogo = async () => {
    if (!profileForm.name.trim()) {
      showToast(t('toast.enter_shop_name'), "error");
      return;
    }
    setGeneratingLogo(true);
    const file = await generateLogo(profileForm.name);
    if (file) {
      setPendingLogoFile(file);
      setLogoPreview(URL.createObjectURL(file)); 
      showToast(t('toast.logo_gen'), "success");
    } else {
      showAlert(t('alert.gen_fail_title'), t('alert.gen_fail_msg'));
    }
    setGeneratingLogo(false);
  };

  const handleOpenStaffModal = (staff?: Staff) => {
      if (staff) {
          setEditingStaff(staff);
          setStaffForm({ name: staff.name, pin: staff.pin, role: staff.role });
      } else {
          setEditingStaff(null);
          setStaffForm({ name: '', pin: '', role: 'cashier' });
      }
      setShowStaffModal(true);
  };

  const handleSaveStaff = async () => {
      if (!staffForm.name || !staffForm.pin) {
          showToast(t('toast.fill_name_pin'), "error");
          return;
      }
      if (staffForm.pin.length !== 6) {
          showToast(t('toast.pin_len'), "error");
          return;
      }

      if (editingStaff) {
          await updateStaff(editingStaff.id, staffForm);
          showToast(t('toast.staff_updated'), "success");
      } else {
          await addStaff(staffForm);
          showToast(t('toast.staff_added'), "success");
      }
      setShowStaffModal(false);
  };

  const handleDeleteStaff = async (id: string) => {
      const confirm = await showConfirm(t('confirm.del_staff_title'), t('confirm.del_staff_msg'));
      if (confirm) {
          await deleteStaff(id);
          showToast(t('toast.staff_deleted'), "success");
      }
  };

  const handleSaveDiscount = async () => {
      if (!discountForm.name) {
          showToast("Please enter a name", "error");
          return;
      }

      const conditions: any = {};
      // ... (Discount logic identical) ...
      if (discountForm.targetIds.length > 0) {
          if (discountForm.ruleType === 'category') {
              conditions.categoryIds = discountForm.targetIds;
          } else {
              conditions.productIds = discountForm.targetIds;
          }
      }

      if (discountForm.ruleType === 'bulk') {
          conditions.minQty = discountForm.minQty || 10;
      } else if (discountForm.ruleType === 'loyalty') {
          conditions.customerType = 'repeat';
      }

      if (discountForm.ruleType === 'period') {
          if (!discountForm.startDate || !discountForm.endDate) {
              showToast("Please select both start and end dates", "error");
              return;
          }
          conditions.startDate = new Date(discountForm.startDate).getTime();
          conditions.endDate = new Date(discountForm.endDate).getTime();
      }

      if (discountForm.ruleType === 'time') {
           if (!discountForm.startTime || !discountForm.endTime) {
              showToast("Please select both start and end times", "error");
              return;
           }
           conditions.startTime = discountForm.startTime;
           conditions.endTime = discountForm.endTime;
      }

      if (discountForm.startDate && discountForm.ruleType !== 'period') conditions.startDate = new Date(discountForm.startDate).getTime();
      if (discountForm.endDate && discountForm.ruleType !== 'period') conditions.endDate = new Date(discountForm.endDate).getTime();
      
      if (discountForm.days.length > 0) {
          conditions.daysOfWeek = discountForm.days;
      } else if (discountForm.ruleType === 'weekly' && discountForm.days.length === 0) {
          showToast("Please select at least one day for Weekly rule", "error");
          return;
      }

      addDiscountRule({
          name: discountForm.name,
          type: discountForm.type,
          value: Number(discountForm.value),
          conditions: conditions
      });

      setShowDiscountModal(false);
      setDiscountForm({ name: '', type: 'percentage', value: 10, ruleType: 'simple', days: [], targetIds: [] });
      showToast(t('toast.rule_added'), "success");
  };

  const handleDeleteDiscount = async (id: string) => {
      const confirm = await showConfirm(t('confirm.del_rule_title'), t('confirm.del_rule_msg'));
      if (confirm) deleteDiscountRule(id);
  };

  const toggleDay = (day: number) => {
      setDiscountForm(prev => {
          if (prev.days.includes(day)) {
              return { ...prev, days: prev.days.filter(d => d !== day) };
          } else {
              return { ...prev, days: [...prev.days, day] };
          }
      });
  };

  const handleOpenPaymentModal = (pm?: PaymentMethod) => {
      if (pm) {
          setEditingPaymentId(pm.id);
          setPaymentForm({
              name: pm.name,
              accountName: pm.accountName,
              accountNumber: pm.accountNumber,
              qrCodeUrl: pm.qrCodeUrl,
              active: pm.active
          });
          setQrPreview(pm.qrCodeUrl || null);
      } else {
          setEditingPaymentId(null);
          setPaymentForm({ name: '', accountName: '', accountNumber: '', qrCodeUrl: '' });
          setQrPreview(null);
      }
      setPendingQrFile(null);
      setShowPaymentModal(true);
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setPendingQrFile(file);
          setQrPreview(URL.createObjectURL(file));
      }
  };

  const handleSavePayment = async () => {
      if (!paymentForm.name) {
          showToast("Please enter a name", "error");
          return;
      }

      setIsUploadingQr(true);
      let qrUrl = paymentForm.qrCodeUrl;
      
      if (pendingQrFile) {
          const uploaded = await uploadProductImage(pendingQrFile, 'Haang');
          if (uploaded) qrUrl = uploaded;
      }

      if (editingPaymentId) {
          await updatePaymentMethod(editingPaymentId, {
              ...paymentForm,
              qrCodeUrl: qrUrl
          });
          showToast("Payment method updated", "success");
      } else {
          await addPaymentMethod({
              ...paymentForm,
              qrCodeUrl: qrUrl
          });
          showToast("Payment method added", "success");
      }

      setIsUploadingQr(false);
      setShowPaymentModal(false);
      setPaymentForm({ name: '', accountName: '', accountNumber: '', qrCodeUrl: '' });
      setPendingQrFile(null);
      setQrPreview(null);
  };

  const handleConnectPrinter = async () => {
      const connected = await connectPrinter();
      if (connected) {
          showToast(t('set.printer_connected'), 'success');
      } else {
          showToast("Failed to connect printer", "error");
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-y-auto">
       <div className="p-4 bg-slate-50 sticky top-0 z-10 border-b border-gray-200/50 flex flex-col gap-4">
            <h1 className={`text-2xl font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>
                {t('nav.settings')}
            </h1>
            
            <div className="flex p-1 bg-white border border-gray-200 rounded-xl w-full max-w-2xl overflow-x-auto no-scrollbar">
                {[
                    { id: 'general', label: t('set.general') },
                    { id: 'staff', label: t('set.staff') },
                    { id: 'discounts', label: t('set.discounts') },
                    { id: 'payments', label: t('set.payments') },
                    { id: 'hardware', label: t('set.hardware') }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-brand-50 text-brand-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
       </div>

       <div className="p-4 max-w-2xl mx-auto w-full pb-24 md:pb-4">
           {activeTab === 'general' && (
               <>
               <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
                    {/* ... (Existing Profile Content) ... */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-brand-50 text-brand-600 p-2 rounded-xl"><Store size={24} /></div>
                        <h2 className={`text-lg font-bold text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>{t('set.profile')}</h2>
                    </div>
                    {/* ... Profile Form Fields ... */}
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center gap-4 mb-6">
                            <label className="relative w-28 h-28 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-all group overflow-hidden bg-gray-50">
                                {logoPreview ? (
                                    <>
                                        <img src={logoPreview} className="w-full h-full object-cover rounded-full" alt="Shop Logo" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                            <Edit2 className="text-white" size={20} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="text-gray-400 group-hover:text-brand-500 mb-1" size={24} />
                                        <span className="text-[10px] text-gray-500 font-bold">{t('setup.logo')}</span>
                                    </>
                                )}
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    disabled={saving || generatingLogo}
                                />
                            </label>
                            
                            <div className="flex flex-col items-center gap-1">
                                <button
                                    type="button"
                                    onClick={handleGenerateLogo}
                                    disabled={generatingLogo || saving || !profileForm.name}
                                    className="text-xs font-bold text-brand-600 flex items-center gap-1.5 hover:text-brand-800 disabled:opacity-50"
                                >
                                    {generatingLogo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {generatingLogo ? 'Generating...' : t('setup.gen_ai')}
                                </button>
                                {pendingLogoFile && <span className="text-[10px] text-orange-500 font-bold">* Changes not saved</span>}
                            </div>
                        </div>

                        <div>
                            <label className={`block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ${language === 'km' ? 'font-display' : ''}`}>{t('set.shop_name')}</label>
                            <input value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} className="w-full p-3.5 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-gray-800" />
                        </div>

                        {/* ... Type Switcher, Address, Phone ... */}
                        <div>
                            <label className={`block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ${language === 'km' ? 'font-display' : ''}`}>{t('setup.type')}</label>
                            <div className="flex bg-gray-50 p-1 rounded-xl">
                                <button onClick={() => setProfileForm({...profileForm, type: 'retail'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${profileForm.type === 'retail' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}><ShoppingBag size={18} /> {t('setup.retail')}</button>
                                <button onClick={() => setProfileForm({...profileForm, type: 'restaurant'})} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${profileForm.type === 'restaurant' ? 'bg-white shadow-sm text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}><Utensils size={18} /> {t('setup.restaurant')}</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('set.address')}</label><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input value={profileForm.address} onChange={(e) => setProfileForm({...profileForm, address: e.target.value})} className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm" placeholder="Address..." /></div></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('set.phone')}</label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm" placeholder="Phone..." /></div></div>
                        </div>
                    </div>
               </div>

               <div className="space-y-6">
                   {/* ... Settings Card (Features, VAT, Language) ... */}
                   <div className="bg-white rounded-2xl shadow-card p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">{t('set.features')}</h2>
                        <div className="space-y-4">
                             {/* ... Toggles ... */}
                             <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><span className="font-bold text-gray-700 text-sm">{t('set.public_store')}</span><button onClick={() => setForm(prev => ({...prev, enablePublicStore: !prev.enablePublicStore}))} className={`transition-colors ${form.enablePublicStore ? 'text-brand-600' : 'text-gray-300'}`}>{form.enablePublicStore ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}</button></div>
                             <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><div className="flex flex-col"><span className="font-bold text-gray-700 text-sm">{t('set.booking')}</span><span className="text-xs text-gray-400">Reservations</span></div><button onClick={() => setForm(prev => ({...prev, enableBooking: !prev.enableBooking}))} className={`transition-colors ${form.enableBooking ? 'text-brand-600' : 'text-gray-300'}`}>{form.enableBooking ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}</button></div>
                             <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><div className="flex flex-col"><span className="font-bold text-gray-700 text-sm">{t('set.variants')}</span><span className="text-xs text-gray-400">{t('set.variants_desc')}</span></div><button onClick={() => setForm(prev => ({...prev, enableAttributes: !prev.enableAttributes}))} className={`transition-colors ${form.enableAttributes ? 'text-brand-600' : 'text-gray-300'}`}>{form.enableAttributes ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}</button></div>
                             <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"><div className="flex flex-col"><span className="font-bold text-gray-700 text-sm">{t('set.multi_role_title')}</span><span className="text-xs text-gray-400">{t('set.multi_role_desc')}</span></div><button onClick={() => setForm(prev => ({...prev, enableMultiRoles: !prev.enableMultiRoles}))} className={`transition-colors ${form.enableMultiRoles ? 'text-brand-600' : 'text-gray-300'}`}>{form.enableMultiRoles ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}</button></div>
                        </div>
                   </div>

                   <div className="bg-white rounded-2xl shadow-card p-6">
                       <h2 className="text-lg font-bold text-gray-800 mb-4">{t('set.vat')}</h2>
                       <div><label className="block text-xs font-bold text-gray-500 mb-1">{t('set.vat_rate')}</label><input type="number" value={form.taxRate} onChange={e => setForm(prev => ({...prev, taxRate: Number(e.target.value)}))} className="w-full p-3 bg-gray-50 rounded-xl font-bold" placeholder="0" /></div>
                   </div>
                   
                   <div className="bg-white rounded-2xl shadow-card p-6">
                       <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Language / ភាសា</h2>
                        <div className="grid grid-cols-5 gap-1 bg-gray-50 p-1 rounded-xl shadow-inner">
                             {['en', 'km', 'zh', 'ja', 'ko'].map((lang: any) => (
                                 <button 
                                    key={lang}
                                    onClick={() => { setLanguage(lang); setForm({...form, defaultLanguage: lang}); }} 
                                    className={`py-2 font-bold text-xs rounded-lg transition-all ${language === lang ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {lang === 'en' && 'ENG'}
                                    {lang === 'km' && 'ខ្មែរ'}
                                    {lang === 'zh' && '中文'}
                                    {lang === 'ja' && 'JP'}
                                    {lang === 'ko' && 'KR'}
                                </button>
                             ))}
                        </div>
                   </div>
               </div>

                <button onClick={handleSave} disabled={saving} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70">
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    <span>{t('set.save')}</span>
                </button>
               </>
           )}

           {activeTab === 'staff' && (
               // ... (Keep existing Staff tab content) ...
               <div className="space-y-4">
                   <div className="flex justify-between items-center mb-2">
                       <h2 className="font-bold text-gray-700">{t('set.staff')}</h2>
                       <button onClick={() => handleOpenStaffModal()} className="bg-brand-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md">
                           <Plus size={14} /> {t('set.add_staff')}
                       </button>
                   </div>
                   {staffList.map(staff => (
                       <div key={staff.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">{staff.name.substring(0,2).toUpperCase()}</div>
                               <div><p className="font-bold text-gray-800">{staff.name}</p><div className="flex items-center gap-2"><span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${staff.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{staff.role}</span><span className="text-xs text-gray-400 font-mono">PIN: ****</span></div></div>
                           </div>
                           <div className="flex gap-1"><button onClick={() => handleOpenStaffModal(staff)} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={16}/></button>{staff.role !== 'admin' && (<button onClick={() => handleDeleteStaff(staff.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>)}</div>
                       </div>
                   ))}
                   <div className="mt-8 bg-blue-50 p-4 rounded-xl border border-blue-100"><h3 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2"><Key size={16} /> {t('set.how_auth_works')}</h3><p className="text-xs text-blue-700 leading-relaxed">{t('set.auth_step1')}<br/>{t('set.auth_step2')}<br/>{t('set.auth_step3')}<br/>{t('set.auth_step4')}</p></div>
                   <div className="mt-4"><button onClick={signOut} className="w-full bg-white border-2 border-red-100 text-red-600 py-3 rounded-xl font-bold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"><LogOut size={16} /><span>{t('lock.logout')}</span></button></div>
               </div>
           )}

           {activeTab === 'discounts' && (
               <div className="space-y-4">
                   <div className="flex justify-between items-center mb-2">
                       <h2 className="font-bold text-gray-700">{t('set.active_discounts')}</h2>
                       <button onClick={() => setShowDiscountModal(true)} className="bg-brand-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"><Plus size={14} /> {t('set.add_rule')}</button>
                   </div>
                   {discountRules.length === 0 && (<div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200"><Tag size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">{t('set.no_discounts')}</p></div>)}
                   {discountRules.map(rule => (<div key={rule.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between"><div><p className="font-bold text-gray-800">{rule.name}</p><div className="flex flex-wrap gap-2 mt-1"><span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-md font-bold border border-green-100">{rule.type === 'percentage' ? `${rule.value}% OFF` : `-${rule.value} ៛ OFF`}</span><span className="text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">{rule.conditions.minQty ? `Buy ${rule.conditions.minQty}+` : ''} {rule.conditions.daysOfWeek ? `Days: ${rule.conditions.daysOfWeek.map(d => daysOfWeek.find(dow => dow.id === d)?.label).join(',')}` : ''} {rule.conditions.categoryIds ? `Category: ${rule.conditions.categoryIds.join(', ')}` : ''} {Object.keys(rule.conditions).length === 0 ? 'All Items' : ''}</span></div></div><button onClick={() => handleDeleteDiscount(rule.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div>))}
               </div>
           )}

           {activeTab === 'payments' && (
               // ... (Keep existing Payments tab content) ...
               <div className="space-y-4">
                   <div className="flex justify-between items-center mb-2">
                       <h2 className="font-bold text-gray-700">{t('set.payment_methods')}</h2>
                       <button onClick={() => handleOpenPaymentModal()} className="bg-brand-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"><Plus size={14} /> {t('set.add_payment')}</button>
                   </div>
                   {paymentMethods.length === 0 && (<div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200"><CreditCard size={32} className="mx-auto mb-2 opacity-30" /><p className="text-sm">No payment methods yet.</p></div>)}
                   {paymentMethods.map(pm => (<div key={pm.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between"><div className="flex items-center gap-4">{pm.qrCodeUrl && (<div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden border border-gray-200"><img src={pm.qrCodeUrl} alt="QR" className="w-full h-full object-cover" /></div>)}<div><p className="font-bold text-gray-800">{pm.name}</p><p className="text-xs text-gray-500">{pm.accountName} {pm.accountNumber ? `• ${pm.accountNumber}` : ''}</p></div></div><div className="flex gap-1 items-center"><button onClick={() => handleOpenPaymentModal(pm)} className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={16} /></button><button onClick={() => updatePaymentMethod(pm.id, { active: !pm.active })} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${pm.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{pm.active ? 'Active' : 'Inactive'}</button><button onClick={() => deletePaymentMethod(pm.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button></div></div>))}
               </div>
           )}

           {activeTab === 'hardware' && (
               <div className="space-y-6">
                   <div className="bg-white rounded-2xl shadow-card p-6 border-l-4 border-brand-500">
                       <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center gap-3">
                               <div className="bg-brand-50 text-brand-600 p-2.5 rounded-xl"><Printer size={24} /></div>
                               <div>
                                   <h3 className="font-bold text-gray-800 text-sm">{t('set.printer_setup')}</h3>
                                   <p className="text-xs text-gray-500">Bluetooth ESC/POS</p>
                               </div>
                           </div>
                           {printerConnected ? (
                               <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                   <Bluetooth size={12} /> {t('set.printer_connected')}
                               </span>
                           ) : (
                               <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">{t('set.not_connected')}</span>
                           )}
                       </div>
                       
                       <p className="text-xs text-gray-500 mb-4 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                           {t('set.printer_instruction')}
                       </p>

                       <button 
                           onClick={handleConnectPrinter}
                           className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${printerConnected ? 'bg-green-600 text-white' : 'bg-slate-900 text-white shadow-lg hover:bg-slate-800'}`}
                       >
                           <Bluetooth size={18} />
                           {printerConnected ? t('set.printer_ready') : t('set.connect_printer')}
                       </button>
                   </div>
               </div>
           )}
       </div>

       {/* Staff Modal */}
       {showStaffModal && (
           <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl w-full max-w-xs p-6 shadow-2xl animate-[scale-in_0.2s_ease-out]">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">{editingStaff ? t('set.edit_staff') : t('set.add_staff')}</h3>
                   <div className="space-y-3">
                       <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm" placeholder={t('set.role_name')} value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} />
                       <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-mono" placeholder={t('set.role_pin')} type="number" maxLength={6} value={staffForm.pin} onChange={e => setStaffForm({...staffForm, pin: e.target.value.slice(0, 6)})} />
                       <div><label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">{t('set.role_select')}</label><select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm" value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value as any})}><option value="cashier">{t('set.role_cashier')}</option><option value="waiter">{t('set.role_waiter')}</option><option value="manager">{t('set.role_manager')}</option><option value="admin">{t('set.role_admin')}</option><option value="kitchen">{t('set.role_kitchen')}</option></select></div>
                   </div>
                   <div className="flex gap-2 mt-6"><button onClick={() => setShowStaffModal(false)} className="flex-1 py-3 text-gray-500 font-bold bg-gray-100 rounded-xl">{t('common.cancel')}</button><button onClick={handleSaveStaff} className="flex-1 py-3 text-white font-bold bg-brand-600 rounded-xl">{t('common.save')}</button></div>
               </div>
           </div>
       )}

       {/* Payment Modal */}
       {showPaymentModal && (
           <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-[scale-in_0.2s_ease-out] overflow-y-auto max-h-[90vh]">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">{editingPaymentId ? 'Edit Payment Method' : t('set.add_payment')}</h3>
                   <div className="space-y-4">
                       <div><label className="block text-xs font-bold text-gray-500 mb-1">{t('set.bank_name')}</label><input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" placeholder="e.g. ABA Bank" value={paymentForm.name} onChange={e => setPaymentForm({...paymentForm, name: e.target.value})} /></div>
                       <div><label className="block text-xs font-bold text-gray-500 mb-1">{t('set.acc_name')}</label><input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm" placeholder="Account Name" value={paymentForm.accountName} onChange={e => setPaymentForm({...paymentForm, accountName: e.target.value})} /></div>
                       <div><label className="block text-xs font-bold text-gray-500 mb-1">{t('set.acc_number')}</label><input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-mono" placeholder="000 000 000" value={paymentForm.accountNumber} onChange={e => setPaymentForm({...paymentForm, accountNumber: e.target.value})} /></div>
                       <div className="flex flex-col items-center justify-center gap-2 mt-2"><label className="relative w-full h-32 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-all bg-gray-50 overflow-hidden group">{qrPreview ? (<><img src={qrPreview} className="w-full h-full object-contain p-2" alt="QR" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="text-white" size={24} /></div></>) : (<><QrCode className="text-gray-400 mb-1" size={24} /><span className="text-[10px] text-gray-500 font-bold">{t('set.upload_qr')}</span></>)}<input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} disabled={isUploadingQr} /></label>{pendingQrFile && <span className="text-[10px] text-orange-500 font-bold">* Image pending save</span>}</div>
                   </div>
                   <div className="flex gap-2 mt-6"><button onClick={() => setShowPaymentModal(false)} className="flex-1 py-3 text-gray-500 font-bold bg-gray-100 rounded-xl">{t('common.cancel')}</button><button onClick={handleSavePayment} disabled={isUploadingQr} className="flex-1 py-3 text-white font-bold bg-brand-600 rounded-xl flex items-center justify-center gap-2">{isUploadingQr ? <Loader2 className="animate-spin" size={18}/> : t('common.save')}</button></div>
               </div>
           </div>
       )}

       {/* Detailed Discount Modal */}
        {showDiscountModal && (
           <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-[scale-in_0.2s_ease-out] overflow-y-auto max-h-[90vh]">
                   <h3 className="text-lg font-bold text-gray-800 mb-4">{t('set.add_rule')}</h3>
                   <div className="space-y-4">
                       <input className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" placeholder={t('set.rule_name_ph')} value={discountForm.name} onChange={e => setDiscountForm({...discountForm, name: e.target.value})} />
                       
                       <div className="grid grid-cols-2 gap-2">
                           <div>
                               <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">{t('set.rule_type')}</label>
                               <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" value={discountForm.type} onChange={e => setDiscountForm({...discountForm, type: e.target.value as any})}>
                                   <option value="percentage">{t('set.percent')}</option>
                                   <option value="fixed_amount">{t('set.fixed_amount')}</option>
                               </select>
                           </div>
                           <div>
                               <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">{t('set.rule_value')}</label>
                               <input type="number" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold" value={discountForm.value} onChange={e => setDiscountForm({...discountForm, value: Number(e.target.value)})} />
                           </div>
                       </div>

                       <div>
                           <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">Condition Type</label>
                           <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold mb-2" value={discountForm.ruleType} onChange={e => setDiscountForm({...discountForm, ruleType: e.target.value as any})}>
                               <option value="simple">Simple Discount</option>
                               <option value="bulk">Bulk Purchase (Buy X)</option>
                               <option value="category">Specific Category</option>
                               <option value="time">Happy Hour (Time)</option>
                               <option value="weekly">Weekly Special</option>
                               <option value="period">Date Range Period</option>
                               <option value="loyalty">Loyalty (Returning)</option>
                           </select>
                           
                           {/* Conditional Fields */}
                           {discountForm.ruleType === 'bulk' && (
                               <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                   <label className="text-xs font-bold text-gray-500 uppercase">Min Quantity</label>
                                   <input type="number" className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="e.g. 10 items" value={discountForm.minQty || ''} onChange={e => setDiscountForm({...discountForm, minQty: parseInt(e.target.value)})} />
                               </div>
                           )}

                           {discountForm.ruleType === 'category' && (
                               <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                   <label className="text-xs font-bold text-gray-500 uppercase">Select Category</label>
                                   <select className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" onChange={e => setDiscountForm({...discountForm, targetIds: [e.target.value]})}>
                                       <option value="">Select Category</option>
                                       {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                               </div>
                           )}

                           {discountForm.ruleType === 'time' && (
                               <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 grid grid-cols-2 gap-2">
                                   <div><label className="text-xs font-bold text-gray-500">Start Time</label><input type="time" className="w-full p-2 bg-white rounded-lg text-xs" value={discountForm.startTime || ''} onChange={e => setDiscountForm({...discountForm, startTime: e.target.value})} /></div>
                                   <div><label className="text-xs font-bold text-gray-500">End Time</label><input type="time" className="w-full p-2 bg-white rounded-lg text-xs" value={discountForm.endTime || ''} onChange={e => setDiscountForm({...discountForm, endTime: e.target.value})} /></div>
                               </div>
                           )}

                           {discountForm.ruleType === 'period' && (
                               <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 grid grid-cols-2 gap-2">
                                   <div><label className="text-xs font-bold text-gray-500">Start Date</label><input type="date" className="w-full p-2 bg-white rounded-lg text-xs" value={discountForm.startDate || ''} onChange={e => setDiscountForm({...discountForm, startDate: e.target.value})} /></div>
                                   <div><label className="text-xs font-bold text-gray-500">End Date</label><input type="date" className="w-full p-2 bg-white rounded-lg text-xs" value={discountForm.endDate || ''} onChange={e => setDiscountForm({...discountForm, endDate: e.target.value})} /></div>
                               </div>
                           )}

                           {discountForm.ruleType === 'weekly' && (
                               <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                   <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Select Days</label>
                                   <div className="flex flex-wrap gap-1">
                                       {daysOfWeek.map(d => (
                                           <button 
                                               key={d.id} 
                                               onClick={() => toggleDay(d.id)}
                                               className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${discountForm.days.includes(d.id) ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                                           >
                                               {d.label}
                                           </button>
                                       ))}
                                   </div>
                               </div>
                           )}

                           {discountForm.ruleType === 'loyalty' && (
                               <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs text-blue-700 font-medium">
                                   This discount will apply automatically to customers with previous purchase history.
                               </div>
                           )}
                       </div>

                       <div className="flex gap-2 mt-6"><button onClick={() => setShowDiscountModal(false)} className="flex-1 py-3 text-gray-500 font-bold bg-gray-100 rounded-xl">{t('common.cancel')}</button><button onClick={handleSaveDiscount} className="flex-1 py-3 text-white font-bold bg-brand-600 rounded-xl">{t('set.add_rule')}</button></div>
                   </div>
                </div>
           </div>
        )}
    </div>
  );
}