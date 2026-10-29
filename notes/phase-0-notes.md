# Phase 0 notes — Next.js scaffold

Date: 2026-10-26

## What this phase did
Created the empty Next.js shell that later phases build pages into. No pages were built.
No legacy file was edited, moved or deleted.

## web/ app shape
- `npx create-next-app@latest web` → **Next.js 16.4.3**, React 19.3.0, TypeScript 5, Tailwind 4,
  ESLint 9, App Router, **no `src/` dir**, import alias `@/*`.
- Next 16 enables `cacheComponents` + `partialPrefetching` by default in the generated
  `next.config.ts`; those were carried over into `next.config.js` (with the generated
  Turbopack `*.css` rule) so the scaffold keeps its intended behaviour.

## Why `next.config.js` and not `next.config.ts`
The task asks for `next.config.js`. Next only allows one config file, so the generated
`next.config.ts` was **deleted** and replaced by `next.config.js` carrying the same options
plus the redirects/rewrites/headers ported from legacy `vercel.json`.

## CSS copy (design frozen)
- root `*.css` → `web/styles/legacy/` (20 files)
- `css/*.css` → `web/styles/legacy/css/` (54 files)
- 74 files total, all byte-for-byte identical to the originals (verified with `cmp`).
- `css/Nsns` (junk, 6 bytes of "ehehj") was **not** copied — it is on the skip list.
- No legacy CSS file contains an `@import`, so copying them flat is safe.

## Static assets
`*.svg`, `*.png`, `*.webp`, `*.ico`, `robots.txt` and `firebase-messaging-sw.js` copied to
`web/public/` (byte-identical). `firebase-messaging-sw.js` must stay at the site root for push.

## 301 redirects (data-driven — updated in the "Phase 0 fixes" task)
`next.config.js` defines `const PORTED_PAGES = []` and a `LEGACY_HTML` table mapping each of
the 40 legacy `*.html` files to its clean URL. A redirect is generated only for a file whose
`page` is in `PORTED_PAGES`, so a legacy `.html` URL keeps serving until its clean page exists.
`restaurant old.html` maps to `/restaurant` and `track-order-10.html` to `/track-order`; the
former's `file` is the URL-encoded `restaurant%20old.html` (a raw-space source never matches).
Always on: `/restaurant.html` → `/restaurant`, both rewrites, and the noindex headers.
Gating verified live: with `PORTED_PAGES = []` only `/restaurant.html` 301s; adding
`["/restaurant", "/track-order"]` activates `/restaurant.html`, `/restaurant%20old.html`,
`/track-order.html` and `/track-order-10.html`. **Each phase must append its pages.**

## Tailwind setup (updated in the "Phase 0 fixes" task)
`app/globals.css` is exactly:
```
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```
The plain `@import "tailwindcss"` (which includes preflight) was removed so Tailwind's reset
cannot alter the legacy design. Confirmed in the built CSS: theme tokens + used utilities only,
no `box-sizing: border-box` / `-webkit-text-size-adjust` / `img { display: block }`.
The Geist font imports and starter classes were removed from `app/layout.tsx`, and
`app/page.tsx` is an empty placeholder returning `null`.

## compare.mjs (updated in the "Phase 0 fixes" task)
`tools/compare.mjs` is copied verbatim to `web/scripts/compare.mjs` and `package.json` has
`"compare": "node scripts/compare.mjs"`. Run it from `web/` so Node resolves
`playwright`/`pixelmatch`/`pngjs` from `web/node_modules`:
`cd web && npm run compare -- <legacyUrl> <newUrl> <name>`.
No root `package.json` and no symlink are needed (verified: 0.00% / 0.00%, PASS).

