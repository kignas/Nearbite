# EatSwada — deploy checklist (Phase 5a)

Scope: stand up the new Next.js app as a SECOND Vercel project, preview it on a phone,
then swap the domain. The old project stays untouched as the rollback. No page code
changes are involved — only project settings, env vars and DNS.

Branch note: the migration work must be committed to the migration branch before the Vercel
project can build it — the deliverable zips are not committed, so push `web/` (and `tools/`,
`notes/`, `PROGRESS.md`, `AGENTS.md`) to that branch first. The task brief calls the branch
`next-migration`; use whatever the repo's actual migration branch is named (confirm with
`git branch -a` — this task was not allowed to run git).

---

## 1. Vercel project settings

| Setting | Value |
|---|---|
| Project | **new, second project** (do NOT reuse the legacy one) |
| Import | the same GitHub repo `kignas/Nearbite` |
| **Root Directory** | `web` |
| Framework Preset | Next.js (auto-detected) |
| Build Command | `next build` (default) — or leave blank |
| Install Command | `npm install` (default) — or leave blank |
| Output Directory | leave blank (Next.js default `.next`) |
| **Production Branch** | set to the migration branch (`nextjs-migration`) while testing |
| Node.js Version | **22.x** (Next 16 needs `node >=20.9.0`; built/verified here on Node 24.21.0) |
| Environment | Preview + Production as per §2 |

Steps:
1. Vercel → **Add New… → Project → Import** `kignas/Nearbite`.
2. In **Configure Project**, set **Root Directory = `web`** (click Edit, pick `web`).
3. Confirm the framework is detected as **Next.js**; leave build/install/output as default.
4. Add the env vars from §2 (Preview **and** Production).
5. **Deploy**. First build takes ~2–3 min.
6. To point at the branch: **Settings → Git → Production Branch** = `nextjs-migration`
   (or just push to `main` once the app is committed there). Every other branch becomes a
   Preview deployment automatically.

Keep the legacy project exactly as it is — it is the rollback (§4).

---

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (tick **Preview** and
**Production** for every one). Locally they live in `web/.env.local` (never committed, never
zipped). Values come from the legacy root `config.js`.

| NAME | Environments | Safe example value | Breaks if missing |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Preview, Production | `https://api.eatswada.com/api` | **Everything.** No restaurants, cart, orders, login, payments. Falls back to the prod API in `lib/config.ts`, so a missing value is survivable but must be set explicitly. |
| `NEXT_PUBLIC_BRAND_NAME` | Preview, Production | `EatSwada` | Falls back to `EatSwada`; cosmetic only. |
| `NEXT_PUBLIC_MAPTILER_ENABLED` | Preview, Production | `true` | Map features off (address picker, track-order map). |
| `NEXT_PUBLIC_MAPTILER_KEY` | Preview, Production | `JBRewxAAxaNAJiXuf1F9` (legacy public key) | Maps render blank / 401 from MapTiler. |
| `NEXT_PUBLIC_MAPTILER_MAP_ID` | Preview, Production | `streets-v4` | Falls back to `streets-v4`. |
| `NEXT_PUBLIC_FIREBASE_ENABLED` | Preview, Production | `true` | Push / Google-login init skipped. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Preview, Production | `AIzaSy…` (legacy public web key) | Firebase login + FCM push fail to init. Public by design. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Preview, Production | `eatswada.firebaseapp.com` | Google sign-in popup/redirect fails. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Preview, Production | `eatswada` | Firebase init fails. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Preview, Production | `eatswada.firebasestorage.app` | Firebase init fails. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Preview, Production | `644274579271` | FCM push token request fails. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Preview, Production | `1:644274579271:web:…` | Firebase init fails. |
| `EW_API_BASE_URL` | **NEVER set in Production** | *(unset)* | Test-only override read at request time in `web/lib/seo/restaurant-seo.ts` (`envApiBase()`). It exists so the SEO parity harness can point `/restaurant` + `/sitemap-restaurants.xml` at a local stub. **If it is set in Production, the live restaurant SEO pages and sitemap will fetch the wrong API.** Keep it UNSET everywhere on Vercel. |

Source of the values: legacy `config.js` (`API_BASE_URL`, `BRAND_NAME`, `MAPTILER.*`,
`FIREBASE.*`). All `NEXT_PUBLIC_*` values are public by design (they ship in the browser
bundle). The **server-only** variable is `EW_API_BASE_URL` and it must stay unset.

`grep process.env` across `web/app`, `web/lib`, `web/proxy.ts`, `web/next.config.js` returns
exactly the 12 `NEXT_PUBLIC_*` names above plus the `EW_API_BASE_URL` server override.

---

## 3. Phone preview test script (owner, ~15 min)

Open the **Preview** URL on a real phone (or Vercel → Deployments → open on device). Do the
20 steps **in order**. For each, the note says what "wrong" looks like.

1. **Home `/`** — hero, banners, category rail load. *Wrong:* blank hero, 404 banner images, layout jump.
2. **Scroll the home page** — section reveals animate in once. *Wrong:* content stays invisible, or re-animates on every scroll.
3. **Dark mode** — set the phone to dark, reload `/`. *Wrong:* a white flash before the dark paint (flash = the dark-mode bug is back).
4. **Search `/search`** — type a dish/restaurant name. *Wrong:* overlay never opens, or results never appear.
5. **Open a restaurant `/restaurant?id=<id>`** — menu renders. *Wrong:* 404, or "Restaurant unavailable" for a real id.
6. **Add to cart** — tap **+** on two dishes. *Wrong:* no quantity bump, no cart bar appears at the bottom.
7. **Bottom cart bar** — slides up, shows item count + total. *Wrong:* bar missing (add-to-cart is then broken everywhere).
8. **Cart `/cart`** — items, bill, delivery fee. *Wrong:* empty cart, wrong totals, page reload loop.
9. **Login `/login`** — log in (real account). *Wrong:* spinner forever, no redirect back.
10. **Orders `/orders`** — list of past orders. *Wrong:* "no orders" for an account that has some, or redirect to login while logged in.
11. **Track order `/track-order?id=<id>`** — status + map marker. *Wrong:* map blank (check `NEXT_PUBLIC_MAPTILER_KEY`), status never updates.
12. **Support `/support`** — tabs, open a ticket. *Wrong:* ticket form does nothing.
13. **Order help `/order-help`**, **Privacy data `/privacy-data`** — accordions/tabs open. *Wrong:* dead accordions.
14. **Razorpay (TEST MODE ONLY)** — start a checkout, confirm the Razorpay sheet opens in **test** mode. *Wrong:* **live keys** (stop immediately), or the sheet never opens.
15. **Push permission** — on `/` a push-permission prompt appears (once). *Wrong:* prompt loops on every visit, or never appears.
16. **Service worker update** — DevTools → Application → Service Workers: the new `sw.js` is **activated** and **Cache Storage no longer contains `eatswada-shell-v8`**. *Wrong:* the old cache is still listed (stale HTML keeps serving).
17. **Offline** — enable airplane mode, reload a visited page. *Wrong:* hard error page instead of the cached shell.
18. **Install as app** — browser menu → *Add to Home screen*; icon + name = EatSwada, opens standalone. *Wrong:* generic icon (manifest/webmanifest not served).
19. **Deep link `/about`** and `/cart?x=1` — clean URLs load. *Wrong:* 404 on a clean URL.
20. **Old URL** — visit `/about.html` — it must 301 to `/about` and keep any query. *Wrong:* the old page loads, or the query is dropped.

---

## 4. Cutover plan (domain swap, rollback kept)

**Before touching DNS**
- The new Vercel project must build green and the §3 phone pass must be clean.
- Backend CORS: the API (`api.eatswada.com`) must allow the new browser origin. Add
  **`https://eatswada.com`** and **`https://www.eatswada.com`** (plus the new project's
  `*.vercel.app` preview origin while testing). The legacy site is same-origin for API
  calls today; after the swap the app calls `api.eatswada.com` cross-origin, so a missing
  `Access-Control-Allow-Origin` will break every request.
- DNS TTL: lower `eatswada.com` (A/ALIAS + CNAME) to **300 s** at least 24 h before the swap.

**Swap**
1. In the **new** Vercel project → Settings → Domains → add `eatswada.com` and
   `www.eatswada.com`.
2. Remove those domains from the **old** project (or let Vercel prompt to move them).
3. Point the registrar/DNS records at Vercel as the new project's domain panel instructs
   (A `76.76.21.21` / ALIAS, or the CNAME it shows).
4. Wait for propagation (≤ TTL). Vercel issues the TLS cert automatically.

**First hour — verify**
- `curl -I https://eatswada.com/` → 200, `content-type: text/html`.
- `/about.html` → 301 `/about`; `/index` → 301 `/`; `/restaurant?id=<real>` → 200;
  `/restaurant` (no id) → 404; `/restaurant-shell` → `x-robots-tag: noindex, nofollow`.
- `/sitemap.xml` and `/sitemap-restaurants.xml` → 200 XML; `/robots.txt` → 200.
- `/sw.js` and `/firebase-messaging-sw.js` → 200 `application/javascript`, `max-age=0`.
- A real login, a real add-to-cart, and **one test-mode** Razorpay checkout end to end.
- Phone: dark-mode reload (no flash), cart bar, push prompt once, install-as-app.

**Rollback (exact)**
1. Re-add `eatswada.com` + `www` to the **old** Vercel project and re-point DNS at it
   (keep the old project's domain records; the swap only moved them).
2. Old project redeploys instantly from its last good deployment — no build needed.
3. Restore the original TTL after traffic is stable.
The legacy project is never deleted, so rollback is a domain re-point, not a code change.

---

## 5. Post-launch watch list (first 2 weeks)

- **Search Console**: resubmit `/sitemap.xml` and `/sitemap-restaurants.xml`; watch
  Coverage for new 404s (especially old `.html` URLs that should have 301'd).
- **404s**: check Vercel logs / analytics for hits on `/something.html` that did not
  redirect, and on clean URLs that are not yet ported.
- **Payment success rate**: compare Razorpay success vs. `POST /payments/verify` — a drop
  means the verify path broke.
- **Login errors**: watch for 401/403 spikes from `/users/*` (auth-token port regression).
- **Service worker**: confirm old `eatswada-shell-v8` cache deletion holds for returning
  users (a spike in stale-HTML reports means the SW update did not take).
- **Core Web Vitals / first-load JS**: `/cart` is the heaviest first-load route (~738 KB
  raw / ~224 KB gzip) — watch for a mobile LCP regression.
