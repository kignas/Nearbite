# Eatswada React navigation transition preview

This isolated Stage 3 preview gives Home and Orders one persistent React navigation shell.

## What it does
- Keeps the floating two-tab navigation mounted while switching Home and Orders.
- Uses Motion spring transitions (transform/opacity) for the screen panes.
- Uses a shared `layoutId` pill for the active tab indicator.
- Adds a short React Bits-inspired tap response to both dock tabs: the icon gives a restrained spring movement and a soft expanding ring appears on every press. This is adapted for navigation; it does not copy the Bell Toggle's notification behavior.
- Honors `prefers-reduced-motion` and keeps native scrolling; the tap ring and icon motion are disabled when reduced motion is requested.
- Loads the existing `orders.html` inside a same-origin iframe only when Orders is first opened. This preserves the legacy Orders page's current data and interaction code while the React shell is being tested.
- The `ewReactShell=1` opt-in suppresses the legacy duplicate bottom bar and cross-document nav handler only inside the embedded Orders page. Normal `/orders.html` visits are unchanged.

## Required files
The companion `orders.html` change is included in the Stage 3 transition patch. Keep it alongside the existing root website files. The React shell expects `/orders.html` to be served from the same origin.

## Run
From `modern-shell/`:

```sh
npm install
npm run build
npm run dev
```

The Vite development server must be able to serve the root `orders.html` at `/orders.html`. This preview is isolated; do not route production users to it or merge it into `main` until the hosting path, authentication, iframe behavior, and Home/Orders regression tests are verified.
