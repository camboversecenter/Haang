
import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './store/StoreContext';
import { UIProvider } from './store/UIContext';
import { VaultProvider, useZkVault, VaultStatus } from './zk-vault';
import { supabaseVaultAdapter } from './services/supabaseVaultAdapter';
import VaultSetup from './components/zk-vault/VaultSetup';
import VaultUnlock from './components/zk-vault/VaultUnlock';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Dashboard from './pages/Dashboard';
import ShopSetup from './pages/ShopSetup';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import ReceiptView from './pages/ReceiptView';
import PublicStore from './pages/PublicStore';
import Tables from './pages/Tables';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Kitchen from './pages/Kitchen';
import CommunityLicense from './pages/CommunityLicense';
import UserManual from './pages/UserManual';
import { LockScreen } from './components/LockScreen';
import { LayoutGrid, ShoppingCart, BarChart3, Globe, LogOut, FileText, Settings as SettingsIcon, Utensils, Calendar, Loader2, Users, Lock, ChefHat } from 'lucide-react';
import { Logo } from './components/Logo';

// --- Top Bar Component (Mobile) ---
const TopBar = () => {
    const { language, setLanguage, currentShop, activeStaff, logoutStaff, settings, signOut, user } = useStore();
    
    // Role Badge Colors
    const getRoleBadgeStyle = (role: string) => {
        switch(role) {
            case 'admin': return 'bg-purple-50 border-purple-100 text-purple-700';
            case 'manager': return 'bg-blue-50 border-blue-100 text-blue-700';
            case 'waiter': return 'bg-orange-50 border-orange-100 text-orange-700';
            case 'kitchen': return 'bg-red-50 border-red-100 text-red-700';
            default: return 'bg-gray-50 border-gray-100 text-gray-700';
        }
    };

    const badgeStyle = activeStaff ? getRoleBadgeStyle(activeStaff.role) : '';

    return (
        <header className="md:hidden fixed top-0 left-0 right-0 h-[60px] bg-white/80 backdrop-blur-xl border-b border-gray-100 z-50 px-4 flex justify-between items-center shadow-sm">
            <Logo className="w-8 h-8" textClassName="text-lg" />
            <div className="flex items-center gap-2">
                 {activeStaff && settings.enableMultiRoles && (
                     <button 
                        onClick={logoutStaff}
                        className={`flex items-center gap-2 px-2 py-1 rounded-full border transition-all active:scale-95 ${badgeStyle}`}
                     >
                         <div className="w-6 h-6 bg-white/50 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                             {activeStaff.name.substring(0,2).toUpperCase()}
                         </div>
                         <div className="flex flex-col items-start leading-none mr-1">
                             <span className="text-[10px] font-bold">{activeStaff.name}</span>
                             <span className="text-[8px] opacity-70 uppercase">{activeStaff.role}</span>
                         </div>
                         <Lock size={12} className="opacity-50" />
                     </button>
                 )}
                <button 
                    onClick={() => setLanguage(language === 'en' ? 'km' : 'en')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100 transition-colors"
                >
                    <Globe size={14} className="text-brand-600" />
                    <span className="text-xs font-bold text-gray-700">{language === 'en' ? 'KM' : 'EN'}</span>
                </button>
                {user && (
                    <button 
                        onClick={signOut}
                        className="flex items-center justify-center p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors border border-gray-100 bg-gray-50 w-8 h-8"
                        title={language === 'km' ? 'ចាកចេញពីហាង' : 'Sign Out'}
                    >
                        <LogOut size={14} />
                    </button>
                )}
            </div>
        </header>
    );
};

// --- Navigation Component ---
const Navigation = ({ currentTab, setTab }: { currentTab: string, setTab: (t: string) => void }) => {
  const { language, setLanguage, t, logoutStaff, currentShop, settings, activeStaff, user, signOut } = useStore();

  const isRestaurant = currentShop?.type === 'restaurant';
  
  // ROLE BASED PERMISSIONS
  const role = activeStaff?.role || 'cashier';
  const isAdmin = role === 'admin' || role === 'manager';
  const isWaiter = role === 'waiter';
  const isKitchen = role === 'kitchen';

  // "Tables" or "Rooms" logic
  // Enabled for everyone now, icon changes based on type
  const tableIcon = isRestaurant ? Utensils : LayoutGrid;
  const tableLabel = t('nav.tables'); // Uses "Tables" translation, conceptually matches "Rooms"

  const allNavItems = [
    { id: 'pos', icon: ShoppingCart, label: t('nav.pos'), allowed: !isKitchen }, 
    { id: 'inventory', icon: LayoutGrid, label: t('nav.inventory'), allowed: !isWaiter && !isKitchen },
    { id: 'tables', icon: tableIcon, label: tableLabel, allowed: !isKitchen },
    { id: 'kitchen', icon: ChefHat, label: t('nav.kitchen'), allowed: isRestaurant && (isAdmin || isKitchen) }, // Only for Restaurant
    { id: 'orders', icon: FileText, label: t('nav.orders'), allowed: !isKitchen },
    { id: 'customers', icon: Users, label: t('nav.customers'), allowed: !isWaiter && !isKitchen },
    { id: 'dashboard', icon: BarChart3, label: t('nav.dashboard'), allowed: isAdmin },
    { id: 'settings', icon: SettingsIcon, label: t('nav.settings'), allowed: isAdmin },
  ];

  const navItems = allNavItems.filter(i => i.allowed);

  return (
    <>
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 flex items-center px-2 py-2 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)] overflow-x-auto no-scrollbar gap-1">
        {navItems.map(item => {
           const isActive = currentTab === item.id;
           return (
            <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`relative flex flex-col items-center justify-center p-2 rounded-2xl min-w-[70px] flex-1 transition-all duration-300 shrink-0 ${isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-brand-50 translate-y-[-2px]' : ''}`}>
                    <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] mt-1 font-bold ${language === 'km' ? 'font-display' : ''} ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                    {item.label}
                </span>
            </button>
          )
        })}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-full p-6 z-50 shadow-soft">
        <div className="mb-8 px-2">
           <Logo className="w-10 h-10" textClassName="text-2xl" />
        </div>
        
        {currentShop && (
            <div className="mb-6 px-4 py-3 bg-brand-50 rounded-2xl border border-brand-100">
                <p className="text-[10px] uppercase font-bold text-brand-400 mb-1">Current Shop</p>
                <h3 className={`font-bold text-brand-900 truncate ${language === 'km' ? 'font-display' : ''}`}>
                    {currentShop.name}
                </h3>
            </div>
        )}

        <div className="flex flex-col gap-3 w-full">
            {navItems.map(item => {
                const isActive = currentTab === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                            isActive 
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' 
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
                        <span className={`font-bold text-sm ${language === 'km' ? 'font-display' : ''}`}>{item.label}</span>
                    </button>
                )
            })}
        </div>

        <div className="mt-auto space-y-4">
            {/* Operator Card */}
            {activeStaff && settings.enableMultiRoles && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-gray-100">
                    <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center font-bold">
                        {activeStaff.name.substring(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm truncate">{activeStaff.name}</p>
                        <p className="text-xs text-gray-500 uppercase">{activeStaff.role}</p>
                    </div>
                </div>
            )}

            {user && settings.enableMultiRoles && (
                <button 
                    onClick={logoutStaff}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:bg-brand-50 hover:text-brand-600 rounded-2xl transition-colors font-medium text-sm"
                >
                    <Lock size={20} />
                    <span>{language === 'km' ? 'ចាក់សោអេក្រង់' : 'Lock Screen'}</span>
                </button>
            )}

            <button 
                onClick={signOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-colors font-medium text-sm"
            >
                <LogOut size={20} />
                <span>{user?.id === 'demo-user-id' ? (language === 'km' ? 'ចាកចេញពី Demo' : 'Exit Demo') : (language === 'km' ? 'ចាកចេញពីហាង' : 'Sign Out')}</span>
            </button>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-3 font-medium">Switch Language / ប្តូរភាសា</p>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <button 
                        onClick={() => setLanguage('en')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${language === 'en' ? 'bg-brand-100 text-brand-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        ENG
                    </button>
                    <button 
                        onClick={() => setLanguage('km')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${language === 'km' ? 'bg-brand-100 text-brand-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        ខ្មែរ
                    </button>
                </div>
            </div>
        </div>
      </div>
    </>
  );
};

const MainContent = () => {
    const [activeTab, setActiveTab] = useState('pos');
    const { currentShop, user, loadingAuth, activeStaff, settings, staffList, switchStaff, language, signOut, pendingWrites } = useStore();
    const [viewMode, setViewMode] = useState<'app' | 'receipt' | 'store' | 'license' | 'manual'>('app');
    const [receiptId, setReceiptId] = useState<string | null>(null);
    const [authView, setAuthView] = useState<'landing' | 'login'>('landing');

    // --- Secure Passkey Vault State ---
    const { isUnlocked, checkVaultStatus } = useZkVault();
    const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
    const [checkingVault, setCheckingVault] = useState(false);

    useEffect(() => {
        if (user) {
            setCheckingVault(true);
            checkVaultStatus(user.id)
                .then((s) => {
                    setVaultStatus(s);
                    setCheckingVault(false);
                })
                .catch((err) => {
                    console.error("Vault status check failed:", err);
                    setCheckingVault(false);
                });
        } else {
            setVaultStatus(null);
        }
    }, [user, checkVaultStatus]);

    const userNeedsVaultSetup = user && vaultStatus && !vaultStatus.exists;
    const userNeedsVaultUnlock = user && vaultStatus && vaultStatus.exists && !isUnlocked;

    // --- PWA LOGIC & CONNECTION TRACKING ---
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);

    useEffect(() => {
        // Track Network connection
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Before Install Prompt Handler
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);

        const handleAppInstalled = () => {
            console.log('[LITTLE TONY APP PWA] App installed successfully');
            setShowInstallBanner(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const triggerPwaInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[LITTLE TONY APP PWA] User prompt decision: ${outcome}`);
        setShowInstallBanner(false);
        setDeferredPrompt(null);
    };

    // Parse URL params & Path for routing logic
    useEffect(() => {
        const hash = window.location.hash; // e.g. "#/s/123"
        const params = new URLSearchParams(window.location.search);
        
        // 1. Hash-based Routing (New Standard)
        // Matches #/s/ID or #/s/ID?params
        const shopMatch = hash.match(/^#\/s\/([^/?]+)/);
        const receiptMatch = hash.match(/^#\/r\/([^/?]+)/);

        if (receiptMatch && receiptMatch[1]) {
            setReceiptId(receiptMatch[1]);
            setViewMode('receipt');
            return;
        }

        if (shopMatch && shopMatch[1]) {
            setViewMode('store');
            return;
        }

        // 2. Query Param Routing (Legacy)
        const mode = params.get('mode');
        if (mode === 'store') {
            setViewMode('store');
            return;
        }
        if (mode === 'license') {
            setViewMode('license');
            return;
        }
        if (mode === 'manual') {
            setViewMode('manual');
            return;
        }

        const orderId = params.get('orderId');
        if (orderId) {
            setActiveTab('orders');
        }

    }, []);

    // Auto-login effect for single-role mode
    useEffect(() => {
        if (user && currentShop && !activeStaff && !settings.enableMultiRoles && staffList.length > 0) {
            const admin = staffList.find(s => s.role === 'admin') || staffList[0];
            if (admin) {
                switchStaff(admin.pin, admin.id);
            }
        }
    }, [user, currentShop, activeStaff, settings.enableMultiRoles, staffList, switchStaff]);

    // Force redirect to Kitchen view if user is kitchen role
    useEffect(() => {
        if (activeStaff?.role === 'kitchen' && activeTab !== 'kitchen') {
            setActiveTab('kitchen');
        }
    }, [activeStaff, activeTab]);

    // 1. License Page (Public)
    if (viewMode === 'license') {
        return <CommunityLicense />;
    }

    // 2. User Manual (Public)
    if (viewMode === 'manual') {
        return <UserManual />;
    }

    // 3. Receipt View (Public)
    if (viewMode === 'receipt' && receiptId) {
        return <ReceiptView receiptId={receiptId} />;
    }

    // 4. Public Store View (Public)
    if (viewMode === 'store') {
        return <PublicStore />;
    }

    // 5. Admin Views (Protected)
    
    // Auth Loading
    if (loadingAuth || (user && !vaultStatus && checkingVault)) {
        return (
            <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-brand-600" size={48} />
            </div>
        );
    }

    // --- ACCESS LOGIC ---
    
    // Condition 1: Not Logged in at all (Neither Owner nor Staff)
    // Public visitors land on the marketing page; "Get Started" opens Login.
    if (!user && !activeStaff) {
        if (authView === 'landing') {
            return <Landing onGetStarted={() => setAuthView('login')} />;
        }
        return <Login onBack={() => setAuthView('landing')} />;
    }

    // Condition 2: Owner Logged in but No Shop Set Up
    if (user && !currentShop) {
        return <ShopSetup />;
    }

    // Secure Passkey Vault checks
    if (user && currentShop) {
        if (userNeedsVaultSetup) {
            return (
                <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className="flex justify-center mb-6 animate-pulse">
                            <Logo className="w-12 h-12" textClassName="text-2xl text-white" />
                        </div>
                        <VaultSetup 
                            userId={user.id} 
                            userEmail={user.email || ''} 
                            onSuccess={() => checkVaultStatus(user.id).then(setVaultStatus)} 
                        />
                        <div className="text-center mt-6">
                            <button 
                                onClick={signOut} 
                                className="text-sm font-semibold text-slate-400 hover:text-white underline transition-all"
                            >
                                {language === 'km' ? 'ចាកចេញពីគណនី' : 'Cancel & Sign Out'}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (userNeedsVaultUnlock) {
            return (
                <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md">
                        <div className="flex justify-center mb-6">
                            <Logo className="w-12 h-12" textClassName="text-2xl text-white" />
                        </div>
                        <VaultUnlock 
                            userId={user.id} 
                            onSuccess={() => checkVaultStatus(user.id).then(setVaultStatus)} 
                        />
                        <div className="text-center mt-6">
                            <button 
                                onClick={signOut} 
                                className="text-sm font-semibold text-slate-400 hover:text-white underline transition-all"
                            >
                                {language === 'km' ? 'ចាកចេញពីគណនី' : 'Cancel & Sign Out'}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
    }

    // Condition 3: Shared Device Lock (Owner logged in, but no active operator selected)
    if (user && currentShop && !activeStaff) {
        if (settings.enableMultiRoles) {
            return <LockScreen />;
        } else {
            return (
                <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-50">
                    <Loader2 className="animate-spin text-brand-600" size={48} />
                </div>
            );
        }
    }

    // Condition 4: Authorized Access (Either Owner+ActiveStaff OR StaffLogin)
    // Main App
    return (
        <div className="flex flex-col h-[100dvh] w-full bg-slate-50 overflow-hidden relative">
            {isOffline && (
                <div className="bg-amber-600 text-white text-center py-2 px-4 flex items-center justify-center gap-2 text-xs font-bold shadow-sm z-[9999] shrink-0 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>
                        {language === 'km'
                            ? 'របៀបក្រៅបណ្តាញ (Offline Mode) — ប្រព័ន្ធដំណើរការជាធម្មតា។'
                            : 'Offline Mode — the app keeps working.'}
                        {pendingWrites > 0 && (
                            language === 'km'
                                ? ` ${pendingWrites} ការផ្លាស់ប្តូរនឹងធ្វើសមកាលកម្មនៅពេលមានអ៊ីនធឺណិត។`
                                : ` ${pendingWrites} change${pendingWrites === 1 ? '' : 's'} will sync when back online.`)}
                    </span>
                </div>
            )}
            {!isOffline && pendingWrites > 0 && (
                <div className="bg-brand-600 text-white text-center py-2 px-4 flex items-center justify-center gap-2 text-xs font-bold shadow-sm z-[9999] shrink-0">
                    <Loader2 size={12} className="animate-spin" />
                    <span>
                        {language === 'km'
                            ? `កំពុងធ្វើសមកាលកម្ម ${pendingWrites} ការផ្លាស់ប្តូរ...`
                            : `Syncing ${pendingWrites} pending change${pendingWrites === 1 ? '' : 's'}…`}
                    </span>
                </div>
            )}
            
            <div className="flex flex-1 h-full w-full bg-slate-50 overflow-hidden min-h-0 relative">
                <Navigation currentTab={activeTab} setTab={setActiveTab} />
                
                <main className="flex-1 h-full overflow-hidden relative flex flex-col">
                    <TopBar />
                    
                    {/* Content Container - Use flex-1 with min-h-0 to ensure children can scroll */}
                    <div className="flex-1 overflow-hidden pt-[60px] pb-[85px] md:pt-0 md:pb-0 h-full w-full relative flex flex-col min-h-0">
                        {activeTab === 'pos' && <POS />}
                        {activeTab === 'inventory' && <Inventory />}
                        {activeTab === 'tables' && <Tables />}
                        {activeTab === 'orders' && <Orders />}
                        {activeTab === 'customers' && <Customers />}
                        {activeTab === 'dashboard' && <Dashboard />}
                        {activeTab === 'settings' && <Settings />}
                        {activeTab === 'kitchen' && <Kitchen />}
                    </div>
                </main>
            </div>

            {showInstallBanner && (
                <div className="fixed bottom-24 md:bottom-6 right-6 max-w-sm bg-white border border-gray-100 rounded-2xl shadow-xl p-4 z-[9999] flex items-start gap-4 backdrop-blur-xl transition-all font-sans">
                    <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 leading-tight">
                            {language === 'km' ? 'ដំឡើងកម្មវិធី Little Tony APP' : 'Install Little Tony APP'}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1 leading-snug">
                            {language === 'km' 
                                ? 'ដំណើរការលឿន គ្រប់គ្រងការលក់ និងទិន្នន័យទោះគ្មានអ៊ីនធឺណិត!' 
                                : 'Enable direct local speeds, quick-launch, and responsive offline operations.'}
                        </p>
                        <div className="flex gap-2 mt-3.5">
                            <button 
                                onClick={triggerPwaInstall}
                                className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-100"
                            >
                                {language === 'km' ? 'ដំឡើងឥឡូវ' : 'Install Now'}
                            </button>
                            <button 
                                onClick={() => setShowInstallBanner(false)}
                                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-semibold transition-all"
                            >
                                {language === 'km' ? 'បិទ' : 'Dismiss'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function App() {
  return (
    <StoreProvider>
      <UIProvider>
        <VaultProvider storageAdapter={supabaseVaultAdapter}>
          <MainContent />
        </VaultProvider>
      </UIProvider>
    </StoreProvider>
  );
}

export default App;
