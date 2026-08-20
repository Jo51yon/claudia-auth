# Changelog

Semantic versioning: MAJOR = a prop, exported type, or default behaviour changed in a way that
could break an existing consumer without any code change on their side. MINOR = additive only.
Consuming projects should pin to a tag (`#v1.0.0`), never `#main`.

## v1.0.0 — 2026-08-19

First release. `ClaudiaAuthGate` — extracted from PETGI's and S3 Photobook's real
`AuthGate.tsx`, verified byte-identical in every line of actual auth logic before extraction,
diverging only in branding. `sendSignInLink` — the paired helper, also verified identical
except for the project slug.

**Known consumers at this tag:** none yet at release — PETGI and S3 Photobook are the first
real adoptions, landing in the same session this tag was cut.
