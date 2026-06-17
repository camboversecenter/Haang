// src/zk-vault/crypto.ts
//
// Pure Zero-Knowledge Dual-Envelope Encryption Engine.
// Pattern: a random Data Encryption Key (DEK) encrypts your data, and the DEK
// itself is "wrapped" (encrypted) independently by a PIN-derived key and a
// hardware Passkey (WebAuthn PRF) key. Either envelope can recover the DEK.

const AES_ALGO = 'AES-GCM';
const PBKDF2_ALGO = 'PBKDF2';
const HASH_ALGO = 'SHA-256';

// PBKDF2 work factor. OWASP 2024/2025 minimum for PBKDF2-HMAC-SHA256 is 600,000.
const PBKDF2_ITERATIONS = 600000;

export interface EncryptedPayload {
  cipher: string; // hex
  iv: string;     // hex
}

// --- Encoding helpers (exported so the Context can encode the PIN salt) ---

export function bufToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuf(hex: string): ArrayBuffer {
  // Defensive validation: malformed hex from a tampered store would otherwise
  // silently produce NaN bytes and a corrupt key/IV.
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    throw new Error('Invalid hex string supplied to hexToBuf.');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Normalizes a PRF result (ArrayBuffer or any TypedArray/DataView view) into a
// fresh Uint8Array backed by a plain (non-shared) ArrayBuffer, suitable for
// importKey under strict lib.dom typings (TS 5.7+ typed-array generics).
function toKeyBytes(src: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  const view =
    src instanceof ArrayBuffer
      ? new Uint8Array(src)
      : new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
  const backing = new ArrayBuffer(view.byteLength);
  const out = new Uint8Array(backing);
  out.set(view);
  return out;
}

// PRF salt is bound to the application origin so the same physical passkey
// derives a *different* wrapping key on a different site (application
// isolation). The hostname does not change at runtime, so memoize once.
// Typed as Uint8Array<ArrayBuffer> to match toKeyBytes and satisfy the strict
// BufferSource overloads under TS 5.7+ typed-array generics.
let _prfSalt: Uint8Array<ArrayBuffer> | null = null;
function getPrfSalt(): Uint8Array<ArrayBuffer> {
  if (_prfSalt === null) {
    _prfSalt = toKeyBytes(encoder.encode(`zk-vault-v1:${window.location.hostname}`));
  }
  return _prfSalt;
}

// --- Core key + data operations ---

/** Generates a fresh random 256-bit AES-GCM Data Encryption Key. */
export async function generateDEK(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: AES_ALGO, length: 256 },
    // Must remain extractable so it can be re-wrapped on reset. The handle is
    // never exposed outside the provider closure (see VaultContext).
    true,
    ['encrypt', 'decrypt']
  );
}

/** Derives a non-extractable Key-Encryption-Key (KEK) from a passcode. */
export async function deriveKeyFromPin(
  pin: string,
  saltBuf: ArrayBuffer
): Promise<CryptoKey> {
  const pinBuf = encoder.encode(pin);
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    pinBuf,
    { name: PBKDF2_ALGO },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: PBKDF2_ALGO,
      salt: saltBuf,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGO,
    },
    baseKey,
    { name: AES_ALGO, length: 256 },
    false, // KEK is never extractable.
    ['wrapKey', 'unwrapKey']
  );
}

/** Encrypts arbitrary JSON-serializable data with a CryptoKey. */
export async function encryptData(
  data: unknown,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedData = encoder.encode(JSON.stringify(data));
  const cipher = await window.crypto.subtle.encrypt(
    { name: AES_ALGO, iv },
    key,
    encodedData
  );

  return { cipher: bufToHex(cipher), iv: bufToHex(iv.buffer) };
}

/**
 * Decrypts a payload back into JSON. Return type is `unknown` deliberately:
 * data coming out of decryption must be validated by the caller before use.
 */
export async function decryptData(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<unknown> {
  const cipherBuf = hexToBuf(payload.cipher);
  const ivBuf = hexToBuf(payload.iv);

  const decryptedBuf = await window.crypto.subtle.decrypt(
    { name: AES_ALGO, iv: new Uint8Array(ivBuf) },
    key,
    cipherBuf
  );

  return JSON.parse(decoder.decode(decryptedBuf));
}

/** Wraps (encrypts) the DEK with a wrapping key, producing an envelope. */
export async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey
): Promise<EncryptedPayload> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await window.crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    wrappingKey,
    { name: AES_ALGO, iv }
  );

  return { cipher: bufToHex(wrapped), iv: bufToHex(iv.buffer) };
}

/** Unwraps (decrypts) an envelope back into the DEK. */
export async function unwrapKey(
  wrappedPayload: EncryptedPayload,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedBuf = hexToBuf(wrappedPayload.cipher);
  const ivBuf = hexToBuf(wrappedPayload.iv);

  return await window.crypto.subtle.unwrapKey(
    'raw',
    wrappedBuf,
    wrappingKey,
    { name: AES_ALGO, iv: new Uint8Array(ivBuf) },
    { name: AES_ALGO, length: 256 },
    // Extractable so the DEK can be re-wrapped during PIN/Passkey resets.
    true,
    ['encrypt', 'decrypt']
  );
}

// --- Passkey / WebAuthn PRF logic ---
//
// SECURITY NOTE: The WebAuthn challenge is generated client-side and is not
// verified by a server. This is an intentional trade-off for a fully
// zero-knowledge design where the backend stores only ciphertext and performs
// no ceremony validation. Replay protection therefore relies on the browser's
// origin binding (rpId), not on server-issued challenges. Applications with a
// stricter threat model should add server-side ceremony verification.

/** True if the running environment exposes WebAuthn at all. */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    !!navigator.credentials
  );
}

export async function registerPasskey(
  userId: string,
  email: string
): Promise<{ id: string; key: CryptoKey }> {
  const challenge = window.crypto.getRandomValues(new Uint8Array(32));

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: window.location.hostname, name: 'Secure Vault' },
      user: {
        id: encoder.encode(userId),
        name: email,
        displayName: email.split('@')[0],
      },
      // ES256 then RS256 for broad authenticator compatibility.
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60000,
      extensions: {
        // Ask the authenticator to compute a PRF over our app-bound salt.
        prf: { eval: { first: getPrfSalt() } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Passkey registration failed.');

  const ext = credential.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer | ArrayBufferView } };
  };
  const prfFirst = ext.prf?.results?.first;
  if (!prfFirst) {
    throw new Error(
      'Authenticator does not support the PRF extension required for secure encryption.'
    );
  }

  // The PRF output is signed by the authenticator's hardware secret and cannot
  // be reproduced from the public rawId alone — this is the keying material.
  const key = await window.crypto.subtle.importKey(
    'raw',
    toKeyBytes(prfFirst),
    { name: AES_ALGO },
    false,
    ['wrapKey', 'unwrapKey']
  );

  return { id: bufToHex(credential.rawId), key };
}

export async function authenticatePasskey(
  passkeyIdHex: string
): Promise<CryptoKey> {
  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const rawId = hexToBuf(passkeyIdHex);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{ type: 'public-key', id: rawId }],
      userVerification: 'required',
      timeout: 60000,
      extensions: {
        prf: { eval: { first: getPrfSalt() } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Passkey authentication failed.');

  const ext = assertion.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer | ArrayBufferView } };
  };
  const prfFirst = ext.prf?.results?.first;
  if (!prfFirst) {
    throw new Error('Authenticator did not return PRF results.');
  }

  return await window.crypto.subtle.importKey(
    'raw',
    toKeyBytes(prfFirst),
    { name: AES_ALGO },
    false,
    ['wrapKey', 'unwrapKey']
  );
}
