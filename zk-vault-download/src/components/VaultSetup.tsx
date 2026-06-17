// src/components/VaultSetup.tsx

import React, { useState } from 'react';
import { useZkVault } from '../zk-vault/hooks';
import { Shield, Loader2, Key, Fingerprint, ArrowRight } from 'lucide-react';

interface VaultSetupProps {
  userId: string;
  userEmail: string;
  onSuccess?: () => void;
}

const MIN_LEN = 8;

function scorePasscode(pc: string): { label: string; pct: number; tone: string } {
  let score = 0;
  if (pc.length >= MIN_LEN) score++;
  if (pc.length >= 12) score++;
  if (/[a-z]/.test(pc) && /[A-Z]/.test(pc)) score++;
  if (/\d/.test(pc)) score++;
  if (/[^A-Za-z0-9]/.test(pc)) score++;
  const pct = Math.min(100, (score / 5) * 100);
  if (score <= 1) return { label: 'Weak', pct, tone: 'bg-red-400' };
  if (score <= 3) return { label: 'Fair', pct, tone: 'bg-amber-400' };
  return { label: 'Strong', pct, tone: 'bg-green-500' };
}

export default function VaultSetup({ userId, userEmail, onSuccess }: VaultSetupProps) {
  const { setupVault } = useZkVault();
  const [passcode, setPasscode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = scorePasscode(passcode);
  const canSubmit = passcode.length >= MIN_LEN && !isProcessing;

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.length < MIN_LEN) return;

    setIsProcessing(true);
    setError(null);

    const success = await setupVault(passcode, userId, userEmail);

    if (success) {
      if (onSuccess) onSuccess();
    } else {
      setError('Failed to secure vault. Please try again.');
    }

    setIsProcessing(false);
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-white border border-stone-200 rounded-3xl shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl items-center justify-center mb-4">
          <Shield size={32} />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Initialize Your Vault</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          Your vault is secured by two keys. First, create a recovery passcode.
          Then, link this device&apos;s biometrics.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
          <Key className="text-stone-400 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-stone-900">1. Recovery Passcode</p>
            <p className="text-xs text-stone-500 mt-1">
              At least {MIN_LEN} characters. Used to recover your data on new devices.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
          <Fingerprint className="text-indigo-400 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-stone-900">2. Hardware Passkey</p>
            <p className="text-xs text-stone-500 mt-1">
              You will be prompted to use FaceID or TouchID after submitting your passcode.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSetup} className="space-y-4">
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder={`Create ${MIN_LEN}+ character passcode`}
          autoComplete="new-password"
          className="w-full bg-stone-50 border border-stone-200 focus:border-indigo-500 rounded-xl px-4 py-4 text-center text-lg focus:outline-none transition-all placeholder:text-sm"
        />

        {passcode.length > 0 && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${strength.tone} transition-all duration-300`}
                style={{ width: `${strength.pct}%` }}
              />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 text-right">
              {strength.label}
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 font-bold uppercase tracking-wider text-center">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-4 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              Secure Vault &amp; Link Device <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
