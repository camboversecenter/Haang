
import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Lock, User, Delete, LogOut, Plus, KeyRound } from 'lucide-react';
import { Logo } from './Logo';

export const LockScreen = ({ children }: { children?: React.ReactNode }) => {
  const { staffList, switchStaff, signOut, currentShop, user, t, addStaff, updateStaff, language } = useStore();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  // States for 6-digit passcode upgrade migration
  const [step, setStep] = useState<'login' | 'verify_old' | 'set_new_1' | 'set_new_2'>('login');
  const [newPin, setNewPin] = useState('');

  const handleNumClick = async (num: string) => {
    setError(false);
    const staff = staffList.find(s => s.id === selectedStaffId);
    if (!staff) return;

    if (step === 'login') {
      if (pin.length < 6) {
        const newPinVal = pin + num;
        setPin(newPinVal);
        if (newPinVal.length === 6) {
          const success = switchStaff(newPinVal, staff.id);
          if (!success) {
            setError(true);
            setTimeout(() => setPin(''), 300);
          }
        }
      }
    } else if (step === 'verify_old') {
      const expectedLen = staff.pin ? staff.pin.length : 0;
      if (pin.length < expectedLen) {
        const entered = pin + num;
        setPin(entered);
        if (entered.length === expectedLen) {
          if (entered === staff.pin) {
            // Correct old pin! Proceed to set new 6-digit PIN
            setStep('set_new_1');
            setPin('');
          } else {
            setError(true);
            setTimeout(() => setPin(''), 300);
          }
        }
      }
    } else if (step === 'set_new_1') {
      if (pin.length < 6) {
        const entered = pin + num;
        setPin(entered);
        if (entered.length === 6) {
          setNewPin(entered);
          setStep('set_new_2');
          setPin('');
        }
      }
    } else if (step === 'set_new_2') {
      if (pin.length < 6) {
        const entered = pin + num;
        setPin(entered);
        if (entered.length === 6) {
          if (entered === newPin) {
            // Passcode Match! Let's save to Database
            await updateStaff(staff.id, { pin: entered });
            // Switch to the newly upgraded staff
            switchStaff(entered, staff.id);
            // Reset state
            setSelectedStaffId(null);
            setStep('login');
            setPin('');
          } else {
            // Mismatch -> shake, clear and reset to step 1
            setError(true);
            setTimeout(() => {
              setStep('set_new_1');
              setPin('');
            }, 500);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleStaffSelect = (id: string) => {
      setSelectedStaffId(id);
      setPin('');
      setError(false);
      
      const staff = staffList.find(s => s.id === id);
      if (staff) {
          if (!staff.pin || staff.pin.length === 0) {
              setStep('set_new_1');
          } else if (staff.pin.length !== 6) {
              setStep('verify_old');
          } else {
              setStep('login');
          }
      } else {
          setStep('login');
      }
  };

  const handleCreateDefaultAdmin = async () => {
      // Use "123456" as default PIN for recovery
      await addStaff({ name: 'Owner', pin: '123456', role: 'admin' });
      // Reload will happen automatically via StoreContext update
  };

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);
  const isDemo = user?.id === 'demo-user-id';

  // Dynamic texts for PIN setup/upgrade on the lock screen
  let stepTitle = "";
  let stepSubtitle = "";

  if (step === 'verify_old') {
    if (language === 'km') {
      stepTitle = "ផ្ទៀងផ្ទាត់លេខកូដចាស់";
      stepSubtitle = `សូមវាយបញ្ចូលលេខកូដចាស់ (${selectedStaff?.pin?.length || 4} ខ្ទង់) ដើម្បីបន្ត`;
    } else {
      stepTitle = "Verify Old PIN";
      stepSubtitle = `Enter your old PIN (${selectedStaff?.pin?.length || 4} digits) to continue`;
    }
  } else if (step === 'set_new_1') {
    if (language === 'km') {
      stepTitle = "កំណត់លេខកូដថ្មី ៦ខ្ទង់";
      stepSubtitle = "សូមវាយបញ្ចូលលេខកូដ PIN ថ្មីចំនួន ៦ ខ្ទង់ ដើម្បីសុវត្ថិភាពខ្ពស់";
    } else {
      stepTitle = "Set New 6-Digit PIN";
      stepSubtitle = "Setup a more secure 6-digit passcode for your account";
    }
  } else if (step === 'set_new_2') {
    if (language === 'km') {
      stepTitle = "បញ្ជាក់លេខកូដថ្មី";
      stepSubtitle = "សូមវាយបញ្ចូលលេខកូដ PIN ថ្មី ៦ ខ្ទង់ ម្តងទៀតដើម្បីផ្ទៀងផ្ទាត់";
    } else {
      stepTitle = "Confirm New PIN";
      stepSubtitle = "Re-enter your new 6-digit passcode to confirm";
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      {/* Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opacity-80"></div>
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col h-full md:h-auto md:max-h-[80vh]">
          
          <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                  <Logo className="w-12 h-12" textClassName="text-2xl text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-300">{currentShop?.name}</h2>
              <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">{t('lock.authorized')}</p>
          </div>

          {!selectedStaff ? (
              // Staff Selection Grid
              <div className="flex-1 flex flex-col items-center">
                  <h3 className="text-lg font-bold mb-6">{t('lock.who_login')}</h3>
                  
                  {staffList.length === 0 ? (
                      <div className="text-center p-6 bg-slate-800 rounded-2xl border border-slate-700 max-w-xs mx-auto">
                          <p className="text-slate-400 mb-4 text-sm font-medium">{t('lock.no_staff')}</p>
                          <button 
                            onClick={handleCreateDefaultAdmin}
                            className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-brand-700 transition-all flex items-center justify-center gap-2 w-full"
                          >
                              <Plus size={16} />
                              {t('lock.create_admin')}
                          </button>
                      </div>
                  ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full px-4">
                          {staffList.map(staff => {
                              // Check if this is the default admin to show a hint
                              const isDefaultOwner = staff.name === 'Owner' && (staff.pin === '123456' || staff.pin === '1234');
                              
                              return (
                                  <button
                                    key={staff.id}
                                    onClick={() => handleStaffSelect(staff.id)}
                                    className="bg-slate-800 hover:bg-brand-900 border border-slate-700 hover:border-brand-500 rounded-2xl p-4 flex flex-col items-center gap-3 transition-all active:scale-95 group relative"
                                  >
                                      <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-300 shadow-inner">
                                          {staff.name.substring(0, 2).toUpperCase()}
                                      </div>
                                      <span className="font-bold text-sm truncate w-full text-center">{staff.name}</span>
                                      <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 uppercase">{staff.role}</span>
                                      
                                      {/* New User Hint - Solves the "Forgot Pin on Day 1" problem */}
                                      {isDefaultOwner && (
                                        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-bounce z-10 border border-blue-400">
                                            PIN: {staff.pin}
                                        </div>
                                      )}

                                      {/* Demo Hint */}
                                      {isDemo && !isDefaultOwner && (
                                        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            {staff.pin}
                                        </div>
                                      )}
                                  </button>
                              );
                          })}
                      </div>
                  )}
                  
                  <div className="mt-auto md:mt-12">
                      <button onClick={signOut} className="flex items-center gap-2 text-slate-500 hover:text-red-400 transition-colors px-4 py-2">
                          <LogOut size={16} /> 
                          {isDemo ? t('lock.exit_demo') : t('lock.logout')}
                      </button>
                  </div>
              </div>
          ) : (
              // PIN Entry Pad
              <div className="flex-1 flex flex-col items-center animate-[scale-in_0.2s_ease-out]">
                  <div className="flex items-center gap-3 mb-6 bg-slate-800 px-4 py-2 rounded-full border border-slate-700 relative group">
                      <User size={16} className="text-brand-400" />
                      <span className="font-bold">{selectedStaff.name}</span>
                      <button onClick={() => setSelectedStaffId(null)} className="ml-2 text-xs text-slate-400 hover:text-white underline">{t('lock.change')}</button>
                      
                      {/* Hint for demo/default users */}
                      {step === 'login' && (isDemo || (selectedStaff.name === 'Owner' && (selectedStaff.pin === '123456' || selectedStaff.pin === '1234'))) && (
                          <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-slate-700 text-slate-300 text-[10px] px-3 py-1 rounded-full whitespace-nowrap border border-slate-600">
                              Try PIN: {selectedStaff.pin}
                          </div>
                      )}
                  </div>

                  {step !== 'login' && (
                      <div className="text-center mb-6 px-4">
                          <h4 className="text-md font-bold text-brand-300">{stepTitle}</h4>
                          <p className="text-xs text-slate-400 mt-1">{stepSubtitle}</p>
                      </div>
                  )}

                  <div className="mb-8 flex gap-4">
                      {Array.from({ length: step === 'verify_old' ? (selectedStaff.pin?.length || 4) : 6 }).map((_, i) => (
                          <div key={i} className={`w-4 h-4 rounded-full transition-all ${pin.length > i ? 'bg-brand-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-700'} ${error ? 'bg-red-500 animate-shake' : ''}`}></div>
                      ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                          <button
                            key={num}
                            onClick={() => handleNumClick(num.toString())}
                            className="w-20 h-20 rounded-full bg-slate-800 hover:bg-slate-700 text-2xl font-bold transition-all active:scale-95 flex items-center justify-center border border-slate-700 shadow-lg hover:border-brand-500/30 hover:text-brand-100"
                          >
                              {num}
                          </button>
                      ))}
                      <div className="w-20 h-20 flex items-center justify-center">
                          <KeyRound size={24} className="text-slate-600 opacity-20" />
                      </div>
                      <button
                        onClick={() => handleNumClick('0')}
                        className="w-20 h-20 rounded-full bg-slate-800 hover:bg-slate-700 text-2xl font-bold transition-all active:scale-95 flex items-center justify-center border border-slate-700 shadow-lg hover:border-brand-500/30 hover:text-brand-100"
                      >
                          0
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-20 h-20 rounded-full text-slate-400 hover:text-red-400 transition-colors flex items-center justify-center active:scale-95"
                      >
                          <Delete size={24} />
                      </button>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
