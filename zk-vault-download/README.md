# Zero-Knowledge React Vault (`zk-vault-react`)

A headless, database-agnostic React provider for **Dual-Envelope (PIN + WebAuthn)** end-to-end encryption.

This library lets you add E2EE to any React app. It handles the WebCrypto and WebAuthn (Passkey) work and lets you bring your own database (Supabase, Firebase, etc.) for cross-device sync. The server only ever stores ciphertext — keys never leave the browser.

---

## Table of contents

1. [How it works](#how-it-works)
2. [Security model](#security-model)
3. [Requirements](#requirements)
4. [Step 1 — Database setup](#step-1--database-setup)
5. [Step 2 — Add the library to your project](#step-2--add-the-library-to-your-project)
6. [Step 3 — Write a storage adapter](#step-3--write-a-storage-adapter)
7. [Step 4 — Wrap your app with the provider](#step-4--wrap-your-app-with-the-provider)
8. [Step 5 — The gatekeeper pattern](#step-5--the-gatekeeper-pattern)
9. [Step 6 — Encrypting and decrypting data](#step-6--encrypting-and-decrypting-data)
10. [Step 7 — Managing credentials](#step-7--managing-credentials)
11. [Configuration](#configuration)
12. [API reference](#api-reference)
13. [Recovery, lockout, and edge cases](#recovery-lockout-and-edge-cases)
14. [Troubleshooting](#troubleshooting)
15. [Security checklist for production](#security-checklist-for-production)

---

## How it works

The vault uses a **dual-envelope** scheme built around one master key:

- **DEK (Data Encryption Key)** — a random 256-bit AES-GCM key. This is the only key that actually encrypts your data. It exists in memory (`sessionKey`) only while the vault is unlocked.
- **PIN envelope** — the DEK wrapped (encrypted) by a Key-Encryption-Key derived from the user's passcode via PBKDF2 (600,000 iterations, SHA-256, 32-byte random salt).
- **Passkey envelope** — the DEK wrapped by a key derived from a WebAuthn passkey using the **PRF extension**. The PRF output is signed by the authenticator's hardware secret, so it cannot be reproduced from anything the server stores.

Either envelope can recover the same DEK. The server stores only the two wrapped envelopes plus the PIN salt and the passkey credential id — all ciphertext or public identifiers.

```
                ┌─────────────┐
   passcode ──► │ PBKDF2 KEK  │ ──┐
                └─────────────┘   │  wrap
                                  ├──────►  PIN envelope ───► database
   passkey  ──► ┌─────────────┐   │
   (PRF)        │ Hardware KEK│ ──┘
                └─────────────┘
                                  ┌──────►  Passkey envelope ─► database
        DEK (256-bit AES-GCM) ────┘
         │
         └─► encrypts your application data (notes, files, fields…)
```

---

## Security model

What the server can see and what it cannot:

| Stored in your database | Sensitive? | Notes |
| --- | --- | --- |
| `vault_envelope_pin` | No | DEK wrapped by the passcode KEK (ciphertext) |
| `vault_pin_salt` | No | Random PBKDF2 salt (public by design) |
| `vault_envelope_passkey` | No | DEK wrapped by the passkey PRF key (ciphertext) |
| `passkey_id` | No | The WebAuthn credential id (a public identifier) |

Design properties:

- **Zero-knowledge:** the DEK and both KEKs are derived and used entirely in the browser. The backend never receives key material.
- **AES-256-GCM** for all encryption, with a fresh 96-bit random IV per operation.
- **PBKDF2-HMAC-SHA256, 600,000 iterations** for passcode key derivation (OWASP 2024/2025 minimum).
- **WebAuthn PRF** for the passkey envelope — the wrapping key is bound to the authenticator hardware, not to the public credential id.
- **App-bound passkey isolation:** the PRF salt includes your origin (`zk-vault-v1:<hostname>`), so the same physical passkey derives a different key on a different site.

Known trade-offs you should understand:

- **WebAuthn challenge is generated client-side and not verified by a server.** This is intentional for a fully zero-knowledge design where the backend performs no ceremony validation. Replay protection relies on the browser's origin binding (`rpId`). If you need server-verified WebAuthn ceremonies, add that layer yourself.
- **The unlocked DEK is extractable in-memory.** WebCrypto requires this so the DEK can be re-wrapped during resets. The key handle is never exposed on the context value — it lives only inside the provider closure — but a successful XSS in your app origin could still reach it. Treat XSS prevention as part of your threat model.
- **Client-side rate limiting is a UX speed-bump, not a security control.** Real brute-force protection must live server-side (e.g. Supabase Row Level Security or an API rate limiter).
- **Zero recovery:** if a user forgets the passcode *and* loses every passkey device, the data is unrecoverable by anyone, including you. This is the point of a zero-knowledge vault.

---

## Requirements

- React 18+
- A secure context: WebCrypto and WebAuthn require `https://` or `localhost`.
- A PRF-capable authenticator/browser for the passkey envelope (recent Chrome, Safari, Edge with platform authenticators). The passcode envelope works everywhere WebCrypto is available; passkey is optional and degrades gracefully.
- `lucide-react` (used by the optional drop-in UI components).

---

## Step 1 — Database setup

You need four columns to store the envelopes. They only ever hold ciphertext or public identifiers.

### Supabase / PostgreSQL

```sql
ALTER TABLE user_profiles
  ADD COLUMN vault_envelope_pin     TEXT,
  ADD COLUMN vault_pin_salt         TEXT,
  ADD COLUMN vault_envelope_passkey TEXT,
  ADD COLUMN passkey_id             TEXT;
```

Make sure Row Level Security restricts each row to its owner so users can only read and write their own envelopes:

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read own vault"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "owner can update own vault"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);
```

> **Important — atomicity.** The storage adapter's `saveEnvelopes` MUST persist all provided fields in a single atomic write. A single SQL `UPDATE ... SET a = $1, b = $2` satisfies this. A partial write that commits `vault_envelope_pin` without its matching `vault_pin_salt` can leave a vault permanently undecryptable. The library cannot enforce this — it depends entirely on your adapter.

### Other databases

Any store works as long as you can read and write these four named values per user, atomically. For document stores (Firestore, Mongo), keep all four fields in one document and write them together.

---

## Step 2 — Add the library to your project

Copy `src/zk-vault/` (the engine) and `src/components/` (the optional UI) into your project's `src/` folder.

```
your-app/
└── src/
    ├── zk-vault/        # crypto.ts, VaultContext.tsx, hooks.ts, types.ts, index.ts
    └── components/      # VaultSetup.tsx, VaultUnlock.tsx, VaultSettings.tsx
```

Install the peer dependency used by the UI components:

```bash
npm install lucide-react
```

---

## Step 3 — Write a storage adapter

The adapter maps the vault's generic storage interface to your database. It needs two functions: `loadEnvelopes` and `saveEnvelopes`.

```ts
// src/lib/vaultAdapter.ts
import { supabase } from './supabaseClient';
import { IVaultStorageAdapter } from '../zk-vault';

export const supabaseVaultAdapter: IVaultStorageAdapter = {
  loadEnvelopes: async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('vault_envelope_pin, vault_pin_salt, vault_envelope_passkey, passkey_id')
      .eq('id', userId)
      .single();

    if (!data) {
      return { pinEnvelope: null, pinSalt: null, passkeyEnvelope: null, passkeyId: null };
    }

    return {
      pinEnvelope: data.vault_envelope_pin,
      pinSalt: data.vault_pin_salt,
      passkeyEnvelope: data.vault_envelope_passkey,
      passkeyId: data.passkey_id,
    };
  },

  // Persist ALL provided fields in ONE atomic update (see atomicity note above).
  saveEnvelopes: async (userId, envelopes) => {
    const updates: Record<string, string | null> = {};
    if (envelopes.pinEnvelope !== undefined)     updates.vault_envelope_pin     = envelopes.pinEnvelope;
    if (envelopes.pinSalt !== undefined)         updates.vault_pin_salt         = envelopes.pinSalt;
    if (envelopes.passkeyEnvelope !== undefined) updates.vault_envelope_passkey = envelopes.passkeyEnvelope;
    if (envelopes.passkeyId !== undefined)       updates.passkey_id             = envelopes.passkeyId;

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)       // single round-trip = atomic
      .eq('id', userId);

    if (error) throw error;  // must throw so the vault can trigger its rollback
  },
};
```

Two contract rules:

- **`saveEnvelopes` must throw on failure.** The vault relies on a thrown error to trigger its rollback logic during resets.
- **A field set to `undefined` means "leave unchanged"; `null` means "clear it".** Only touch the columns that were provided.

---

## Step 4 — Wrap your app with the provider

```tsx
// App.tsx
import { VaultProvider } from './zk-vault';
import { supabaseVaultAdapter } from './lib/vaultAdapter';
import VaultGatekeeper from './VaultGatekeeper';

export default function App({ user }) {
  return (
    <VaultProvider
      storageAdapter={supabaseVaultAdapter}
      autoLockTimeoutMs={5 * 60 * 1000}  // optional, default 5 min; 0 disables
      lockOnWindowBlur                    // optional, default true
      onError={(err) => console.error('[vault]', err)} // optional
    >
      <VaultGatekeeper user={user} />
    </VaultProvider>
  );
}
```

---

## Step 5 — The gatekeeper pattern

A gatekeeper decides which screen to show: setup (no vault yet), unlock (locked vault), or your app (unlocked). Use `checkVaultStatus` to find out which one — and crucially, handle the **error** case so a transient network failure never routes a user into setup and overwrites their vault.

```tsx
// VaultGatekeeper.tsx
import React, { useEffect, useState } from 'react';
import { useZkVault, VaultStatus } from './zk-vault';
import VaultSetup from './components/VaultSetup';
import VaultUnlock from './components/VaultUnlock';
import MainApplication from './MainApplication';

export default function VaultGatekeeper({ user }) {
  const { isUnlocked, checkVaultStatus } = useZkVault();
  const [status, setStatus] = useState<VaultStatus | null>(null);

  useEffect(() => {
    let active = true;
    checkVaultStatus(user.id).then((s) => active && setStatus(s));
    return () => { active = false; };
  }, [user.id, checkVaultStatus]);

  if (status === null) return <div>Loading…</div>;

  // Distinguish a load failure from an empty vault. Never show setup on error.
  if (status.status === 'error') {
    return (
      <div>
        <p>Couldn’t reach your vault. Check your connection and try again.</p>
        <button onClick={() => checkVaultStatus(user.id).then(setStatus)}>Retry</button>
      </div>
    );
  }

  // 1. No vault provisioned → setup
  if (!status.exists) {
    return (
      <VaultSetup
        userId={user.id}
        userEmail={user.email}
        onSuccess={() => checkVaultStatus(user.id).then(setStatus)}
      />
    );
  }

  // 2. Vault exists but locked in memory → unlock
  if (!isUnlocked) {
    return <VaultUnlock userId={user.id} />;
  }

  // 3. Unlocked → your app
  return <MainApplication />;
}
```

The branching rule:

| `status.status` | `status.exists` | `isUnlocked` | Show |
| --- | --- | --- | --- |
| `error` | — | — | Retry screen |
| `ok` | `false` | — | `VaultSetup` |
| `ok` | `true` | `false` | `VaultUnlock` |
| `ok` | `true` | `true` | Your app |

---

## Step 6 — Encrypting and decrypting data

Once the vault is unlocked, use `encryptPayload` and `decryptPayload` from the hook. These wrap the in-memory DEK for you — you never touch the raw key.

```tsx
import { useZkVault } from './zk-vault';

function SecureNoteEditor() {
  const { isUnlocked, encryptPayload, decryptPayload } = useZkVault();

  async function saveNote(text: string) {
    if (!isUnlocked) return;

    // Returns { cipher, iv } as hex strings.
    const payload = await encryptPayload({ note: text, savedAt: Date.now() });

    await supabase.from('notes').insert({
      user_id: currentUser.id,
      cipher: payload.cipher,
      iv: payload.iv,
    });
  }

  async function loadNote(row: { cipher: string; iv: string }) {
    if (!isUnlocked) return null;

    // Returns `unknown` — validate before use.
    const data = await decryptPayload({ cipher: row.cipher, iv: row.iv });
    return data as { note: string; savedAt: number };
  }

  // …render
}
```

Notes:

- The stored shape is `EncryptedPayload = { cipher: string; iv: string }` (both hex). Store both columns together.
- `decryptPayload` returns `unknown` on purpose — anything coming out of decryption should be validated (e.g. with a schema) before you trust its shape.
- `encryptPayload`/`decryptPayload` throw if the vault is locked. Guard with `isUnlocked` or wrap in `try/catch`.
- You can encrypt any JSON-serializable value (objects, arrays, strings, numbers).

> Prefer the hook's `encryptPayload`/`decryptPayload` over the lower-level `encryptData`/`decryptData` exports from `crypto.ts`. The hook keeps the DEK private to the provider; the standalone functions require you to pass a `CryptoKey` yourself.

---

## Step 7 — Managing credentials

Drop the `VaultSettings` component into a profile or settings page. It must be rendered while the vault is unlocked.

```tsx
// ProfilePage.tsx
import VaultSettings from './components/VaultSettings';

export default function ProfilePage({ user }) {
  return (
    <div className="p-8">
      <h1>Account settings</h1>
      <VaultSettings userId={user.id} userEmail={user.email} />
    </div>
  );
}
```

`VaultSettings` lets the user:

- **Change the recovery passcode** — re-wraps the current DEK under a new passcode and salt (`resetPin`).
- **Add or replace a passkey** — registers a passkey on the current device and wraps the DEK with it (`setPasskey`). This is also how a PIN-only vault gains a passkey later. The button reads "Add Passkey" when none exists and "Register New" when replacing one.

Both operations require the vault to be unlocked (they re-wrap the live DEK), and both snapshot the affected fields and attempt a rollback if the save fails.

---

## Configuration

`VaultProvider` props:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `storageAdapter` | `IVaultStorageAdapter` | — (required) | Maps the vault to your database. |
| `autoLockTimeoutMs` | `number` | `300000` (5 min) | Idle timeout before auto-lock. `0` disables the idle timer. |
| `lockOnWindowBlur` | `boolean` | `true` | Lock immediately when the tab is hidden/backgrounded. |
| `onError` | `(err: Error) => void` | console | Surface internal errors (logging, telemetry, toasts). |

Auto-lock resets on `mousemove`, `keydown`, `scroll`, and `touchstart` while unlocked.

---

## API reference

### `useZkVault()`

Returns the vault context. Must be called inside a `VaultProvider`.

| Member | Signature | Description |
| --- | --- | --- |
| `isUnlocked` | `boolean` | True when the DEK is in memory. |
| `setupVault` | `(pin, userId, email) => Promise<boolean>` | Creates a new vault: generates the DEK, wraps it with the passcode, attempts a passkey, and persists. Unlocks on success. |
| `unlockWithPin` | `(pin, userId) => Promise<boolean>` | Unwraps the DEK with the passcode. |
| `unlockWithPasskey` | `(userId) => Promise<boolean>` | Unwraps the DEK with the passkey (triggers the native WebAuthn prompt). |
| `resetPin` | `(newPin, userId) => Promise<boolean>` | Re-wraps the DEK under a new passcode. Requires unlocked. |
| `setPasskey` | `(userId, email) => Promise<boolean>` | Adds or replaces the passkey envelope. Requires unlocked. |
| `checkVaultStatus` | `(userId) => Promise<VaultStatus>` | Reports which methods are provisioned. See below. |
| `encryptPayload` | `(data: unknown) => Promise<EncryptedPayload>` | Encrypts JSON-serializable data with the DEK. |
| `decryptPayload` | `(payload: EncryptedPayload) => Promise<unknown>` | Decrypts a payload. Validate the result. |
| `lock` | `() => void` | Clears the DEK from memory. |

### `VaultStatus`

```ts
interface VaultStatus {
  status: 'ok' | 'error'; // whether the read succeeded
  exists: boolean;        // any vault material present (trust only when status === 'ok')
  hasPin: boolean;        // a PIN envelope is provisioned
  hasPasskey: boolean;    // a passkey envelope is provisioned
  error?: Error;          // populated when status === 'error'
}
```

Always check `status === 'ok'` before trusting `exists`/`hasPin`/`hasPasskey`.

### `EncryptedPayload`

```ts
interface EncryptedPayload {
  cipher: string; // hex
  iv: string;     // hex (96-bit GCM IV)
}
```

### `IVaultStorageAdapter`

```ts
interface VaultEnvelopes {
  pinEnvelope: string | null;     // JSON string of EncryptedPayload
  pinSalt: string | null;         // hex string
  passkeyEnvelope: string | null; // JSON string of EncryptedPayload
  passkeyId: string | null;       // hex string of the WebAuthn rawId
}

interface IVaultStorageAdapter {
  loadEnvelopes: (userId: string) => Promise<VaultEnvelopes>;
  saveEnvelopes: (userId: string, envelopes: Partial<VaultEnvelopes>) => Promise<void>;
}
```

### `crypto.ts` helpers (advanced)

Exposed for advanced use; most apps won't need them directly: `generateDEK`, `deriveKeyFromPin`, `wrapKey`, `unwrapKey`, `encryptData`, `decryptData`, `registerPasskey`, `authenticatePasskey`, `isWebAuthnAvailable`, `bufToHex`, `hexToBuf`.

Use `isWebAuthnAvailable()` to decide whether to offer the passkey option in your own UI.

---

## Recovery, lockout, and edge cases

- **Forgot passcode, has passkey:** unlock with the passkey, then change the passcode in settings.
- **Lost passkey device, knows passcode:** unlock with the passcode, then register a new passkey via settings.
- **Lost both:** the data is unrecoverable by design. Communicate this clearly to users during setup.
- **Passcode brute force:** after 3 failed passcode attempts, `VaultUnlock` applies exponential backoff (1s, 2s, 4s … capped at 30s), persisted in `sessionStorage` so a reload doesn't reset it. This is a UX speed-bump — enforce real limits server-side.
- **Auto-lock:** the vault clears the DEK after the idle timeout and when the tab is hidden (configurable). The user re-unlocks to continue.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Authenticator does not support the PRF extension…" | The browser/authenticator lacks WebAuthn PRF. Use a recent browser with a platform authenticator, or fall back to passcode-only. |
| WebAuthn prompt never appears | Not a secure context. Serve over `https://` or `localhost`. |
| Passkey unlock fails on another device/site | The PRF salt is bound to the origin (`hostname`). The passkey must be used on the same origin it was registered on. |
| Decryption throws after a passcode change | A non-atomic `saveEnvelopes` likely persisted a new envelope without its salt. Ensure your adapter writes all fields in one update. |
| `useZkVault must be used within a VaultProvider` | A component using the hook is rendered outside the provider tree. |
| Vault appears empty after a network blip | Your gatekeeper treated a `status: 'error'` as "no vault". Handle the error branch (see the gatekeeper example). |

---

## Security checklist for production

- [ ] Served exclusively over HTTPS.
- [ ] Row-level security restricts each user to their own envelope columns.
- [ ] `saveEnvelopes` performs a single atomic write and throws on failure.
- [ ] Server-side rate limiting on the rows backing the vault (the client throttle is not enough).
- [ ] A strong Content-Security-Policy and disciplined XSS prevention (the unlocked DEK lives in the page).
- [ ] Users are told that losing both the passcode and all passkeys means permanent data loss.
- [ ] If your threat model requires it, add server-verified WebAuthn challenges on top of the client-side ceremony.

---

## License

MIT.
