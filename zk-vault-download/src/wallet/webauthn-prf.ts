// src/wallet/webauthn-prf.ts
//
// WebAuthn must run on the document thread (workers have no navigator.credentials),
// so the PRF output is obtained here and passed to the worker as raw bytes. The
// PRF output is the passkey wrapping-key material; it is transient and only the
// envelope (ciphertext) is ever persisted.
//
// SECURITY NOTE: the same client-side-challenge trade-off as the base library
// applies. See README-wallet.

import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

const enc = new TextEncoder();

function prfSalt(): Uint8Array {
  return enc.encode(`zk-vault-wallet-v1:${window.location.hostname}`);
}

function toU8(src: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (src instanceof ArrayBuffer) return new Uint8Array(src);
  return new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
}

export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    !!navigator.credentials
  );
}

export async function registerPasskeyPrf(
  userId: string,
  email: string
): Promise<{ passkeyId: string; prfFirstHex: string }> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: window.location.hostname, name: 'Secure Wallet' },
      user: {
        id: enc.encode(userId),
        name: email,
        displayName: email.split('@')[0],
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: { userVerification: 'required', residentKey: 'required' },
      timeout: 60000,
      extensions: {
        prf: { eval: { first: prfSalt() } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error('Passkey registration failed.');
  const ext = cred.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer | ArrayBufferView } };
  };
  const first = ext.prf?.results?.first;
  if (!first) throw new Error('Authenticator does not support the PRF extension.');

  return {
    passkeyId: bytesToHex(new Uint8Array(cred.rawId)),
    prfFirstHex: bytesToHex(toU8(first)),
  };
}

export async function authenticatePasskeyPrf(passkeyIdHex: string): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        { type: 'public-key', id: hexToBytes(passkeyIdHex) as unknown as BufferSource },
      ],
      userVerification: 'required',
      timeout: 60000,
      extensions: {
        prf: { eval: { first: prfSalt() } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('Passkey authentication failed.');
  const ext = assertion.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer | ArrayBufferView } };
  };
  const first = ext.prf?.results?.first;
  if (!first) throw new Error('Authenticator did not return PRF results.');
  return bytesToHex(toU8(first));
}
