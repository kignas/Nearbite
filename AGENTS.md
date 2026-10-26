# EatSwada migration playbook (read this first, every session)

You are migrating **eatswada.com**, a food-ordering site in Maynaguri, from 40 plain HTML pages
to **Next.js (App Router) + Tailwind CSS + Motion + GSAP + Lenis**.

## The one goal
**Same design, same features, same URLs. Only the stack and the animation quality change.**
If a change would make a page look or behave different (other than smoother animation), do not make it.

## Folder layout (you are working inside the OpenHands checkout of the GitHub repo `kignas/Nearbite`)
```
<repo root>   the ORIGINAL site (index.html, css/, js/, api/, config.js ...). READ-ONLY.
              Never edit, move or delete any existing file. In these docs "legacy" means these files.
web/          the new Next.js app. All your work goes here (create it if missing).
tools/        helper scripts (compare.mjs)
notes/        your maps and notes
PROGRESS.md   you keep this up to date after every task (see bottom)
deliverables/ zip files you hand back (see "Delivery" below)
```

## Delivery (IMPORTANT: you cannot commit or push)
You have no permission to commit or push to the repository. Do NOT run `git add`, `git commit`, `git push`, or create branches/PRs.
At the end of EVERY task:
1. Run `cd web && npm run build` and fix errors.
2. Create the zip from the repo root, excluding build folders:
   `mkdir -p deliverables && zip -r deliverables/eatswada-web-<task-name>.zip web tools notes PROGRESS.md -x "web/node_modules/*" "web/.next/*" "web/.env.local"`
3. Tell the owner the zip path, what is inside, and the exact steps to use it (unzip into the repo root, run `cd web && npm install && npm run dev`).
Each zip must be CUMULATIVE (contain the whole `web/` folder as it is now), so the owner only ever needs the latest zip.
Never include `.env.local` in a zip; list the env variable NAMES the owner must set in PROGRESS.md.

## Hard rules
1. **Design is frozen.** Copy the legacy CSS files (repo root and `css/`) into `web/styles/legacy/` byte for byte.
   Keep every class name and the same element structure. Do not "clean up", rename or restyle.
   Tailwind is installed for NEW things only (e.g. new animation wrappers). Never rewrite old CSS into Tailwind.
2. **CSS load order matters.** For each page, import its CSS in the same order as the `<link>` tags in the
   legacy HTML file. Write that list at the top of the page's task notes in PROGRESS.md.
3. **Do not rewrite business logic.** Port the functions from the legacy JS into `web/lib/` with the
   same behaviour, same names, same API calls, same payload shapes. Only add TypeScript wrappers.
   Use `strict: false` in tsconfig; `any` is acceptable. Do not fight the type checker.
4. **Never invent API endpoints or fields.** The backend is `https://api.eatswada.com/api`. Every call
   must come from something you can point to in legacy `api.js`, `js/*.js` or inline scripts.
5. **Browser-only code** (`localStorage`, `sessionStorage`, `window`, `document`, `navigator`, Razorpay,
   Firebase, Leaflet, Dark Reader) goes in `"use client"` components and inside `useEffect`, or behind
   `typeof window !== "undefined"`. The site uses `localStorage` about 400 times; this is the #1 source of bugs.
6. **One page (or one small component) per task.** Do not touch files outside the task.
   If the task seems to need that, stop and ask.
7. **Dependencies:** only `next react react-dom typescript tailwindcss motion gsap lenis firebase darkreader leaflet`
   (and `react-leaflet` only if needed). Ask before adding anything else.
8. **Secrets:** move values from legacy `config.js` into `web/.env.local` as `NEXT_PUBLIC_*`.
   Never hardcode keys in new files. Never print keys in logs or PROGRESS.md.
9. **Payments and login are the highest risk.** Port `js/order-payload.js`, `js/payment-verify.js`,
   `js/payment-state.js`, `js/checkout-key.js`, `js/auth-token.js` line for line. Use Razorpay TEST mode only.
   Never change what is sent to the backend.
10. **Do not delete or "fix" things you don't understand.** Add a `// TODO(question): ...` and list it in PROGRESS.md.
11. **Skip these legacy files** (old copies / junk): `restaurant old.html`, `track-order-10.html`,
    `css/Nsns`, `js/Hh`, `tests/H`. Ask the owner before skipping anything else.

## Definition of done for every page
- [ ] `cd web && npm run build` passes with no errors
- [ ] `node tools/compare.mjs <legacyUrl> <newUrl> <name>` shows diff under 1% at both phone (390x844) and desktop (1280x800)
- [ ] All buttons/forms on the page behave like the legacy page (list what you tested in PROGRESS.md)
- [ ] Navigating to this page and away from it (client-side) does not change how OTHER pages look (CSS leak check)
- [ ] PROGRESS.md updated

## How to work with large legacy files
`restaurant-shell.html` (160 KB), `track-order.html` (110 KB) and `order-support.html` (77 KB) are too big to read at once.
First produce a MAP (sections, scripts, functions, API calls, line ranges) and save it as `notes/<page>-map.md`.
Then port one section at a time, reading only that line range.

## URL and SEO contract (must not break; these URLs are already indexed by Google)
- Keep `/restaurant?id=...` as the restaurant URL. It must server-render title, description, canonical, Open Graph and
  JSON-LD using the same data and rules as legacy `api/restaurant-seo.js` (including the NEVER_INDEX_IDS list and 404/noindex cases).
  Implement with a server component + `generateMetadata`.
- `/restaurant-shell` and `/restaurant-shell.html` must send `X-Robots-Tag: noindex, nofollow`.
- Every old `/something.html` URL must 301-redirect to `/something` (`next.config.js` redirects). `cleanUrls` behaviour is preserved.
- `/sitemap.xml` and `/sitemap-restaurants.xml` keep working (see legacy `sitemap.js`, `api/sitemap.js`). `robots.txt` stays (remove its duplicated block).

## PWA and service workers (easy to get wrong)
- Legacy `sw.js` caches old HTML pages under cache name `eatswada-shell-v8`. Real users still have it installed.
  The new `public/sw.js` must, on activate, delete all old caches and must NOT precache the old `.html` list.
- `firebase-messaging-sw.js` stays at the site root in `public/` (push notifications depend on that exact path).
- There is no web manifest today. Add `app/manifest.ts` (name EatSwada, standalone, theme colour from legacy CSS, icons `icon-192.png`, `icon-512.png`).

## Animation rules (applied last, Phase 5)
- Motion (`motion/react`): add-to-cart quantity bump, cart bar slide-up, bottom sheets (filter sheet, `ew-sheet`, address), tab panel switch,
  page transitions (`app/template.tsx`), button press feedback. Replace the matching CSS keyframes only when the result looks the same or better.
- GSAP + ScrollTrigger: **home page hero and section reveals only**. Create and kill triggers inside `useEffect` cleanup.
- Lenis: **home page only**. Destroy on unmount. Disabled when `prefers-reduced-motion` is set.
- Animate only `transform` and `opacity`. Use custom easing, e.g. `[0.22, 1, 0.36, 1]`. Duration 0.25 to 0.6 s for UI, longer only for hero.
- Everything must respect `prefers-reduced-motion`. Layout, colours, fonts and spacing do NOT change.

## PROGRESS.md format (update after EVERY task)
```
## <date> Task: <name>
Files changed: ...
CSS import order: ...
Compare result: phone x.x% / desktop x.x%
Tested behaviours: ...
Open questions / TODOs: ...
```
