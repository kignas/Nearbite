# Auth + onboarding map (Phase 3b) — SHORT

Legacy: `login.html` (1187), `forgot-password.html` (146), `reset-password.html` (36),
`complete-profile.html` (546), `location-onboarding.html` (902); plus `js/auth-token.js`, `config.js`.
All five are `noindex, nofollow`. All carry the same pre-paint theme snippet (shared-map §12),
owned by `web/app/layout.tsx` — never re-added per page.

## Shared bases
`config.js`: `CONFIG.API_BASE_URL=https://api.eatswada.com/api`, `CONFIG.FIREBASE` (public web apiKey,
preflight-allow-listed), `CONFIG.MAPTILER`. `js/auth-token.js` -> `window.EWAuth` (ported: `web/lib/ew-auth.ts`).

## login.html
Assets: L8 pre-paint; L9 Dark Reader; L10 theme.js; L11 header-theme.js; L12 theme-color `#FFD92F`;
L13 title; L14-18 fonts + FA 6.5.2; L20-336 inline style -> `login-inline.css`; L338-354 inline
**redirect-callback gate** (`sessionStorage|localStorage['eatswada_google_redirect_pending']==='1'`
-> `html.auth-callback`); L356 `style.css`; L357-358 firebase-app/auth-compat 10.14.1; L359 `auth-token.js`;
L360 `config.js`; L361 `eatswada-theme.css`; L362 `eatswada-header-theme.css`; L364-489 style ->
`login-visual-redesign.css`; L491-533 style -> `login-polish.css`; L537-544 metadata; L546 `<body class="login-redesign">`;
L1185 `navigation.js`.
Body: `#authCallback`, `.hero-section`, `.bottom-sheet` with `#step1` (choice+password, L572-614),
`#step2` (forgot email L616-626), `#step3` (reset OTP `#resetOtpGrid` L629-649), `#step4` (new password L652-667).
Inline L668-1183 ends `setupResetOtpInputs(); resolveGoogleRedirect();`.
Firebase: `GoogleAuthProvider()`, `setCustomParameters({prompt:'select_account'})`, `signInWithPopup`,
`signInWithRedirect`, `getRedirectResult`, `currentUser`, `onAuthStateChanged`, `getIdToken`,
`initializeApp(CONFIG.FIREBASE)`, `apps`. Gate helpers L842-995: `googleRedirectPending/clearGoogleRedirectPending/
markGoogleRedirectPending/authGateActive/showAuthGate/revealLoginForm/resolveGoogleRedirect`.

Network (all POST, no auth header, `Content-Type: application/json`):
| # | method | path | body | notes |
|---|---|---|---|---|
| W1 | POST | `/api/users/login` | `{email,password}` or `{phone,password}` | WRITE; email lowercased; phone `+91`+10 digits iff exactly 10 else raw |
| W2 | POST | `/api/auth/firebase` | `{idToken}` | WRITE; Google exchange; `code==='PROFILE_REQUIRED'` -> complete-profile |
| W3 | POST | `/api/users/forgot-password/email` | `{email}` | WRITE |
| W4 | POST | `/api/users/forgot-password/email/verify` | `{email,otp}` | WRITE -> `data.data.resetToken` |
| W5 | POST | `/api/users/forgot-password/email/reset` | `{resetToken,password}` | WRITE |

Storage: read `eatswada_theme`, `eatswada_header_theme`; **write** `nearbite_token`, `token`, `nearbite_user`;
read+**remove** `nearbite_after_login`; **write/remove** `sessionStorage`+`localStorage['eatswada_google_redirect_pending']`;
**write** `sessionStorage['nearbite_google_pending_token'|'_profile']` on PROFILE_REQUIRED.
Redirects: `routeAfterAuthentication(profile,requested)` -> `location.replace(requested||'index.html')`,
`requested=localStorage['nearbite_after_login']||'index.html'` (**`?redirect=` is NOT read by login.html** —
the caller sets `nearbite_after_login`). Google new user -> `location.href='complete-profile.html?google=1'`
(token via sessionStorage only). step2->3->4 in-page (`showOnlyStep`) + `scrollTo({top:320})`.
`finishPasswordReset` success -> banner + `setTimeout(showLogin,1400)`. Other timers: carousel
`setInterval(3500)`, OTP resend countdown `1000`.
Already-logged-in: **no token check** — login.html renders the form as usual; the gate reacts only to
`eatswada_google_redirect_pending`. No auto-redirect.
Header/theme after login: shared shell needs only `eatswada_theme`/`eatswada_header_theme`; no header
markup on login.html. `complete-profile` writes `eatswada_theme_intro_pending='1'` for Home `ThemeIntro`.
Dead code: `#slide0..2` carousel + `setInterval(3500)` (L961-969; elements absent — interval still runs,
**ported as-is**); `fetchProfileForRouting()` (L733-737) unused stub; `.auth-callback` exit button
`revealLoginForm('')` is reachable.

## forgot-password.html (separate page; NOT the login.html step flow)
Assets: L7 pre-paint; L8 Dark Reader; L9 theme.js; L10 header-theme.js; L11 theme-color `#ffffff`; L12 title;
L13-14 fonts; L16 FA + `config.js`; L17 `safe-html.js`; L18-20 inline style -> `forgot-password-inline.css`;
L20 `style.css`; L21 `css/eatswada-ui-system.css`; L22 `eatswada-theme.css`; L23 `eatswada-header-theme.css`;
L27 canonical; L42-147 inline; L147 `navigation.js`.
Markup: `.header` back; `.content` -> `#error`, `#phoneStep`(`#phone`,`#sendBtn`), `#otpStep`(`#o1..#o6`,`#verifyBtn`,`#resendBtn`),
`#passwordStep`(`#newPassword`,`#confirmPassword`,`#resetBtn`).
Network (POST, phone-based):
| # | method | path | body |
|---|---|---|---|
| W6 | POST | `/api/users/forgot-password` | `{phone:'+91'+10digits}` |
| W7 | POST | `/api/users/forgot-password/verify` | `{phone,otp}` -> `data.data.resetToken` |
| W8 | POST | `/api/users/forgot-password/reset` | `{phone,resetToken,password}` |
Storage: none. Success -> `alert(...)` then `location.href='login.html'`. `countdown()` 1000ms `setInterval`
for 60s resend. OTP boxes: input/keydown/paste. Dead code: none (file comment documents earlier broken endpoints).

## reset-password.html (36-line stub)
Assets: L8 pre-paint; L9 Dark Reader; L10-11 theme scripts; L13 `<meta http-equiv="refresh" content="0;url=login.html">`;
L15-17 fonts; L18 `css/eatswada-ui-system.css`; L19 `eatswada-theme.css`; L20 `eatswada-header-theme.css`; L24 canonical.
Body: `<p>Opening Eatswada password reset...</p>` + `location.replace('login.html')`. No API/storage/Firebase.
Two redirect mechanisms (meta refresh 0s **and** `location.replace`).

## complete-profile.html
Assets: L8 pre-paint; L9 Dark Reader(defer); L10 theme.js; L11 header-theme.js; L12 theme-color `#FFD92F`;
L13 title; L15-17 fonts (400;500;600;700;800); L19 FA **6.4.0**; L20 `auth-token.js`; L21 `config.js`;
L22-23 firebase compat; L24-236 inline -> `complete-profile-inline.css`; L237 `css/eatswada-ui-system.css`;
L238 `eatswada-theme.css`; L239 `eatswada-header-theme.css`; L241-309 style -> `complete-profile-login-match.css`;
L311-319 metadata; L321 `<body>`; L405-542 inline; L544 `navigation.js`.
Markup: `.page`->`.topbar`(back->`safeBack()`), `.form`(`#errorBox`,`#googleIdentity`+`#googleAvatar/#googleName/#googleEmail`,
`#phone`,`#name`,`#password`+`#pwToggle/#pwIcon`,`#email`,`#reassureText`,`#age18`), `.cta-wrap` `#saveBtn`, `#loading`.
Network:
| # | method | path | body | headers |
|---|---|---|---|---|
| W9 | POST | `/api/auth/firebase/complete-profile` | `{idToken,name,phone:'+91'+digits,password,adultConfirmed}` | Content-Type (googleMode) |
| W10 | PUT | `/api/users/profile` | `{name,phone:'+91'+digits,email,password,adultConfirmed}` | Content-Type + `Authorization: Bearer <token>` |
| G1 | GET | `/api/users/profile` | — | `Authorization: Bearer <token>` |
Firebase: `initializeApp`, `onAuthStateChanged`, `currentUser`, `getIdToken` — only inside
`guardGoogleProfileCompletion()` (googleMode without pending token). `initFirebaseAuth()` false unless an app exists.
Storage: read `sessionStorage['nearbite_google_pending_token'|'_profile']`, `localStorage['nearbite_token'|'token']`;
**write** `nearbite_token`,`token`,`nearbite_user`,`eatswada_theme_intro_pending='1'`,`eatswada_new_user_location_pending='1'`
(last two Google path only); **remove** sessionStorage pending keys, `nearbite_after_login`.
Redirects: `!googleMode&&!sessionToken` -> `location.replace('login.html')` (parse time); googleMode no token/Firebase
user -> `login.html` (after async guard); `onboarding=googleMode||?onboarding=1` -> `location.replace('location-onboarding.html?from=complete-profile&next=index.html')`;
else `location.replace(nearbite_after_login||'index.html')`.
Validators: `nameValid`>=2; `phoneValid /^[6-9]\d{9}$/`; `passwordValid`>=8; `emailValid /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`;
`syncCta` enables `#saveBtn` iff all four + `#age18`. Quirk kept: input `minlength=6` but `passwordValid`>=8.
`formatPhone` keeps last 10 digits.

## location-onboarding.html
Assets: L8 pre-paint; L9 Dark Reader(defer); L10 theme.js; L11 header-theme.js; L12 theme-color `#FFD92F`;
L13 title; L14-16 fonts; L18 preconnect unpkg; L19 `config.js`; L20 Leaflet 1.9.4 CSS (unpkg, integrity);
L21 FA 6.5.2; L22-181 inline -> `location-onboarding-inline.css`; L182 `style.css`; L183-216 style ->
`location-gate-styles.css`; L217 `css/eatswada-ui-system.css`; L218 `eatswada-theme.css`; L219 `eatswada-header-theme.css`;
L221-285 style -> `location-login-match.css`; L287-295 metadata; L297 `<body>`; L359 `safe-html.js`; L360 `address-model.js`;
L361 Leaflet 1.9.4 JS (unpkg, integrity); L362-898 inline; L900 `navigation.js`.
Markup: `#map`, `.pin`, `.top-bar`(`#locationSearch`,`#locationSearchClear`,`#locationResults`,`#locationSearchStatus`),
`#locateBtn`, `.dock`(`#currentBtn`,`#warn`,`#locProgress`,`#locProgressText`,`#address`,`#confirm`),
`#lg-gate` dialog(`#lg-title`,`#lg-text`,`#lg-steps`,`#lg-primary`,`#lg-search`,`#lg-help`).
Network:
| # | method | path | notes |
|---|---|---|---|
| G2 | GET | `photon.komoot.io/api/?q=&limit=20&lang=en&lat&lon[&bbox]` | two parallel (local bbox + nationwide), `Accept: application/json`, AbortController |
| G3 | GET | `nominatim.openstreetmap.org/reverse?format=jsonv2&lat&lon&zoom=18&addressdetails=1` | `Accept: application/json` |
| G4 | GET | `/api/restaurants/serviceability?lat&lng` | `Accept: application/json`, `cache:'no-store'`; `{success,data:{serviceable,maxDeliveryDistanceKm,nearestDistanceKm}}` |
| G5 | GET | MapTiler tiles `api.maptiler.com/maps/<mapId>/{z}/{x}/{y}.png?key=` | OSM fallback when MapTiler disabled |
**No writes** (`confirmLocation` stores only localStorage).
Storage (write on confirm): `nearbite_onboarding_location`, `eatswada_device_location`,
`nearbite_onboarding_geocode` (when geocode ok), `nearbite_location_permission_seen`; read+remove
`nearbite_after_login`. `window.EatswadaAddressModel.recent.add({title,sub,lat,lng})` on select
(address-model.js, not ported).
Redirects/query: `?next=<encoded relative .html>` validated by `safeAppPath` (no scheme, no `//`, no leading
`/`/`\`, no whitespace/control, must match `^[\w.\-]+\.html(\?…)?(#…)?$`); `safeDecode` decodes <=2x.
`?from=address|select&return=<path>` back target; `?lat&lng&title&sub` preset point.
`mapBack()` -> `safeAppPath(return)` when `from in {address,select}` else `window.nearbiteSafeBack()`.
confirm success -> `location.replace(nextDestination() ?? (nearbite_after_login || 'index.html'))`.
Quirks kept: GPS gate un-dismissable (Escape/backdrop do nothing, focus trap), `openGate` kinds
`denied/blocked/unsupported/timeout/unavailable`; `permissionState()` raced vs 500ms timeout;
`getCurrentPosition({enableHighAccuracy:false,timeout:8000,maximumAge:120000})`; `DEFAULT=[26.545,88.820]`
visual-only (never confirmable until a real fix/selection); `searchLocation` runs **two** Photon fetches in parallel.
