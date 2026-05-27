
import React, { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, Check, AlertTriangle } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface UIContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  showAlert: (title: string, message: string) => Promise<void>;
  showConfirm: (title: string, message: string, confirmLabel?: string, cancelLabel?: string) => Promise<boolean>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Toast State ---
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // --- Alert State ---
  const [alertState, setAlertState] = useState<AlertState>({ isOpen: false, title: '', message: '' });
  const alertResolver = useRef<(() => void) | null>(null);

  // --- Confirm State ---
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '' });
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);

  // --- Actions ---

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 3s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const showAlert = (title: string, message: string): Promise<void> => {
    setAlertState({ isOpen: true, title, message });
    return new Promise((resolve) => {
      alertResolver.current = resolve;
    });
  };

  const handleAlertClose = () => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
    if (alertResolver.current) alertResolver.current();
  };

  const showConfirm = (title: string, message: string, confirmLabel = "Confirm", cancelLabel = "Cancel"): Promise<boolean> => {
    setConfirmState({ isOpen: true, title, message, confirmLabel, cancelLabel });
    return new Promise((resolve) => {
      confirmResolver.current = resolve;
    });
  };

  const handleConfirmClose = (result: boolean) => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
    if (confirmResolver.current) confirmResolver.current(result);
  };

  return (
    <UIContext.Provider value={{ showToast, showAlert, showConfirm }}>
      {children}
      
      {/* --- Toast Container --- */}
      <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none gap-2 px-4">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-[slide-down_0.3s_ease-out] min-w-[300px] max-w-sm
              ${toast.type === 'success' ? 'bg-white border-green-100 text-gray-800' : ''}
              ${toast.type === 'error' ? 'bg-white border-red-100 text-gray-800' : ''}
              ${toast.type === 'info' ? 'bg-white border-blue-100 text-gray-800' : ''}
            `}
          >
            <div className={`
              p-1.5 rounded-full 
              ${toast.type === 'success' ? 'bg-green-100 text-green-600' : ''}
              ${toast.type === 'error' ? 'bg-red-100 text-red-600' : ''}
              ${toast.type === 'info' ? 'bg-blue-100 text-blue-600' : ''}
            `}>
              {toast.type === 'success' && <Check size={16} strokeWidth={3} />}
              {toast.type === 'error' && <AlertCircle size={16} strokeWidth={3} />}
              {toast.type === 'info' && <Info size={16} strokeWidth={3} />}
            </div>
            <span className="text-sm font-bold flex-1">{toast.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* --- Alert Modal --- */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-[scale-in_0.2s_ease-out]">
            <div className="flex flex-col items-center text-center">
               <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mb-4">
                  <Info size={32} />
               </div>
               <h3 className="text-xl font-bold text-gray-800 mb-2">{alertState.title}</h3>
               <p className="text-gray-500 mb-6">{alertState.message}</p>
               <button 
                onClick={handleAlertClose}
                className="w-full bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-colors"
               >
                 OK
               </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Confirm Modal --- */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-[scale-in_0.2s_ease-out]">
            <div className="flex flex-col items-center text-center">
               <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle size={32} />
               </div>
               <h3 className="text-xl font-bold text-gray-800 mb-2">{confirmState.title}</h3>
               <p className="text-gray-500 mb-6">{confirmState.message}</p>
               <div className="flex gap-3 w-full">
                 <button 
                  onClick={() => handleConfirmClose(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                 >
                   {confirmState.cancelLabel || 'Cancel'}
                 </button>
                 <button 
                  onClick={() => handleConfirmClose(true)}
                  className="flex-1 bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-colors"
                 >
                   {confirmState.confirmLabel || 'Confirm'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
};
