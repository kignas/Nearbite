/* EatSwada SEO enhancements: progressive, non-blocking, no app-flow changes. */
(function () {
  'use strict';
  var canonical = document.querySelector('link[rel="canonical"]');
  var desc = document.querySelector('meta[name="description"]');
  var titleBase = document.title;
  function setMeta(selector, attr, value) {
    var el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }
  function updateRestaurant() {
    var nameEl = document.getElementById('res-name');
    if (!nameEl) return;
    var name = (nameEl.textContent || '').trim();
    if (!name || name === 'Loading…' || name === 'Loading...') return;
    var cuisineEl = document.getElementById('res-cuisine');
    var cuisine = cuisineEl ? (cuisineEl.textContent || '').trim() : '';
    var id = new URLSearchParams(location.search).get('id');
    var cleanName = name.replace(/[<>]/g, '').slice(0, 120);
    var pageTitle = cleanName + (cuisine ? ' - ' + cuisine : '') + ' | EatSwada';
    var description = 'Explore the menu, dishes and ordering details for ' + cleanName +
      ' on EatSwada, your local food ordering platform in Maynaguri, West Bengal.';
    document.title = pageTitle;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', pageTitle);
    setMeta('meta[property="og:description"]', 'content', description);
    if (id && canonical) canonical.href = 'https://eatswada.com/restaurant.html?id=' + encodeURIComponent(id);
    var old = document.getElementById('ew-restaurant-jsonld');
    if (old) old.remove();
    var data = {'@context':'https://schema.org','@type':'Restaurant','name':cleanName,
      'servesCuisine': cuisine || undefined, 'url': location.href.split('#')[0],
      'areaServed': {'@type':'City','name':'Maynaguri'},
      'address': {'@type':'PostalAddress','addressLocality':'Maynaguri',
        'addressRegion':'West Bengal','addressCountry':'IN'}};
    var script = document.createElement('script');
    script.type = 'application/ld+json'; script.id = 'ew-restaurant-jsonld';
    script.textContent = JSON.stringify(data); document.head.appendChild(script);
  }
  if (document.getElementById('res-name')) {
    updateRestaurant();
    var target = document.getElementById('res-name');
    new MutationObserver(updateRestaurant).observe(target, {childList:true,subtree:true,characterData:true});
    var cuisine = document.getElementById('res-cuisine');
    if (cuisine) new MutationObserver(updateRestaurant).observe(cuisine,{childList:true,subtree:true,characterData:true});
  }
})();
