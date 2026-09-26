# Eatswada Dark Mode v5 — Dark Reader Dynamic Engine

This version replaces the custom runtime color heuristic with Dark Reader Dynamic Theme.

- Dark Reader 4.9.133 is loaded from jsDelivr.
- Existing Eatswada theme preference/popup/profile toggle behavior is preserved.
- Page-wide dark colors are no longer manually overridden by eatswada-theme.css.
- Dynamic Theme analyzes styles, background images and vector graphics rather than applying a global invert filter.
- Normal food/restaurant `<img>` elements are excluded from image analysis.

The external CDN dependency is intentional in this build because the development environment did not have npm/network access to bundle the Dark Reader API locally. For a fully self-contained production build, the same package can later be vendored/bundled locally.
