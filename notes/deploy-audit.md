# Phase 5a — build output audit (report only)

Generated from `next build` (Next.js 16.4.3, Turbopack) + `next start` on :3000.
Nothing in this file changes code — it is a report for the deploy decision.

## B1 — route table: what is dynamic and why

Full route table (41 app routes + `_not-found`):

```
○ static/prerendered (39):
  /  /_not-found  /about  /address  /address-new  /application-status  /apply
  /cart  /category  /complete-profile  /delivery-areas-and-charges  /faq
  /food-delivery-in-maynaguri  /forgot-password  /legal  /location-onboarding
  /login  /manifest.webmanifest  /order-help  /order-support  /orders
  /partner-rules  /partner-with-us  /payment-failed  /payment-pending
  /payment-success  /privacy-data  /profile  /rate-us  /refund-policy
  /reset-password  /restaurant-shell  /search  /storage-check  /support
  /terms  /track-order  /under99
ƒ dynamic (server-rendered on demand) (2):
  /restaurant
  /sitemap-restaurants.xml
```

`routes-manifest.json`: `dynamicRoutes: []`, `staticRoutes: 42`, `prerender-manifest`
has 41 prerendered routes. So exactly **two** routes hit the server:

| Route | Why it must be dynamic | Verdict |
|---|---|---|
| `/restaurant` | It is the SEO page. It server-renders `<title>`, description, canonical, OG and JSON-LD from live restaurant data (legacy `api/restaurant-seo.js`), including the `NEVER_INDEX_IDS` gate and the 404/noindex cases. The data is per-`?id=` and must be fresh, so it cannot be prerendered. The response also sets `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` (the CDN caches it, the function does not). | **Correct.** This is the only route AGENTS.md allows on the server. |
| `/sitemap-restaurants.xml` | It fetches `GET {API}/restaurants`, drops non-indexable ids and emits the XML, mirroring legacy `api/sitemap.js`, with `s-maxage=3600`. It is a Route Handler that reads the live restaurant list, so it must run at request time. | **Correct.** A sitemap that lists live restaurants cannot be a build-time static file without going stale. |

Everything else is static/prerendered — including `/restaurant-shell`, the cart, orders,
login, track-order and all the payment-result pages (they are client-driven; their data
comes from the browser at runtime, not from a server render). **No fix needed.**

## B2 — client-bundle secrets scan

Scanned `.next/static/**` and the prerendered HTML in `.next/server/app/**` for
`rzp_live`/`rzp_test`, `AIza…`, `eyJ…` (JWT), `Bearer`, `-----BEGIN … PRIVATE KEY-----`,
`mongodb`, `sk_live`, and internal backend URLs.

| Pattern | Hits | Verdict |
|---|---|---|
| `rzp_live_` / `rzp_test_` | **0** | Clean — no Razorpay key ships to the browser. |
| `AIza…` (Firebase web apiKey) | **0 in this build** | The public Firebase key is read from `NEXT_PUBLIC_FIREBASE_API_KEY` at runtime; it was **not set** for this build (no `web/.env.local`), so nothing was inlined. When the key IS set it is a *public* web key and is allow-listed by `tools/preflight.mjs`. |
| `eyJ…` (JWT) | **0** | Clean — no token is baked into the bundle. |
| `Bearer ` | present (many chunks) | **Not a secret.** It is the literal `Authorization: "Bearer " + token` concatenation in the API helper (e.g. `.next/static/chunks/0zbjaqa_zce13.js`). The token is read from `localStorage` at runtime. Expected. |
| `-----BEGIN … PRIVATE KEY-----` | **0** | Clean. |
| `mongodb` / `sk_live` / `secret` | **0** | Clean. |
| `https://api.eatswada.com/api` | present | **Allowed** — the public API base (also the `NEXT_PUBLIC_API_BASE_URL` default). Not internal. |
| `https://eatswada.onrender.com/api/vendor-applications…` | present in `2thtrsosn4el8.js`, `1dsytvwth77sl.js` | **Legacy quirk, not a leak.** The partner application pages (`apply`, `application-status`) post to a hardcoded `eatswada.onrender.com` base in legacy; the port keeps it byte-for-byte (AGENTS.md: do not rewrite business logic). It is a public API host, no credential. Logged as a post-migration item (§11). |
| `localhost` | present in vendor chunks only | Framework code (Next internals: `"localhost"===s.host`, IPv6 debug checks). No app config. |
| `password` | present | Form labels / Next's bundled URL parser (`this.password`). No credential value. |

**Conclusion: no secret ships in the client bundle.** The only notable string is the
legacy `eatswada.onrender.com` vendor-applications host, which is intentional legacy
behaviour and carries no credential.

## B3 — first-load JavaScript per route

Raw bytes of every `/_next/static/**.js` the served HTML references, plus gzip:

| Route | JS files | raw | gzip |
|---|---|---|---|
| `/` | 10 | 694.7 KB | 213.3 KB |
| `/restaurant` | 10 | 719.6 KB | 221.7 KB |
| `/cart` | 10 | 738.4 KB | 223.9 KB |
| `/login` | 8 | 597.1 KB | 183.2 KB |
| `/orders` | 8 | 615.0 KB | 190.0 KB |

5 largest chunks (`web/.next/static/chunks/`):

| chunk | raw | gzip |
|---|---|---|
| `3uo_fs_sdz1hy.js` | 224.5 KB | 70.1 KB |
| `25lco1ab1t8hn.js` | 162.9 KB | 44.7 KB |
| `2cln6msa1nwof.js` | 111.8 KB | 30.5 KB |
| `0cz1d0mv5g_q7.js` | 110.0 KB | 38.5 KB |
| `1bfw8w3pjd6yz.js` | 98.2 KB | 30.3 KB |

Total JS in `.next/static/chunks`: **1671.2 KB raw across 48 files**. Report only — no
code splitting was changed in this task.

## B4 — npm audit --omit=dev (report only)

```
4 high severity vulnerabilities
@grpc/grpc-js  <=1.13.5  (GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4)
  via @firebase/firestore -> @firebase/firestore-compat -> firebase
fix available via `npm audit fix --force` (installs firebase@9.14.0 — a breaking change)
```

Reachable only through the `firebase` package's gRPC dependency (Firestore). The app uses
Firebase for **auth + FCM push only**, not Firestore, so the gRPC path is not exercised.
**Not upgraded** in this task (the task says report only, and `--force` would downgrade
firebase across a major boundary). Flagged for a separate dependency-review task.
