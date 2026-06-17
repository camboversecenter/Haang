import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { Store, ShoppingBag, Utensils, Check, Sparkles, LogOut, Loader2, Edit2, Upload, Users, ToggleLeft, ToggleRight, BookOpen } from 'lucide-react';
import { Logo } from '../components/Logo';
import { generateLogo } from '../services/geminiService';
import { uploadProductImage } from '../services/storageService';

export default function ShopSetup() {
  const { createShop, language, setLanguage, signOut, t } = useStore();
  const { showToast, showAlert } = useUI();
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'retail' | 'restaurant'>('retail');
  const [generatedLogoFile, setGeneratedLogoFile] = useState<File | null>(null);
  const [generatedLogoPreview, setGeneratedLogoPreview] = useState<string | null>(null);
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [enableMultiRoles, setEnableMultiRoles] = useState(false);

  const handleGenerateLogo = async () => {
    if (!name.trim()) {
      showToast(t('toast.enter_shop_name'), "error");
      return;
    }
    setGeneratingLogo(true);
    const file = await generateLogo(name);
    if (file) {
      setGeneratedLogoFile(file);
      setGeneratedLogoPreview(URL.createObjectURL(file));
      showToast(t('toast.logo_gen'), "success");
    } else {
      showAlert(t('alert.gen_fail_title'), t('alert.gen_fail_msg'));
    }
    setGeneratingLogo(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setGeneratedLogoFile(file);
          setGeneratedLogoPreview(URL.createObjectURL(file));
      }
  };

  const handleCreateWithLogo = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;

      setUploadingLogo(true);
      
      try {
          let logoUrl = undefined;
          
          if (generatedLogoFile) {
              const url = await uploadProductImage(generatedLogoFile, 'Haang');
              if (url) {
                  logoUrl = url;
              } else {
                  showToast("Failed to upload logo image", "error");
              }
          }

          // Await completion - store will reload itself
          await createShop(name, type, logoUrl, enableMultiRoles);
          
          if (enableMultiRoles) {
              showToast(language === 'km' ? "ហាងត្រូវបានបង្កើត! លេខសម្ងាត់គឺ 123456" : "Shop created! Default PIN: 123456", "success");
          } else {
              showToast(language === 'km' ? "ហាងត្រូវបានបង្កើតជោគជ័យ!" : "Shop created successfully!", "success");
          }
      } catch (err) {
          console.error(err);
          showToast("Failed to create shop. Please try again.", "error");
      } finally {
          setUploadingLogo(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-y-auto">
      
      {/* --- Header Design --- */}
      <div className="absolute top-0 left-0 w-full h-[55vh] bg-gradient-to-bl from-indigo-900 via-brand-700 to-brand-600 rounded-b-[60px] md:rounded-b-[80px] shadow-2xl z-0 overflow-hidden">
         <div className="absolute inset-0 opacity-10" 
              style={{ backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}>
         </div>
         <div className="absolute -top-20 -left-20 w-96 h-96 bg-accent-500/30 rounded-full blur-[100px] mix-blend-screen"></div>
         <div className="absolute top-10 -right-20 w-72 h-72 bg-purple-500/30 rounded-full blur-[80px] mix-blend-screen"></div>
         <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-t from-brand-900/50 to-transparent"></div>
      </div>
      
      {/* Scrollable Content Wrapper */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 py-12">
        {/* Logout Button */}
        <div className="absolute top-4 right-4 z-50">
            <button 
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white font-bold hover:bg-white/30 transition-colors shadow-lg"
            >
                <LogOut size={16} />
                <span className="text-sm">{t('lock.logout')}</span>
            </button>
        </div>

        <div className="w-full max-w-md">
            <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white/20 ring-1 ring-white/10">
                    <Logo className="w-14 h-14" textClassName="text-4xl text-white" />
                </div>
            </div>
            <h1 className={`text-3xl font-bold text-white mb-2 drop-shadow-md ${language === 'km' ? 'font-display' : ''}`}>
                {t('setup.welcome')}
            </h1>
            <p className="text-brand-100 font-medium text-base opacity-90">
                {t('setup.subtitle')}
            </p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-2xl shadow-brand-900/10 p-8 animate-[scale-in_0.3s_ease-out] border border-white/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 via-accent-500 to-brand-500"></div>

                <h2 className={`text-xl font-bold mb-6 text-gray-800 ${language === 'km' ? 'font-display' : ''}`}>
                    {t('setup.create')}
                </h2>

                <form onSubmit={handleCreateWithLogo} className="space-y-6">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <label className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 transition-all group overflow-hidden bg-gray-50">
                            {uploadingLogo ? (
                                <Loader2 className="animate-spin text-brand-600" />
                            ) : generatedLogoPreview ? (
                                <>
                                    <img src={generatedLogoPreview} className="w-full h-full object-cover rounded-full" alt="Shop Logo" />
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
                                disabled={uploadingLogo || generatingLogo}
                            />
                        </label>

                        <button
                            type="button"
                            onClick={handleGenerateLogo}
                            disabled={generatingLogo || !name.trim()}
                            className="text-xs font-bold text-brand-600 flex items-center gap-1.5 hover:text-brand-800 disabled:opacity-50"
                        >
                            {generatingLogo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {generatingLogo ? 'Generating...' : t('setup.gen_ai')}
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            {t('setup.name')}
                        </label>
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all font-bold text-lg text-gray-800 placeholder:text-gray-300"
                            placeholder="e.g. My Coffee Shop"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                            {t('setup.type')}
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setType('retail')}
                                className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                    type === 'retail' 
                                    ? 'border-brand-500 bg-brand-50/50 text-brand-700 shadow-sm' 
                                    : 'border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <div className={`p-2 rounded-full ${type === 'retail' ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <ShoppingBag size={20} />
                                </div>
                                <span className={`font-bold text-sm ${language === 'km' ? 'font-display' : ''}`}>{t('setup.retail')}</span>
                                {type === 'retail' && (
                                    <div className="absolute top-2 right-2 bg-brand-500 text-white rounded-full p-0.5 shadow-sm">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('restaurant')}
                                className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                    type === 'restaurant' 
                                    ? 'border-brand-500 bg-brand-50/50 text-brand-700 shadow-sm' 
                                    : 'border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <div className={`p-2 rounded-full ${type === 'restaurant' ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <Utensils size={20} />
                                </div>
                                <span className={`font-bold text-sm ${language === 'km' ? 'font-display' : ''}`}>{t('setup.restaurant')}</span>
                                {type === 'restaurant' && (
                                    <div className="absolute top-2 right-2 bg-brand-500 text-white rounded-full p-0.5 shadow-sm">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Multi-Role / Staff Setting */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-full text-blue-600">
                                <Users size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">
                                    {t('setup.multi_staff')}
                                </h3>
                                <p className="text-[10px] text-gray-500">
                                    {t('setup.multi_staff_desc')}
                                </p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setEnableMultiRoles(!enableMultiRoles)}
                            className={`text-2xl transition-colors ${enableMultiRoles ? 'text-brand-600' : 'text-gray-300'}`}
                        >
                            {enableMultiRoles ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                        </button>
                    </div>

                    <button 
                        type="submit"
                        disabled={uploadingLogo}
                        className="w-full py-4 bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {uploadingLogo ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>
                                <Store size={20} />
                                <span>{t('setup.start')}</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center gap-4">
                    <button 
                        onClick={() => setLanguage(language === 'en' ? 'km' : 'en')}
                        className="text-gray-400 text-sm font-bold hover:text-brand-600 flex items-center gap-2 transition-colors"
                    >
                        {language === 'en' ? 'ប្តូរទៅភាសាខ្មែរ' : 'Switch to English'}
                    </button>
                    
                    <div className="flex items-center gap-4 text-[10px] text-gray-300 font-medium">
                        <a href="?mode=manual" className="hover:text-brand-500 transition-colors flex items-center gap-1 border-b border-dashed border-gray-300 pb-0.5">
                            <BookOpen size={10} /> User Manual
                        </a>
                        <span>|</span>
                        <a href="?mode=license" className="hover:text-gray-500 transition-colors border-b border-dashed border-gray-300 pb-0.5">
                            Community License
                        </a>
                    </div>
                    <span className="text-[10px] text-gray-300 font-medium opacity-70">
                        Ver 0.01 (Beta)
                    </span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}