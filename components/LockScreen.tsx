
import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Lock, User, Delete, LogOut, Plus, KeyRound, Shield, Loader2 } from 'lucide-react';
import { Logo } from './Logo';

export const LockScreen = ({ children }: { children?: React.ReactNode }) => {
  const { staffList, switchStaff, signOut, currentShop, user, t, addStaff, updateStaff, language } = useStore();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // First-time PIN setup steps (PINs are verified server-side; we only know
  // whether an operator has one via the hasPin flag).
  const [step, setStep] = useState<'login' | 'set_new_1' | 'set_new_2'>('login');
  const [newPin, setNewPin] = useState('');

  const handleNumClick = async (num: string) => {
    setError(false);
    if (verifying) return;
    const staff = staffList.find(s => s.id === selectedStaffId);
    if (!staff) return;
    if (pin.length >= 6) return;

    const entered = pin + num;
    setPin(entered);
    if (entered.length < 6) return;

    if (step === 'login') {
      setVerifying(true);
      const success = await switchStaff(entered, staff.id);
      setVerifying(false);
      if (!success) {
        setError(true);
        setTimeout(() => setPin(''), 300);
      }
    } else if (step === 'set_new_1') {
      setNewPin(entered);
      setStep('set_new_2');
      setPin('');
    } else if (step === 'set_new_2') {
      if (entered === newPin) {
        // Confirmed — save (hashed server-side) and activate the operator.
        setVerifying(true);
        try {
          await updateStaff(staff.id, { pin: entered });
          await switchStaff(entered, staff.id);
          setSelectedStaffId(null);
          setStep('login');
          setPin('');
        } catch {
          setError(true);
          setTimeout(() => setPin(''), 300);
        } finally {
          setVerifying(false);
        }
      } else {
        // Mismatch -> shake, clear and reset to step 1
        setError(true);
        setTimeout(() => {
          setStep('set_new_1');
          setPin('');
        }, 500);
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
      setStep(staff && !staff.hasPin ? 'set_new_1' : 'login');
  };

  const handleCreateDefaultAdmin = async () => {
      // Use "123456" as default PIN for recovery
      await addStaff({ name: 'Owner', pin: '123456', role: 'admin' });
      // Reload will happen automatically via StoreContext update
  };

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);
  const isDemo = user?.id === 'demo-user-id';

  // Dynamic texts for first-time PIN setup on the lock screen
  let stepTitle = "";
  let stepSubtitle = "";
  let badgeText = "";

  if (step === 'set_new_1') {
    if (language === 'km') {
      badgeText = "ដំឡើងលេខកូដដំបូង";
      stepTitle = "បង្កើតលេខកូដសុវត្ថិភាព ៦ខ្ទង់";
      stepSubtitle = "សូមកំណត់លេខកូដ PIN ថ្មីចំនួន ៦ ខ្ទង់ ដើម្បីការពារគណនីរបស់អ្នក";
    } else if (language === 'zh') {
      badgeText = "设置新密码";
      stepTitle = "创建 6 位安全密码";
      stepSubtitle = "请为您的账户设置一个安全的 6 位数 PIN 码";
    } else if (language === 'ja') {
      badgeText = "パスコードの設定";
      stepTitle = "6桁の暗証番号を作成";
      stepSubtitle = "アカウントを保護するために、新しい6桁のPINコードを設定してください";
    } else if (language === 'ko') {
      badgeText = "비밀번호 설정";
      stepTitle = "6자리 보안 비밀번호 생성";
      stepSubtitle = "계정을 보호하기 위해 새로운 6자리 PIN 코드를 설정해 주세요";
    } else {
      badgeText = "First-Time Security Setup";
      stepTitle = "Create 6-Digit Passcode";
      stepSubtitle = "Choose a secure 6-digit passcode for your staff account";
    }
  } else if (step === 'set_new_2') {
    if (language === 'km') {
      badgeText = "ដំឡើងលេខកូដដំបូង";
      stepTitle = "បញ្ជាក់លេខកូដថ្មី";
      stepSubtitle = "សូមវាយបញ្ចូលលេខកូដ PIN ថ្មី ៦ ខ្ទង់ ម្តងទៀត ដើម្បីធានាថាត្រឹមត្រូវ";
    } else if (language === 'zh') {
      badgeText = "设置新密码";
      stepTitle = "确认新密码";
      stepSubtitle = "请再次输入您的新 6 位 PIN 码以确认";
    } else if (language === 'ja') {
      badgeText = "パスコードの設定";
      stepTitle = "新しい暗証番号の確認";
      stepSubtitle = "確認のため、もう一度新しい6桁のPINコードを入力してください";
    } else if (language === 'ko') {
      badgeText = "비밀번호 설정";
      stepTitle = "새로운 비밀번호 확인";
      stepSubtitle = "확인을 위해 새로운 6자리 PIN 코드를 한번 더 입력해 주세요";
    } else {
      badgeText = "First-Time Security Setup";
      stepTitle = "Confirm New PIN";
      stepSubtitle = "Re-enter your custom 6-digit passcode to confirm and activate";
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
                          {staffList.map(staff => (
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

                                  {!staff.hasPin && (
                                      <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                                          {t('lock.setup_badge')}
                                      </span>
                                  )}
                              </button>
                          ))}
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
                      <button
                        onClick={() => {
                            setSelectedStaffId(null);
                            setStep('login');
                            setPin('');
                        }}
                        className="ml-2 text-xs text-slate-400 hover:text-white underline group-hover:text-brand-300 transition-colors"
                      >
                        {step === 'login' ? t('lock.change') : (language === 'km' ? 'បោះបង់' : 'Cancel')}
                      </button>
                  </div>

                  {step !== 'login' && (
                      <div className="w-full bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 mb-6 text-center shadow-2xl relative overflow-hidden flex flex-col items-center">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none"></div>

                          <div className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-2.5 animate-pulse">
                              <Shield size={24} />
                          </div>

                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase tracking-wider mb-2">
                              <span>{badgeText}</span>
                          </div>

                          <h4 className="text-base font-bold text-slate-100">{stepTitle}</h4>
                          <p className="text-xs text-slate-400 mt-1 max-w-[280px] leading-relaxed">{stepSubtitle}</p>

                          {/* Interactive Step Dots for Setup Process */}
                          <div className="flex items-center gap-1.5 mt-3">
                              <span className={`w-1.5 h-1.5 rounded-full transition-all ${step === 'set_new_1' ? 'bg-brand-400 scale-125' : 'bg-brand-500/30'}`}></span>
                              <span className={`w-1.5 h-1.5 rounded-full transition-all ${step === 'set_new_2' ? 'bg-brand-400 scale-125' : 'bg-slate-600'}`}></span>
                          </div>
                      </div>
                  )}

                  <div className="mb-3 flex gap-4 items-center">
                      {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-150 ${error ? 'bg-red-500 animate-shake' : pin.length > i ? 'bg-brand-400 scale-110 shadow-[0_0_12px_rgba(99,102,241,0.7)]' : 'bg-slate-700'}`}></div>
                      ))}
                      {verifying && <Loader2 size={16} className="animate-spin text-brand-400" />}
                  </div>

                  <div className="h-5 mb-6 text-center">
                      {error && (
                          <p className="text-sm font-bold text-red-400 animate-shake">
                              {step === 'set_new_2'
                                  ? (language === 'km' ? 'លេខកូដមិនត្រូវគ្នា' : 'PINs do not match')
                                  : (language === 'km' ? 'លេខកូដមិនត្រឹមត្រូវ' : 'Wrong PIN')}
                          </p>
                      )}
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
