// src/zk-vault/types.ts

import { EncryptedPayload } from './crypto';

export interface VaultEnvelopes {
  pinEnvelope: string | null;     // JSON string of EncryptedPayload
  pinSalt: string | null;         // Hex string
  passkeyEnvelope: string | null; // JSON string of EncryptedPayload
  passkeyId: string | null;       // Hex string of the WebAuthn rawId
}

/**
 * Which unlock methods are currently provisioned for a user.
 *
 * `status` distinguishes a successful read from a failed one. A failed load
 * (network/DB error) must NOT be treated as "no vault" — doing so could route a
 * user into the setup flow and overwrite an existing vault. Callers should
 * check `status === 'ok'` before trusting `exists`/`hasPin`/`hasPasskey`.
 */
export interface VaultStatus {
  status: 'ok' | 'error';
  exists: boolean;     // any vault material present (meaningful only when status === 'ok')
  hasPin: boolean;     // a PIN envelope is provisioned
  hasPasskey: boolean; // a passkey envelope is provisioned
  error?: Error;       // populated when status === 'error'
}

export interface IVaultStorageAdapter {
  /** Retrieves the cryptographic envelopes for a specific user. */
  loadEnvelopes: (userId: string) => Promise<VaultEnvelopes>;

  /**
   * Saves updated cryptographic envelopes for a specific user.
   *
   * ATOMICITY CONTRACT: each call MUST persist all provided fields atomically
   * (a single transaction / single round-trip update). A partial write that
   * commits some fields but not others can leave a vault permanently
   * undecryptable (e.g. a new pinEnvelope persisted without its matching
   * pinSalt). A single SQL `UPDATE ... SET a = $1, b = $2` satisfies this.
   * Fields set to `undefined` should be left untouched; fields set to `null`
   * should be cleared.
   */
  saveEnvelopes: (
    userId: string,
    envelopes: Partial<VaultEnvelopes>
  ) => Promise<void>;
}

export type { EncryptedPayload };
