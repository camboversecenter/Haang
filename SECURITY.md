# Security Policy

Haang (Little Tony APP) handles real sales, customer and staff data for small
businesses. We take security reports seriously and welcome responsible
disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Report privately to the maintainers at the CamboVerse Center, National
University of Management:

- Use GitHub's **[Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)**
  on this repository (Security → Report a vulnerability), or
- Email the maintainers via the contact listed at
  [camboverse.world](https://camboverse.world).

Please include:

- What the issue is and why you believe it is a security problem.
- Steps to reproduce (a proof of concept helps a great deal).
- The affected area — client app, Supabase RLS policy, Edge Function, or storage.
- Any suggested remediation.

We aim to acknowledge reports within **7 days** and to agree a disclosure
timeline with you. Please give us reasonable time to ship a fix before
publishing details.

## Scope

In scope:

- The web client in this repository.
- The Postgres schema, RLS policies and RPCs in `supabase/rbac_policies.sql`.
- The Edge Functions in `supabase/functions/`.

Out of scope:

- Vulnerabilities in Supabase, Google Gemini, Cloudflare or other third-party
  platforms themselves — report those to the respective vendor.
- Findings that require a compromised device, a rooted phone, or physical
  access to an already-unlocked terminal.
- Denial of service by traffic volume.

## Security model in brief

Access control is **enforced on the server**, not in the browser:

- Postgres **Row Level Security** is the security backbone. The client only ever
  holds the public *anon* key; every read and write is filtered by policy.
- Staff identity is a **server-minted session token** (`x-staff-token`), issued
  only after a server-side PIN check. Client-asserted role headers are not
  trusted.
- Staff **PINs are bcrypt-hashed at rest**, and the `pin` column is excluded
  from client SELECT privileges.
- The **`GEMINI_API_KEY` never reaches the browser** — all AI calls go through
  an Edge Function that verifies the caller is a signed-in owner or an active
  staff session.

See [`docs/security.md`](./docs/security.md) for the detailed model and its
known limitations.

## Known limitations

These are documented rather than hidden — see `docs/security.md`:

- Offline cached data and the queued write log sit in **plaintext in
  `localStorage`** on the device.
- The `Haang` storage bucket is **public**: objects are readable by anyone who
  knows the URL. Listing is restricted to authenticated users, but customer
  payment proofs should be moved to a private bucket with signed URLs before
  handling sensitive financial documents at scale.
- Public record identifiers are generated with `Math.random()`, which is not a
  cryptographic RNG. Anything treating an ID as an unguessable capability
  (shared receipts, table orders) inherits that weakness.
