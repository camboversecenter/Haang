// src/wallet/signer.worker.ts
//
// Isolated signer. The secret (mnemonic OR raw private key) and the active
// derived/loaded private key live ONLY in this worker's memory. The main thread
// can ask it to unlock, sign, report its address, and — on the explicit backup
// path — export the secret. A compromised main thread cannot read secrets out of
// here passively; it can only request signatures while unlocked, or call
// exportSecret (which is why per-action confirmation still matters — see
// README-wallet).

/// <reference lib="webworker" />

import {
  generateWallet,
  unlockWithPin,
  unlockWithPasskey,
  signDigest,
  personalSignDigest,
  unhex,
  DEFAULT_ARGON2,
} from './crypto-core';
import { SignerRequest, SignerResponse, WalletSecretKind } from './messages';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// Secret material — confined to this worker. Exactly one of mnemonic /
// privateKeyHex is set, matching secretKind.
let secretKind: WalletSecretKind | null = null;
let mnemonic: string | null = null;
let privateKeyHex: string | null = null;
let privateKey: Uint8Array | null = null;
let dek: CryptoKey | null = null;
let address: string | null = null;
let accountIndex = 0;

function zeroize() {
  if (privateKey) privateKey.fill(0);
  privateKey = null;
  dek = null;
  address = null;
  accountIndex = 0;
  secretKind = null;
  // JS strings are immutable, so we cannot scrub the bytes; dropping the only
  // reference makes it eligible for GC. Keep unlocked sessions short and lock
  // aggressively for stronger guarantees.
  mnemonic = null;
  privateKeyHex = null;
}

function reply(msg: SignerResponse) {
  ctx.postMessage(msg);
}

ctx.addEventListener('message', async (ev: MessageEvent<SignerRequest>) => {
  const req = ev.data;
  try {
    switch (req.type) {
      case 'generate': {
        const prf = req.prfFirstHex ? unhex(req.prfFirstHex) : undefined;
        const res = await generateWallet(req.passcode, req.argon2 ?? DEFAULT_ARGON2, {
          prfFirst: prf,
          importMnemonic: req.importMnemonic,
          importPrivateKeyHex: req.importPrivateKeyHex,
          wordCount: req.wordCount,
          accountIndex: req.accountIndex,
        });
        // Retain secret material in the worker; expose envelopes + address, plus
        // the secret ONCE so the app can present a backup screen.
        secretKind = res.secretKind;
        mnemonic = res.mnemonic;
        privateKeyHex = res.privateKeyHex;
        privateKey = res.privateKey;
        dek = res.dek;
        address = res.address;
        accountIndex = res.accountIndex;
        reply({
          id: req.id,
          ok: true,
          type: 'generate',
          address: res.address,
          secretKind: res.secretKind,
          mnemonic: res.mnemonic,
          privateKeyHex: res.privateKeyHex,
          record: {
            pinSalt: res.pinSalt,
            pinEnvelope: JSON.stringify(res.pinEnvelope),
            passkeyEnvelope: res.passkeyEnvelope
              ? JSON.stringify(res.passkeyEnvelope)
              : null,
            passkeyId: req.passkeyId ?? null,
            walletEnvelope: JSON.stringify(res.walletEnvelope),
          },
        });
        break;
      }

      case 'unlockPin': {
        const out = await unlockWithPin(
          req.passcode,
          req.pinSalt,
          JSON.parse(req.pinEnvelope),
          JSON.parse(req.walletEnvelope),
          req.argon2 ?? DEFAULT_ARGON2,
          req.accountIndex ?? 0
        );
        secretKind = out.secretKind;
        mnemonic = out.mnemonic;
        privateKeyHex = out.privateKeyHex;
        privateKey = out.privateKey;
        dek = out.dek;
        address = out.address;
        accountIndex = out.accountIndex;
        reply({ id: req.id, ok: true, type: 'unlockPin', address: out.address, secretKind: out.secretKind });
        break;
      }

      case 'unlockPasskey': {
        const out = await unlockWithPasskey(
          unhex(req.prfFirstHex),
          JSON.parse(req.passkeyEnvelope),
          JSON.parse(req.walletEnvelope),
          req.accountIndex ?? 0
        );
        secretKind = out.secretKind;
        mnemonic = out.mnemonic;
        privateKeyHex = out.privateKeyHex;
        privateKey = out.privateKey;
        dek = out.dek;
        address = out.address;
        accountIndex = out.accountIndex;
        reply({ id: req.id, ok: true, type: 'unlockPasskey', address: out.address, secretKind: out.secretKind });
        break;
      }

      case 'signDigest': {
        if (!privateKey) throw new Error('Signer is locked.');
        const signature = signDigest(privateKey, unhex(req.digestHex));
        reply({ id: req.id, ok: true, type: 'signDigest', signature });
        break;
      }

      case 'personalSign': {
        if (!privateKey) throw new Error('Signer is locked.');
        const digest = personalSignDigest(req.message);
        const signature = signDigest(privateKey, digest);
        reply({ id: req.id, ok: true, type: 'personalSign', signature });
        break;
      }

      case 'getAddress': {
        reply({ id: req.id, ok: true, type: 'getAddress', address });
        break;
      }

      case 'exportSecret': {
        // DELIBERATE isolation breach for backup / "reveal recovery phrase or key".
        // Only available while unlocked. The caller MUST gate this behind fresh
        // re-authentication and a confirmation surface a compromised page cannot
        // forge (cross-origin iframe). See README-wallet.
        if (!secretKind) throw new Error('Signer is locked.');
        reply({
          id: req.id,
          ok: true,
          type: 'exportSecret',
          secretKind,
          mnemonic,
          privateKeyHex,
        });
        break;
      }

      case 'lock': {
        zeroize();
        reply({ id: req.id, ok: true, type: 'lock' });
        break;
      }
    }
  } catch (err) {
    reply({
      id: (req as { id: number }).id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Wipe secrets if the worker is told to terminate gracefully.
ctx.addEventListener('unload', zeroize);

void dek; // retained for potential re-key flows; intentionally unused here
