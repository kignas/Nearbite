/* ================================================================
   EATSWADA — OUTPUT ESCAPING
   TypeScript port of legacy `safe-html.js`.
   ----------------------------------------------------------------
   RULES (unchanged)
     1. Wrap EVERY interpolated API value in esc().
     2. Use safeUrl() for anything that lands in src="" or href="",
        then esc() the result.
     3. If the value is plain text with no markup around it, prefer
        el.textContent = value — nothing to escape at all.
   ================================================================ */

// Escapes quotes as well as angle brackets: roughly half the sinks in
// this codebase are attribute values (alt="", title="", href="tel:..."),
// where a bare " is enough to break out and add an event handler.
export function escapeHtml(value: any): string {
  return String(value == null ? "" : value).replace(
    /[&<>"']/g,
    function (c: string) {
      return (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        } as any
      )[c];
    }
  );
}

// Returns '' unless the value is a real http(s) URL, so a stored
// javascript: or data: URL can never reach src="" or href="".
export function safeUrl(value: any): string {
  if (!value) return "";
  try {
    const base =
      typeof location !== "undefined" ? location.href : "https://eatswada.com/";
    const u = new URL(String(value), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

/*
 * Display-only image optimization.
 *
 * This never changes the image URL stored in API/cart data. It only
 * transforms known image CDNs at the <img src> boundary:
 * - Cloudinary: automatic format/quality + bounded width
 * - Unsplash: automatic format/quality + bounded width
 *
 * Unknown hosts are returned unchanged so existing image behaviour is
 * preserved.
 */
export function optimizedImageUrl(value: any, width?: number): string {
  const url = safeUrl(value);
  if (!url) return "";

  const target = Math.max(64, Math.min(1600, Number(width) || 320));

  try {
    const base =
      typeof location !== "undefined" ? location.href : "https://eatswada.com/";
    const u = new URL(url, base);
    const host = u.hostname.toLowerCase();

    // Cloudinary image delivery: resize/compress only at render time.
    if (
      (host === "res.cloudinary.com" ||
        /(^|\.)cloudinary\.com$/i.test(host)) &&
      /\/image\/upload\//i.test(u.pathname)
    ) {
      const parts = u.pathname.split("/image/upload/");
      const transformation =
        "f_auto,q_auto,w_" + Math.round(target) + ",c_limit";
      const after = parts[1] || "";
      if (
        !/^(?:[^/]*,)?f_auto(?:,|\/|$)/i.test(after) &&
        !/^(?:[^/]*,)?q_auto(?:,|\/|$)/i.test(after)
      ) {
        u.pathname = parts[0] + "/image/upload/" + transformation + "/" + after;
      } else if (!/(^|,)w_\d+(?:,|$)/i.test(after.split("/")[0] || "")) {
        u.pathname = parts[0] + "/image/upload/" + transformation + "/" + after;
      }
      return u.href;
    }

    // Unsplash image delivery already supports safe client-side sizing.
    if (host === "images.unsplash.com") {
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("w", String(Math.round(target)));
      u.searchParams.set("q", "80");
      return u.href;
    }
  } catch {
    // Preserve the original safe URL on any unexpected URL parsing issue.
  }

  return url;
}

/*
 * Reusable premium food-image placeholder (styled by food-placeholder.css).
 * Returns the peach placeholder layer markup. Place it as the FIRST child
 * of an image host (the host must be position:relative/absolute) so a
 * successfully loaded <img> paints over it.
 */
export function foodPlaceholderMarkup(): string {
  return '<div class="ew-food-ph" aria-hidden="true"></div>';
}

/* Installs the legacy `window.*` globals for any not-yet-ported inline script. */
export function installSafeHtml(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.escapeHtml = escapeHtml;
  w.esc = escapeHtml;
  w.optimizedImageUrl = optimizedImageUrl;
  w.ewFoodPlaceholder = foodPlaceholderMarkup;
  w.safeUrl = safeUrl;
}
