import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { useUI } from '../store/UIContext';
import { Logo } from '../components/Logo';
import { Sparkles, ArrowRight, Users, Lock, KeyRound, Phone, BookOpen, AlertTriangle } from 'lucide-react';

export default function Login() {
  const { signInWithGoogle, loginAsStaff, loadingAuth, t } = useStore();
  const { showToast } = useUI();
  
  const [mode, setMode] = useState<'owner' | 'staff'>('owner');
  const [shopPhone, setShopPhone] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  const handleStaffLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!shopPhone || !staffPin) {
          showToast("Please fill in both fields", "error");
          return;
      }
      setStaffLoading(true);
      const success = await loginAsStaff(shopPhone, staffPin);
      if (!success) {
          showToast("Invalid Shop Phone or PIN", "error");
      }
      setStaffLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[55vh] bg-gradient-to-bl from-indigo-900 via-brand-700 to-brand-600 rounded-b-[60px] md:rounded-b-[80px] shadow-2xl z-0 overflow-hidden">
         <div className="absolute inset-0 opacity-10" 
              style={{ backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}>
         </div>
         <div className="absolute -top-20 -left-20 w-96 h-96 bg-accent-500/30 rounded-full blur-[100px] mix-blend-screen"></div>
         <div className="absolute top-10 -right-20 w-72 h-72 bg-purple-500/30 rounded-full blur-[80px] mix-blend-screen"></div>
      </div>

      <div className="relative z-10 w-full max-w-md mt-6 text-center">
         <div className="flex justify-center mb-6">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white/20 ring-1 ring-white/10">
                <Logo className="w-16 h-16" textClassName="text-4xl text-white" />
              </div>
         </div>
         <p className="text-brand-100 font-medium text-lg mb-6 opacity-90 font-display">
             {t('login.subtitle')}
         </p>

         {/* Free Use Disclaimer */}
         <div className="mx-auto max-w-sm mb-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-left shadow-lg relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>
             <div className="flex gap-3 items-center">
                 <div className="text-yellow-300">
                     <AlertTriangle size={18} />
                 </div>
                 <div>
                     <p className="text-white text-sm font-bold leading-relaxed">
                         Free Forever: This app is completely free to use.
                     </p>
                 </div>
             </div>
         </div>

         <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-8 animate-[scale-in_0.3s_ease-out] border border-white/50 relative overflow-hidden">
             
             {/* Tabs */}
             <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                 <button 
                    onClick={() => setMode('owner')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'owner' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                     <Lock size={16} /> {t('login.owner')}
                 </button>
                 <button 
                    onClick={() => setMode('staff')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'staff' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                     <Users size={16} /> {t('login.staff')}
                 </button>
             </div>

             {mode === 'owner' ? (
                 <div className="space-y-4">
                     <button
                        onClick={signInWithGoogle}
                        disabled={loadingAuth}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 group"
                     >
                        {loadingAuth ? (
                            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                 <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                                 <span>{t('login.google')}</span>
                                 <ArrowRight size={18} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                            </>
                        )}
                     </button>
                 </div>
             ) : (
                 <form onSubmit={handleStaffLogin} className="space-y-4 text-left">
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">{t('login.phone')}</label>
                         <div className="relative">
                             <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                             <input 
                                className="w-full pl-10 pr-4 py-3.5 bg-gray-50 rounded-xl border-2 border-transparent focus:border-brand-500 focus:bg-white transition-all outline-none font-bold text-gray-800"
                                placeholder="012 345 678"
                                value={shopPhone}
                                onChange={e => setShopPhone(e.target.value)}
                             />
                         </div>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">{t('login.pin')}</label>
                         <div className="relative">
                             <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                             <input 
                                className="w-full pl-10 pr-4 py-3.5 bg-gray-50 rounded-xl border-2 border-transparent focus:border-brand-500 focus:bg-white transition-all outline-none font-bold text-gray-800 tracking-widest"
                                placeholder="****"
                                type="password"
                                maxLength={4}
                                inputMode="numeric"
                                value={staffPin}
                                onChange={e => setStaffPin(e.target.value)}
                             />
                         </div>
                     </div>
                     <button
                        type="submit"
                        disabled={staffLoading}
                        className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-bold py-4 rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/30 active:scale-95 mt-2"
                     >
                        {staffLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>{t('login.login_btn')}</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                     </button>
                 </form>
             )}
             
             <div className="mt-8 flex flex-col items-center gap-3">
                 <div className="flex items-center gap-4 text-[10px] text-gray-300 font-medium">
                    <a href="?mode=manual" className="hover:text-brand-500 transition-colors flex items-center gap-1 border-b border-dashed border-gray-300 pb-0.5">
                        <BookOpen size={10} /> សៀវភៅណែនាំ (User Manual)
                    </a>
                    <span>|</span>
                    <a href="?mode=license" className="hover:text-gray-500 transition-colors border-b border-dashed border-gray-300 pb-0.5">
                        Community License
                    </a>
                 </div>
                 <span className="text-[10px] text-gray-300 font-medium opacity-50">
                    Ver 0.01 (Beta)
                 </span>
             </div>
         </div>
      </div>
    </div>
  );
}