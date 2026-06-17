# Wallet Signer (`src/wallet`) — isolated key, non-custodial

An add-on to `zk-vault-react` for storing a **crypto wallet private key** with a sharply reduced exposure surface, while keeping the non-custodial model (you hold the keys; there is no server-side recovery).

It changes two things versus encrypting a key with the base vault:

1. **The private key lives only inside a Web Worker.** It is generated, decrypted, and used for signing entirely inside `signer.worker.ts`. There is no message that returns the raw key to the page. The page can ask the worker to *sign*, not to *hand over the key*.
2. **Argon2id replaces PBKDF2** for the passcode envelope. The server-stored envelope is far more expensive to brute-force offline if your database ever leaks.

The dual-envelope design is unchanged: a random DEK encrypts the private key, and the DEK is wrapped independently by an Argon2id passcode KEK and a WebAuthn-PRF passkey KEK.

---

## ⚠️ Read this first — what isolation does and does NOT buy you

A same-origin Web Worker is a real improvement, but it is **not** a security boundary against a compromised page. Be honest with yourself about the threat model:

**What the worker DOES protect against**

- **Key exfiltration / theft-at-rest.** The long-lived private key never sits in main-thread memory, so a script that reads `window`, React state, or the DEK cannot copy the key out to drain the wallet later or across sessions. This is the most common and damaging failure mode, and it is genuinely closed.

**What the worker does NOT protect against**

- **Unauthorized signing while unlocked.** A same-origin XSS can `postMessage` the worker and call `signDigest`/`personalSign` just like your app does. It cannot read the key, but it can ask the key to sign a draining transaction during an unlocked session. The worker is same-origin; isolation of *memory* is not isolation of *control*.

**The only robust mitigations for unauthorized signing**

- **A trusted confirmation surface the page cannot forge.** The gold standard is a **cross-origin iframe** (a separate origin like `signer.yourapp.com` with its own strict CSP) that renders the transaction details and an approve button itself, so a compromised parent page cannot fake approval. Or a **hardware wallet / secure enclave / MPC signer** (Privy, Turnkey, Lit, Web3Auth, Coinbase WaaS) where signing requires a factor outside the page.
- This module gives you the worker boundary and a clean `signDigest` chokepoint to attach such a confirmation step. It does not, by itself, provide an unforgeable confirmation UI.

**Non-custodial trade-offs that remain (by design, not bugs)**

- Lose the passcode and every passkey → funds are unrecoverable. No admin can help.
- Client-side WebAuthn challenge (no server ceremony verification), same as the base library.

If you are holding meaningful value, get a professional audit and strongly consider a cross-origin iframe or MPC/hardware signer rather than a same-origin worker alone.

---

## Files

| File | Runs on | Purpose |
| --- | --- | --- |
| `messages.ts` | both | Wire protocol types (no key material) |
| `crypto-core.ts` | worker | Argon2id, AES-GCM, secp256k1 sign, EIP-55 address |
| `signer.worker.ts` | worker | Holds the key; handles unlock/sign/lock |
| `WalletSignerClient.ts` | main | Promise API over the worker |
| `webauthn-prf.ts` | main | WebAuthn PRF ceremony (workers can't do WebAuthn) |
| `useWalletSigner.ts` | main | React hook tying it to your storage |
| `index.ts` | main | Barrel export |

Build note: `WalletSignerClient` spawns the worker with `new Worker(new URL('./signer.worker.ts', import.meta.url), { type: 'module' })`, which Vite, webpack 5, and Next.js bundle automatically.

---

## Storage

Persist one record per user (all fields together, atomically):

```sql
ALTER TABLE wallet_vaults
  ADD COLUMN pin_salt         TEXT,
  ADD COLUMN pin_envelope     TEXT,   -- DEK wrapped by Argon2id passcode KEK
  ADD COLUMN passkey_envelope TEXT,   -- DEK wrapped by passkey PRF KEK (nullable)
  ADD COLUMN passkey_id       TEXT,
  ADD COLUMN wallet_envelope  TEXT;   -- private key encrypted by the DEK
```

All values are ciphertext or public identifiers. Apply per-user row-level security as with the base vault.

---

## Usage

```tsx
import { useWalletSigner, WalletStorageAdapter } from './wallet';

const storage: WalletStorageAdapter = {
  load: async (userId) => {
    const { data } = await supabase
      .from('wallet_vaults').select('*').eq('id', userId).single();
    if (!data) return null;
    return {
      pinSalt: data.pin_salt,
      pinEnvelope: data.pin_envelope,
      passkeyEnvelope: data.passkey_envelope,
      passkeyId: data.passkey_id,
      walletEnvelope: data.wallet_envelope,
    };
  },
  // MUST be a single atomic write.
  save: async (userId, r) => {
    const { error } = await supabase.from('wallet_vaults').update({
      pin_salt: r.pinSalt,
      pin_envelope: r.pinEnvelope,
      passkey_envelope: r.passkeyEnvelope,
      passkey_id: r.passkeyId,
      wallet_envelope: r.walletEnvelope,
    }).eq('id', userId);
    if (error) throw error;
  },
};

function Wallet({ user }) {
  const w = useWalletSigner({ storage, onError: (e) => console.error(e) });

  // First time:
  // await w.createWallet(user.id, passcode, { withPasskey: true, email: user.email });

  // Returning:
  // await w.unlockWithPin(user.id, passcode);
  // or await w.unlockWithPasskey(user.id);

  async function send() {
    if (!w.isUnlocked) return;

    // 1. Build the transaction and its 32-byte signing digest in YOUR code.
    const digestHex = '0x...'; // keccak256 of the RLP-encoded tx, etc.

    // 2. STRONGLY RECOMMENDED: show the user the decoded transaction and get an
    //    explicit confirmation here — ideally in a context a compromised page
    //    cannot forge (cross-origin iframe). See the threat-model section.

    // 3. Sign. The worker never reveals the key — only this signature.
    const sig = await w.signDigest(digestHex);
    // sig = { signatureHex, r, s, v } — attach to your transaction and broadcast.
  }

  return <div>Address: {w.address}</div>;
}
```

`personalSign(message)` is provided for EIP-191 personal_sign. `lock()` zeroizes the key in the worker; the hook also tears the worker down on unmount.

---

## Tuning Argon2id

Defaults are `memorySizeKiB: 65536` (64 MiB), `iterations: 3`, `parallelism: 1` — wallet-grade. On low-end mobile this can be slow; drop memory to `19456` (19 MiB) for the OWASP baseline. Pass via the hook:

```ts
useWalletSigner({ storage, argon2: { memorySizeKiB: 19456, iterations: 2, parallelism: 1 } });
```

Changing parameters changes the derived key, so a vault created with one set of parameters must be unlocked with the same set. If you plan to tune over time, store the parameters alongside the record.

---

## What this is not

This is a reference implementation that closes the at-rest extraction gap and upgrades the KDF. It is **not** a substitute for a hardware wallet, a cross-origin signing iframe, or an MPC/threshold setup when real funds are at stake. Treat it as a meaningful hardening step, not a finished custody solution, and have it audited before production use.
