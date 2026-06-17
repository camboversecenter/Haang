// src/wallet/index.ts

export * from './messages';
export { WalletSignerClient } from './WalletSignerClient';
export type { GenerateClientOptions, SecretBackup } from './WalletSignerClient';
export { useWalletSigner } from './useWalletSigner';
export type {
  WalletStorageAdapter,
  UseWalletSignerOptions,
  ProvisionResult,
} from './useWalletSigner';
export {
  isWebAuthnAvailable,
  registerPasskeyPrf,
  authenticatePasskeyPrf,
} from './webauthn-prf';
// Validation/format helpers (safe on the main thread for input UX). The actual
// derivation/sign/unlock functions run inside the worker and are intentionally
// NOT re-exported here, to discourage main-thread use of secret material.
export {
  newMnemonic,
  normalizeMnemonic,
  isValidMnemonic,
  assertValidMnemonic,
  normalizePrivateKeyHex,
  isValidPrivateKeyHex,
  ethDerivationPath,
} from './crypto-core';
export type { WalletSecret } from './crypto-core';
