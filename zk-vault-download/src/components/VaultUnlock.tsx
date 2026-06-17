// src/components/VaultUnlock.tsx

import React, { useState, useEffect } from 'react';
import { useZkVault } from '../zk-vault/hooks';
import { Lock, Loader2, Fingerprint, Key, AlertCircle } from 'lucide-react';

interface VaultUnlockProps {
  userId: string;
  onSuccess?: () => void;
}

const MIN_LEN = 8;
const LOCKOUT_AFTER = 3; // start backing off after this many failures

// Persist lockout across reloads so a refresh can't reset the throttle.
// NOTE: this is a UX speed-bump only. Real brute-force protection must live
// server-side (e.g. Supabase RLS / an API rate limiter), because a determined
// attacker controls the client and can clear this store.
function lockoutKey(userId: string) {
  return `zk-vault:lockout:${userId}`;
}
function readLockout(userId: string): { until: number; attempts: number } {
  try {
    const raw = sessionStorage.getItem(lockoutKey(userId));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { until: 0, attempts: 0 };
}
function writeLockout(userId: string, until: number, attempts: number) {
  try {
    sessionStorage.setItem(
      lockoutKey(userId),
      JSON.stringify({ until, attempts })
    );
  } catch {
    /* ignore */
  }
}
function clearLockout(userId: string) {
  try {
    sessionStorage.removeItem(lockoutKey(userId));
  } catch {
    /* ignore */
  }
}

export default function VaultUnlock({ userId, onSuccess }: VaultUnlockProps) {
  const { unlockWithPin, unlockWithPasskey } = useZkVault();
  const [passcode, setPasscode] = useState('');

  const [isProcessingPasskey, setIsProcessingPasskey] = useState(false);
  const [isProcessingPin, setIsProcessingPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = readLockout(userId);
  const [attempts, setAttempts] = useState(initial.attempts);
  const [lockoutUntil, setLockoutUntil] = useState(initial.until);
  const [remainingLockout, setRemainingLockout] = useState(
    Math.max(0, Math.ceil((initial.until - Date.now()) / 1000))
  );

  useEffect(() => {
    if (lockoutUntil <= 0) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setRemainingLockout(remaining);
      if (remaining <= 0) {
        setError(null);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handlePasskeyUnlock = async () => {
    setIsProcessingPasskey(true);
    setError(null);

    const success = await unlockWithPasskey(userId);

    if (success) {
      clearLockout(userId);
      if (onSuccess) onSuccess();
    } else {
      setError('Passkey authentication failed or cancelled.');
    }

    setIsProcessingPasskey(false);
  };

  const handlePinUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.length < MIN_LEN || remainingLockout > 0) return;

    setIsProcessingPin(true);
    setError(null);

    const success = await unlockWithPin(passcode, userId);

    if (success) {
      setAttempts(0);
      clearLockout(userId);
      if (onSuccess) onSuccess();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPasscode('');

      if (newAttempts >= LOCKOUT_AFTER) {
        // Exponential backoff: 1s, 2s, 4s, 8s ... capped at 30s.
        const backoffMs = Math.min(
          Math.pow(2, newAttempts - LOCKOUT_AFTER) * 1000,
          30000
        );
        const until = Date.now() + backoffMs;
        setLockoutUntil(until);
        setRemainingLockout(Math.ceil(backoffMs / 1000));
        writeLockout(userId, until, newAttempts);
        setError(`Too many attempts. Try again in ${Math.ceil(backoffMs / 1000)}s.`);
      } else {
        writeLockout(userId, 0, newAttempts);
        setError('Incorrect recovery passcode.');
      }
    }

    setIsProcessingPin(false);
  };

  const isProcessing = isProcessingPasskey || isProcessingPin;
  const isLockedOut = remainingLockout > 0;

  return (
    <div className="max-w-md mx-auto p-8 bg-white border border-stone-200 rounded-3xl shadow-sm text-center">
      <div className="inline-flex w-16 h-16 bg-stone-100 text-stone-700 rounded-2xl items-center justify-center mb-6">
        <Lock size={32} />
      </div>

      <h2 className="text-2xl font-bold text-stone-900 mb-2">Vault Locked</h2>
      <p className="text-sm text-stone-500 mb-8 leading-relaxed max-w-xs mx-auto">
        Hardware decryption is required to access your end-to-end encrypted data.
      </p>

      <div className="space-y-6">
        <button
          onClick={handlePasskeyUnlock}
          disabled={isProcessing || isLockedOut}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 shadow-sm shadow-indigo-600/20"
        >
          {isProcessingPasskey ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Fingerprint size={20} />
          )}
          Unlock with FaceID / TouchID
        </button>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-stone-100" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            OR USE PASSCODE
          </span>
          <div className="h-px flex-1 bg-stone-100" />
        </div>

        <form onSubmit={handlePinUnlock} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter recovery passcode"
              autoComplete="current-password"
              disabled={isProcessing || isLockedOut}
              className="w-full bg-stone-50 border border-stone-200 focus:border-stone-400 rounded-xl px-4 py-4 text-center text-lg focus:outline-none transition-all placeholder:text-sm disabled:opacity-50"
            />
            <Key
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-red-500">
              <AlertCircle size={14} />
              <p className="text-xs font-bold uppercase tracking-wider">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || passcode.length < MIN_LEN || isLockedOut}
            className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isProcessingPin ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isLockedOut ? (
              `Locked out (${remainingLockout}s)`
            ) : (
              'Decrypt with Passcode'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
