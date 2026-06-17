// src/wallet/crypto-core.ts
//
// Environment-agnostic crypto used INSIDE the signer worker. Uses only the
// global `crypto.subtle` (available in both window and worker scopes), noble
// curves/hashes, hash-wasm, and the scure BIP39/BIP32 stack — no DOM-specific
// APIs — so it compiles and runs in a Web Worker.
//
// This module never returns raw secret bytes to anything outside the worker.
// Callers get addresses, signatures, and (only on the deliberate backup path)
// the secret itself.
//
// SECRET TYPES (dual support):
//   The stored secret is a small tagged JSON blob, encrypted into
//   `walletEnvelope` by the DEK. It is one of:
//     - { k: 'm', v: <BIP39 mnemonic> }      → HD wallet, multi-account
//     - { k: 'p', v: <64-hex private key> }  → single imported key, no derivation
//   For mnemonic secrets, account keys are derived on demand via BIP44
//   (m/44'/60'/0'/0/index) and never persisted. The dual-envelope / Argon2id /
//   worker-isolation design is unchanged.

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { argon2id } from 'hash-wasm';
import { HDKey } from '@scure/bip32';
import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Envelope, Argon2Params, EthSignature, WalletSecretKind } from './messages';

const AES = 'AES-GCM';

export const DEFAULT_ARGON2: Argon2Params = {
  memorySizeKiB: 65536, // 64 MiB — wallet-grade; lower to 19456 (19 MiB) for low-end mobile
  iterations: 3,
  parallelism: 1,
};

// BIP44 path for Ethereum / EVM chains (Base included): m/44'/60'/0'/0/<index>
export const ethDerivationPath = (accountIndex: number): string =>
  `m/44'/60'/0'/0/${accountIndex}`;

const enc = new TextEncoder();
const dec = new TextDecoder();

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(n));
  crypto.getRandomValues(b);
  return b;
}

function toBuf(u8: Uint8Array): ArrayBuffer {
  const b = new ArrayBuffer(u8.byteLength);
  new Uint8Array(b).set(u8);
  return b;
}

// A Uint8Array guaranteed to be backed by a plain ArrayBuffer (satisfies the
// strict BufferSource overloads under TS 5.7+ typed-array generics).
function bytes(u8: Uint8Array): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(u8.byteLength));
  b.set(u8);
  return b;
}

export function hex(u8: Uint8Array): string {
  return bytesToHex(u8);
}
export function unhex(s: string): Uint8Array {
  return hexToBytes(s.startsWith('0x') ? s.slice(2) : s);
}

// ---- BIP39 mnemonic helpers ----

/** Generate a fresh BIP39 mnemonic. 12 words = 128 bits, 24 words = 256 bits. */
export function newMnemonic(wordCount: 12 | 24 = 12): string {
  return generateMnemonic(wordlist, wordCount === 24 ? 256 : 128);
}

/** Normalize (trim + collapse whitespace, lowercase) for consistent handling. */
export function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Throws if the phrase is not a valid English BIP39 mnemonic (bad checksum/word). */
export function assertValidMnemonic(mnemonic: string): void {
  if (!validateMnemonic(normalizeMnemonic(mnemonic), wordlist)) {
    throw new Error('Invalid recovery phrase (BIP39 checksum/word check failed).');
  }
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(normalizeMnemonic(mnemonic), wordlist);
}

// ---- Raw private-key helpers ----

/**
 * Normalize a hex private key: strip 0x, lowercase, require exactly 32 bytes,
 * and verify it is a valid secp256k1 scalar. Throws otherwise.
 */
export function normalizePrivateKeyHex(input: string): string {
  const stripped = input.trim();
  const noPrefix =
    stripped.startsWith('0x') || stripped.startsWith('0X')
      ? stripped.slice(2)
      : stripped;
  const lower = noPrefix.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(lower)) {
    throw new Error('Private key must be 32 bytes (64 hex characters).');
  }
  if (!secp256k1.utils.isValidSecretKey(unhex(lower))) {
    throw new Error('Private key is not a valid secp256k1 scalar.');
  }
  return lower;
}

export function isValidPrivateKeyHex(input: string): boolean {
  try {
    normalizePrivateKeyHex(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive the secp256k1 private key for a given account index from a mnemonic.
 * Intermediate seed + HD node private material is wiped on the way out; the
 * returned 32-byte key is a copy the caller (the worker) keeps in its memory.
 */
export function privateKeyFromMnemonic(
  mnemonic: string,
  accountIndex = 0
): Uint8Array {
  const seed = mnemonicToSeedSync(normalizeMnemonic(mnemonic), ''); // no BIP39 passphrase
  const hd = HDKey.fromMasterSeed(seed);
  const child = hd.derive(ethDerivationPath(accountIndex));
  if (!child.privateKey) throw new Error('HD derivation produced no private key.');
  const priv = new Uint8Array(child.privateKey); // copy out before wiping
  // Best-effort wipe of intermediates.
  seed.fill(0);
  child.wipePrivateData?.();
  hd.wipePrivateData?.();
  return priv;
}

// ---- Tagged secret (what gets encrypted into walletEnvelope) ----

export type WalletSecret =
  | { kind: 'mnemonic'; value: string }      // value = mnemonic phrase
  | { kind: 'privateKey'; value: string };   // value = 64-hex private key (no 0x)

function encodeSecret(secret: WalletSecret): Uint8Array {
  const k = secret.kind === 'mnemonic' ? 'm' : 'p';
  return enc.encode(JSON.stringify({ k, v: secret.value }));
}

function decodeSecret(plain: Uint8Array): WalletSecret {
  const o = JSON.parse(dec.decode(plain)) as { k?: string; v?: string };
  if (o.k === 'm' && typeof o.v === 'string') return { kind: 'mnemonic', value: o.v };
  if (o.k === 'p' && typeof o.v === 'string') return { kind: 'privateKey', value: o.v };
  throw new Error('Unrecognized wallet secret format.');
}

/** Derive the active account's private key from whichever secret type this is. */
function deriveActiveKey(secret: WalletSecret, accountIndex: number): Uint8Array {
  if (secret.kind === 'mnemonic') return privateKeyFromMnemonic(secret.value, accountIndex);
  // Raw key: single account, derivation path / index do not apply.
  return unhex(secret.value);
}

// ---- Argon2id KEK derivation ----
// Returns a non-extractable AES-GCM key used only to wrap/unwrap the DEK.
export async function deriveKekArgon2(
  passcode: string,
  salt: Uint8Array,
  params: Argon2Params = DEFAULT_ARGON2
): Promise<CryptoKey> {
  const raw = await argon2id({
    password: passcode,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memorySizeKiB,
    hashLength: 32,
    outputType: 'binary',
  });
  return crypto.subtle.importKey('raw', toBuf(raw), { name: AES }, false, [
    'wrapKey',
    'unwrapKey',
  ]);
}

// PRF output (from WebAuthn, obtained on the main thread) → non-extractable KEK.
export async function kekFromPrf(prfFirst: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toBuf(prfFirst), { name: AES }, false, [
    'wrapKey',
    'unwrapKey',
  ]);
}

// ---- DEK lifecycle ----
async function generateDek(): Promise<CryptoKey> {
  // Extractable so it can be wrapped; it never leaves the worker.
  return crypto.subtle.generateKey({ name: AES, length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

async function wrapDek(dek: CryptoKey, kek: CryptoKey): Promise<Envelope> {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, {
    name: AES,
    iv,
  });
  return { cipher: hex(new Uint8Array(wrapped)), iv: hex(iv) };
}

async function unwrapDek(env: Envelope, kek: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    toBuf(unhex(env.cipher)),
    kek,
    { name: AES, iv: bytes(unhex(env.iv)) },
    { name: AES, length: 256 },
    false, // DEK stays non-extractable after unlock
    ['encrypt', 'decrypt']
  );
}

// ---- Secret <-> envelope (encrypted by the DEK) ----
async function encryptWithDek(dek: CryptoKey, data: Uint8Array): Promise<Envelope> {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: AES, iv }, dek, toBuf(data));
  return { cipher: hex(new Uint8Array(cipher)), iv: hex(iv) };
}

async function decryptWithDek(dek: CryptoKey, env: Envelope): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: AES, iv: bytes(unhex(env.iv)) },
    dek,
    toBuf(unhex(env.cipher))
  );
  return new Uint8Array(plain);
}

// ---- Ethereum address (EIP-55 checksummed) ----
export function addressFromPrivateKey(priv: Uint8Array): string {
  const pub = secp256k1.getPublicKey(priv, false); // 65 bytes, 0x04 prefix
  const hash = keccak_256(pub.slice(1));
  const addr = bytesToHex(hash.slice(-20));
  return toChecksumAddress(addr);
}

function toChecksumAddress(addrLowerNo0x: string): string {
  const lower = addrLowerNo0x.toLowerCase();
  const h = bytesToHex(keccak_256(enc.encode(lower)));
  let out = '0x';
  for (let i = 0; i < lower.length; i++) {
    out += parseInt(h[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return out;
}

// ---- Signing (recoverable, Ethereum v = recovery + 27) ----
export function signDigest(priv: Uint8Array, digest: Uint8Array): EthSignature {
  if (digest.length !== 32) throw new Error('digest must be 32 bytes');
  const recovered = secp256k1.sign(digest, priv, {
    format: 'recovered',
    prehash: false,
  }); // 65 bytes: [recovery, r(32), s(32)]
  const recovery = recovered[0];
  const r = recovered.slice(1, 33);
  const s = recovered.slice(33, 65);
  const v = recovery + 27;
  return {
    signatureHex: '0x' + hex(r) + hex(s) + v.toString(16).padStart(2, '0'),
    r: '0x' + hex(r),
    s: '0x' + hex(s),
    v,
  };
}

// EIP-191 personal_sign digest.
export function personalSignDigest(message: string): Uint8Array {
  const msg = enc.encode(message);
  const prefix = enc.encode(`\x19Ethereum Signed Message:\n${msg.length}`);
  const joined = new Uint8Array(prefix.length + msg.length);
  joined.set(prefix);
  joined.set(msg, prefix.length);
  return keccak_256(joined);
}

// ---- High-level operations the worker exposes ----

export interface GenerateResult {
  pinSalt: string;
  pinEnvelope: Envelope;
  passkeyEnvelope: Envelope | null;
  walletEnvelope: Envelope; // DEK-encrypted tagged secret (mnemonic OR private key)
  address: string;
  accountIndex: number;
  secretKind: WalletSecretKind;
  // Worker-retained; intentionally NOT persisted.
  dek: CryptoKey;
  privateKey: Uint8Array;
  // Returned ONCE for the backup screen. Exactly one is non-null. Not stored in cleartext.
  mnemonic: string | null;
  privateKeyHex: string | null;
}

export interface GenerateOptions {
  prfFirst?: Uint8Array;
  /** Restore from an existing recovery phrase. */
  importMnemonic?: string;
  /** Restore from an existing raw private key (hex, with or without 0x). */
  importPrivateKeyHex?: string;
  /** Only used when creating a fresh mnemonic wallet (default 12). */
  wordCount?: 12 | 24;
  /** BIP44 account index for mnemonic wallets (default 0; ignored for raw keys). */
  accountIndex?: number;
}

function buildSecret(opts: GenerateOptions): WalletSecret {
  if (opts.importMnemonic && opts.importPrivateKeyHex) {
    throw new Error('Provide either a mnemonic or a private key, not both.');
  }
  if (opts.importPrivateKeyHex) {
    return { kind: 'privateKey', value: normalizePrivateKeyHex(opts.importPrivateKeyHex) };
  }
  if (opts.importMnemonic) {
    const m = normalizeMnemonic(opts.importMnemonic);
    assertValidMnemonic(m);
    return { kind: 'mnemonic', value: m };
  }
  return { kind: 'mnemonic', value: newMnemonic(opts.wordCount ?? 12) };
}

export async function generateWallet(
  passcode: string,
  argon2: Argon2Params,
  opts: GenerateOptions = {}
): Promise<GenerateResult> {
  const dek = await generateDek();

  const salt = randomBytes(32);
  const pinKek = await deriveKekArgon2(passcode, salt, argon2);
  const pinEnvelope = await wrapDek(dek, pinKek);

  let passkeyEnvelope: Envelope | null = null;
  if (opts.prfFirst) {
    const passkeyKek = await kekFromPrf(opts.prfFirst);
    passkeyEnvelope = await wrapDek(dek, passkeyKek);
  }

  const secret = buildSecret(opts);
  // Raw keys are single-account: derivation index does not apply.
  const accountIndex = secret.kind === 'mnemonic' ? opts.accountIndex ?? 0 : 0;

  const walletEnvelope = await encryptWithDek(dek, encodeSecret(secret));
  const privateKey = deriveActiveKey(secret, accountIndex);
  const address = addressFromPrivateKey(privateKey);

  return {
    pinSalt: hex(salt),
    pinEnvelope,
    passkeyEnvelope,
    walletEnvelope,
    address,
    accountIndex,
    secretKind: secret.kind,
    dek,
    privateKey,
    mnemonic: secret.kind === 'mnemonic' ? secret.value : null,
    privateKeyHex: secret.kind === 'privateKey' ? secret.value : null,
  };
}

export interface UnlockResult {
  dek: CryptoKey;
  privateKey: Uint8Array;
  address: string;
  accountIndex: number;
  secretKind: WalletSecretKind;
  mnemonic: string | null;
  privateKeyHex: string | null;
}

function finishUnlock(
  dek: CryptoKey,
  secretBytes: Uint8Array,
  accountIndex: number
): UnlockResult {
  const secret = decodeSecret(secretBytes);
  secretBytes.fill(0);
  const idx = secret.kind === 'mnemonic' ? accountIndex : 0;
  const privateKey = deriveActiveKey(secret, idx);
  return {
    dek,
    privateKey,
    address: addressFromPrivateKey(privateKey),
    accountIndex: idx,
    secretKind: secret.kind,
    mnemonic: secret.kind === 'mnemonic' ? secret.value : null,
    privateKeyHex: secret.kind === 'privateKey' ? secret.value : null,
  };
}

export async function unlockWithPin(
  passcode: string,
  pinSalt: string,
  pinEnvelope: Envelope,
  walletEnvelope: Envelope,
  argon2: Argon2Params,
  accountIndex = 0
): Promise<UnlockResult> {
  const kek = await deriveKekArgon2(passcode, unhex(pinSalt), argon2);
  const dek = await unwrapDek(pinEnvelope, kek);
  const secretBytes = await decryptWithDek(dek, walletEnvelope);
  return finishUnlock(dek, secretBytes, accountIndex);
}

export async function unlockWithPasskey(
  prfFirst: Uint8Array,
  passkeyEnvelope: Envelope,
  walletEnvelope: Envelope,
  accountIndex = 0
): Promise<UnlockResult> {
  const kek = await kekFromPrf(prfFirst);
  const dek = await unwrapDek(passkeyEnvelope, kek);
  const secretBytes = await decryptWithDek(dek, walletEnvelope);
  return finishUnlock(dek, secretBytes, accountIndex);
}
