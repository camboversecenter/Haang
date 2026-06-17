// src/wallet/useWalletSigner.ts
//
// React hook that owns a single signer-worker instance, ties it to your storage
// adapter, and runs the WebAuthn ceremony (which must happen on the document
// thread) before handing the PRF bytes to the worker.
//
// DUAL SECRET SUPPORT: `createWallet` makes a fresh mnemonic wallet,
// `importWallet` restores from a phrase, `importPrivateKey` imports a raw key,
// and `revealSecret` re-exports whichever secret the wallet holds (for backup).

import { useCallback, useEffect, useRef, useState } from 'react';
import { WalletSignerClient, SecretBackup } from './WalletSignerClient';
import { WalletVaultRecord, EthSignature, Argon2Params, WalletSecretKind } from './messages';
import {
  registerPasskeyPrf,
  authenticatePasskeyPrf,
  isWebAuthnAvailable,
} from './webauthn-prf';

export interface WalletStorageAdapter {
  load: (userId: string) => Promise<WalletVaultRecord | null>;
  // Must persist all fields atomically (single transaction / single update).
  save: (userId: string, record: WalletVaultRecord) => Promise<void>;
}

export interface UseWalletSignerOptions {
  storage: WalletStorageAdapter;
  argon2?: Argon2Params;
  onError?: (err: Error) => void;
}

export type ProvisionResult = { address: string } & SecretBackup;

export function useWalletSigner({ storage, argon2, onError }: UseWalletSignerOptions) {
  const clientRef = useRef<WalletSignerClient | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [secretKind, setSecretKind] = useState<WalletSecretKind | null>(null);

  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = new WalletSignerClient();
    return clientRef.current;
  }, []);

  const fail = useCallback(
    (err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err));
      onError?.(e);
      return e;
    },
    [onError]
  );

  useEffect(() => {
    return () => {
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, []);

  // Shared path for create + import. Returns the secret so the caller can show a
  // one-time backup screen (mnemonic OR private key, per secretKind).
  const provision = useCallback(
    async (
      userId: string,
      passcode: string,
      opts?: {
        withPasskey?: boolean;
        email?: string;
        importMnemonic?: string;
        importPrivateKeyHex?: string;
        wordCount?: 12 | 24;
        accountIndex?: number;
      }
    ): Promise<ProvisionResult | null> => {
      try {
        let prfFirstHex: string | undefined;
        let passkeyId: string | undefined;
        if (opts?.withPasskey) {
          if (!isWebAuthnAvailable()) throw new Error('WebAuthn not available.');
          const reg = await registerPasskeyPrf(userId, opts.email ?? userId);
          prfFirstHex = reg.prfFirstHex;
          passkeyId = reg.passkeyId;
        }
        const res = await getClient().generate(passcode, {
          prfFirstHex,
          passkeyId,
          argon2,
          importMnemonic: opts?.importMnemonic,
          importPrivateKeyHex: opts?.importPrivateKeyHex,
          wordCount: opts?.wordCount,
          accountIndex: opts?.accountIndex,
        });
        await storage.save(userId, res.record);
        setAddress(res.address);
        setSecretKind(res.secretKind);
        setIsUnlocked(true);
        return {
          address: res.address,
          secretKind: res.secretKind,
          mnemonic: res.mnemonic,
          privateKeyHex: res.privateKeyHex,
        };
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [getClient, storage, argon2, fail]
  );

  // Create a brand-new mnemonic (HD) wallet. The returned mnemonic must be shown
  // for backup, then dropped from memory.
  const createWallet = useCallback(
    (
      userId: string,
      passcode: string,
      opts?: { withPasskey?: boolean; email?: string; wordCount?: 12 | 24 }
    ) => provision(userId, passcode, opts),
    [provision]
  );

  // Restore an HD wallet from a recovery phrase.
  const importWallet = useCallback(
    (
      userId: string,
      passcode: string,
      mnemonic: string,
      opts?: { withPasskey?: boolean; email?: string; accountIndex?: number }
    ) => provision(userId, passcode, { ...opts, importMnemonic: mnemonic }),
    [provision]
  );

  // Import a single raw private key (single-account wallet, no recovery phrase).
  const importPrivateKey = useCallback(
    (
      userId: string,
      passcode: string,
      privateKeyHex: string,
      opts?: { withPasskey?: boolean; email?: string }
    ) => provision(userId, passcode, { ...opts, importPrivateKeyHex: privateKeyHex }),
    [provision]
  );

  const unlockWithPin = useCallback(
    async (userId: string, passcode: string, accountIndex = 0): Promise<boolean> => {
      try {
        const record = await storage.load(userId);
        if (!record) return false;
        const { address: addr, secretKind: kind } = await getClient().unlockWithPin({
          passcode,
          pinSalt: record.pinSalt,
          pinEnvelope: record.pinEnvelope,
          walletEnvelope: record.walletEnvelope,
          argon2,
          accountIndex,
        });
        setAddress(addr);
        setSecretKind(kind);
        setIsUnlocked(true);
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [getClient, storage, argon2, fail]
  );

  const unlockWithPasskey = useCallback(
    async (userId: string, accountIndex = 0): Promise<boolean> => {
      try {
        const record = await storage.load(userId);
        if (!record || !record.passkeyEnvelope || !record.passkeyId) return false;
        const prfFirstHex = await authenticatePasskeyPrf(record.passkeyId);
        const { address: addr, secretKind: kind } = await getClient().unlockWithPasskey({
          prfFirstHex,
          passkeyEnvelope: record.passkeyEnvelope,
          walletEnvelope: record.walletEnvelope,
          accountIndex,
        });
        setAddress(addr);
        setSecretKind(kind);
        setIsUnlocked(true);
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [getClient, storage, fail]
  );

  // Reveal the secret (phrase or key) for backup. GATE THIS behind fresh re-auth
  // and an unforgeable confirmation surface (see README-wallet).
  const revealSecret = useCallback(async (): Promise<SecretBackup | null> => {
    try {
      return await getClient().exportSecret();
    } catch (err) {
      fail(err);
      return null;
    }
  }, [getClient, fail]);

  // Convenience: mnemonic-only reveal (returns null on error or for raw-key wallets).
  const revealMnemonic = useCallback(async (): Promise<string | null> => {
    try {
      return await getClient().exportMnemonic();
    } catch (err) {
      fail(err);
      return null;
    }
  }, [getClient, fail]);

  // Signs a 32-byte digest (hex). Pair this with a user-confirmation step that a
  // compromised page cannot forge (see README-wallet on transaction approval).
  const signDigest = useCallback(
    async (digestHex: string): Promise<EthSignature | null> => {
      try {
        return await getClient().signDigest(digestHex);
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [getClient, fail]
  );

  const personalSign = useCallback(
    async (message: string): Promise<EthSignature | null> => {
      try {
        return await getClient().personalSign(message);
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [getClient, fail]
  );

  const lock = useCallback(async () => {
    await clientRef.current?.lock();
    setIsUnlocked(false);
    setAddress(null);
    setSecretKind(null);
  }, []);

  return {
    isUnlocked,
    address,
    secretKind,
    createWallet,
    importWallet,
    importPrivateKey,
    unlockWithPin,
    unlockWithPasskey,
    revealSecret,
    revealMnemonic,
    signDigest,
    personalSign,
    lock,
  };
}
