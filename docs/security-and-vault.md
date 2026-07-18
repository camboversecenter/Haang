# Security & Zero-Knowledge Vault

Haang combines **server-side Row-Level Security (RLS)** for multi-tenant data isolation with a **client-side Zero-Knowledge (ZK) Vault** for encrypting sensitive data that the backend should never be able to read.

---

## 1. Row-Level Security (RLS)

Every table has RLS enabled. Data is scoped per shop, and writes are gated by role. See [user-roles.md](./user-roles.md) for the full permission matrix. Key design points:

- **Owner isolation** — the `is_shop_owner(shop_id)` helper grants a Supabase-authenticated owner full access only to their own shop.
- **Staff verification** — because staff share the owner's session on one device, the active role/ID travel as custom request headers (`x-staff-role`, `x-staff-id`) and are re-verified on **every write** by `verify_staff_permission()`. A spoofed role is rejected unless a real staff row with that role exists under the shop.
- **Secure PIN login** — `staff_login(phone, pin)` runs as a `SECURITY DEFINER` function so it can verify a PIN without exposing the whole staff table.
- **Public reads, guarded writes** — catalog tables (products, tables, settings, payment methods, discounts) are publicly readable for QR menu browsing, but writing is role-restricted.
- **Storage** — a public `Haang` bucket holds images/receipts; uploads are restricted to image types (`png/jpg/jpeg/webp`) and non-`private` folders.

---

## 2. The Zero-Knowledge Vault (`zk-vault/`)

A self-contained, framework-agnostic module that lets the app encrypt/decrypt data **entirely in the browser**. The backend only ever stores **ciphertext envelopes** — it has no ability to decrypt them.

### Threat model & guarantee
- The server (Supabase) stores only wrapped keys and ciphertext. Even a full database compromise does not reveal vault contents without the user's **PIN** or **passkey**.
- Trade-off (documented in code): the WebAuthn challenge is generated **client-side** and not verified by a server. This is intentional for a fully zero-knowledge design; replay protection relies on the browser's origin binding (`rpId`), not server-issued challenges.

### Cryptographic design (`crypto.ts`)
A two-tier **envelope encryption** scheme:

1. **Data Encryption Key (DEK)** — a random 256-bit **AES-GCM** key. This is the key that actually encrypts data.
2. **Key-Encryption Keys (KEKs)** — the DEK is *wrapped* (encrypted) by one or more KEKs, producing envelopes:
   - **PIN envelope** — KEK derived from the user's PIN via **PBKDF2-HMAC-SHA256** with **600,000 iterations** (OWASP 2024/2025 minimum) and a random 32-byte salt.
   - **Passkey envelope** — KEK derived from a **WebAuthn passkey using the PRF extension**. The authenticator's hardware secret produces keying material that cannot be reproduced from the public credential ID.
- The PRF salt is **bound to the app origin** (`zk-vault-v1:<hostname>`), so the same physical passkey derives a *different* key on a different site (application isolation).
- **AES-256-GCM** with a fresh random 12-byte IV per operation is used for all encryption and key wrapping.

### Unlock methods
The vault can be provisioned with **either or both**:
- **PIN** — always available; the primary method.
- **Passkey** — optional; added at setup or later via `setPasskey`. Falls back gracefully if the authenticator lacks PRF support.

Having two independent envelopes means either method can unlock the same DEK — and a PIN reset or passkey change re-wraps the *same* DEK rather than re-encrypting all data.

### Session & auto-lock (`VaultContext.tsx`)
- The unlocked DEK (`sessionKey`) **never leaves the provider closure** — consumers only get `encryptPayload` / `decryptPayload` functions, never the raw key.
- **Auto-lock on tab hide** — locks immediately when the tab is backgrounded (`lockOnWindowBlur`, default on).
- **Idle auto-lock** — locks after **5 minutes** of no mouse/keyboard/scroll/touch activity (`autoLockTimeoutMs`, default 300000ms).
- **Manual lock** — `lock()` clears the session key.

### Safe key rotation
`resetPin` and `setPasskey` require an already-unlocked vault and use **snapshot + rollback**: if persisting a new envelope fails, the prior envelope is restored. The storage adapter's `saveEnvelopes` carries an **atomicity contract** — envelope + matching salt must be written in a single transaction so a partial write can never leave the vault permanently undecryptable.

### Storage adapter
The vault is decoupled from its backing store via `IVaultStorageAdapter`. Haang wires it to Supabase through `services/supabaseVaultAdapter.ts`, which persists the four envelope fields: `pinEnvelope`, `pinSalt`, `passkeyEnvelope`, `passkeyId`.

### Status handling
`checkVaultStatus()` returns `{ status, exists, hasPin, hasPasskey }`. A **failed load is reported as `status: 'error'`, never as "no vault"** — this prevents a transient network error from routing a user into the setup flow and overwriting an existing vault.

---

## 3. App-Level Access Gates

On login, `App.tsx` walks a sequence of gates before showing the main app:
1. **Not logged in** → Login screen.
2. **Owner without a shop** → Shop Setup.
3. **Vault not set up** → Vault Setup (create PIN, optionally register passkey).
4. **Vault locked** → Vault Unlock (PIN or passkey).
5. **Shared device, no active operator** → Lock Screen (pick staff + PIN) when multi-role is on.
6. **Authorized** → Main app.

---

## Related components
- `zk-vault/crypto.ts` — all cryptographic primitives.
- `zk-vault/VaultContext.tsx` — provider, session, auto-lock, key rotation.
- `zk-vault/hooks.ts` — `useZkVault()` consumer hook.
- `components/zk-vault/VaultSetup.tsx`, `VaultUnlock.tsx`, `VaultSettings.tsx` — UI.
- `services/supabaseVaultAdapter.ts` — Supabase persistence.
- A standalone, reusable copy of the module (plus a wallet-signer variant) lives in `zk-vault-download/`.
