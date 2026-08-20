# Changelog

Semantic versioning: MAJOR = a prop, exported type, or default behaviour changed in a way that
could break an existing consumer without any code change on their side. MINOR = additive only.
Consuming projects should pin to a tag (`#v1.0.0`), never `#main`.

## v1.1.0 — 2026-08-20

Additive. Adds password as a real second sign-in method alongside magic link, driven by a
genuine, already-existing setting: `claudia_project_branding.auth_method` (a real column with a
real CHECK constraint restricting it to `'magic_link' | 'password'`) that no application code
was actually reading before this. Two ways to set the method: the new optional `authMethod`
prop (a developer choosing it in code) or the live database column (an admin changing it with
no redeploy) — the prop wins when given, otherwise the component reads the column at runtime.
Every existing call site is unaffected: no `authMethod` prop, and the default (or a fetch
failure) both fall back to `'magic_link'`, the exact current behaviour.

Password mode deliberately does not add a `resetPasswordForEmail`-based recovery flow — that
would reintroduce the exact unbranded-email/wrong-redirect bug class this whole component
exists to prevent. It reuses `sendSignInLink` as the fallback instead, so a user without a
password yet (these are invite-gated apps with no self-registration) can always get in via the
same, already-proven mechanism.

Real bug caught by actually building, not assumed correct: the DB-read `.then().catch()` chain
doesn't compile — `@supabase/supabase-js`'s query builder returns `PromiseLike`, not a full
`Promise` (the same class of issue found in `@jo51yon/claudia-connectors` earlier). Fixed using
the two-argument `.then(onFulfilled, onRejected)` form instead.

## v1.0.1 — 2026-08-19

Patch, found before any real consumer existed. `strap` was required, but PETGI's real brand
header (its `Logo` component) already renders its own strap internally — a required separate
slot would have forced a duplicate or wrongly-placed strap the first time this was actually
used. Made optional. Widening a required prop to optional cannot break an existing caller
(every valid v1.0.0 call site still type-checks) — confirmed via check-breaking-exports.mjs,
not just asserted.

## v1.0.0 — 2026-08-19

First release. `ClaudiaAuthGate` — extracted from PETGI's and S3 Photobook's real
`AuthGate.tsx`, verified byte-identical in every line of actual auth logic before extraction,
diverging only in branding. `sendSignInLink` — the paired helper, also verified identical
except for the project slug.

**Known consumers at this tag:** none yet at release — PETGI and S3 Photobook are the first
real adoptions, landing in the same session this tag was cut.
