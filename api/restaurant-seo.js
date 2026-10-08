const https = require('https');

const API_BASE = 'https://api.eatswada.com/api';
const CANONICAL_ORIGIN = 'https://eatswada.com';

// Restaurants that must NEVER be indexed by Google (test / demo restaurants).
const NEVER_INDEX_IDS = ['6ac5cbd0933976c30865d23e']; // Eatswada 2 (test)

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { accept: 'application/json' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('Upstream API returned ' + res.statusCode));
        }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}
function safeImage(value) {
  return typeof value === 'string' && /^https:\/\/res\.cloudinary\.com\//i.test(value)
    ? value : '';
}
function send(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  Object.keys(extraHeaders || {}).forEach(k => res.setHeader(k, extraHeaders[k]));
  res.end(body);
}

module.exports = async function handler(req, res) {
  try {
    const id = String((req.query && req.query.id) || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
      return send(res, 400, '<!doctype html><title>Invalid restaurant</title><h1>Invalid restaurant link</h1>',
        {'X-Robots-Tag':'noindex, nofollow'});
    }

    const result = await getJson(API_BASE + '/restaurants/' + encodeURIComponent(id));
    const restaurant = result && result.data;
    if (!result || result.success !== true || !restaurant ||
        restaurant.isActive !== true || restaurant.approvalStatus !== 'approved') {
      return send(res, 404, '<!doctype html><title>Restaurant unavailable | EatSwada</title><h1>Restaurant unavailable</h1>',
        {'X-Robots-Tag':'noindex, nofollow'});
    }

    const host = (req.headers && req.headers.host) || 'eatswada.com';
    const protocol = (req.headers && req.headers['x-forwarded-proto']) || 'https';
    const shellUrl = protocol + '://' + host + '/restaurant-shell';
    const shellResponse = await new Promise((resolve, reject) => {
      https.get(shellUrl, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => body += chunk);
        response.on('end', () => response.statusCode === 200 ? resolve(body) : reject(new Error('Could not load restaurant shell')));
      }).on('error', reject);
    });

    const name = String(restaurant.name || 'Restaurant').trim().slice(0, 120);
    const cuisine = Array.isArray(restaurant.cuisine) ? restaurant.cuisine.join(', ') :
      String(restaurant.cuisineDisplay || restaurant.cuisine || '').trim();
    const desc = 'Explore the menu and order from ' + name +
      (cuisine ? ' serving ' + cuisine : '') +
      ' in Maynaguri, West Bengal on EatSwada.';
    const canonical = CANONICAL_ORIGIN + '/restaurant?id=' + encodeURIComponent(id);
    const image = safeImage(restaurant.image);
    const indexEnabled = false; // STAGING: keep demo restaurants out of search until launch.
    const robots = (indexEnabled && NEVER_INDEX_IDS.indexOf(id) === -1) ? 'index, follow' : 'noindex, nofollow';
    const schema = {
      '@context':'https://schema.org',
      '@type':'Restaurant',
      'name':name,
      'url':canonical,
      'description':desc,
      'servesCuisine':cuisine || undefined,
      'image':image || undefined,
      'address': {
        '@type':'PostalAddress',
        'streetAddress': String(restaurant.address || ''),
        'addressLocality':'Maynaguri',
        'addressRegion':'West Bengal',
        'addressCountry':'IN'
      },
      'areaServed': {'@type':'City','name':'Maynaguri'}
    };

    let output = shellResponse;
    output = output.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '<title>' + esc(name + ' | EatSwada') + '</title>');
    const inject = [
      '<meta name="description" content="' + esc(desc) + '">',
      '<meta name="robots" content="' + robots + '">',
      '<link rel="canonical" href="' + esc(canonical) + '">',
      '<meta property="og:type" content="restaurant">',
      '<meta property="og:site_name" content="EatSwada">',
      '<meta property="og:title" content="' + esc(name + ' | EatSwada') + '">',
      '<meta property="og:description" content="' + esc(desc) + '">',
      '<meta property="og:url" content="' + esc(canonical) + '">',
      image ? '<meta property="og:image" content="' + esc(image) + '">' : '',
      '<script type="application/ld+json">' + JSON.stringify(schema).replace(/</g,'\\u003c') + '</script>',
      '<script>try{history.replaceState(null,"",location.pathname+"?id=' + encodeURIComponent(id) + '"+location.hash)}catch(e){}</script>'
    ].filter(Boolean).join('\n');
    output = output.replace(/<\/head>/i, inject + '\n</head>');
    return send(res, 200, output, {'X-Robots-Tag': robots});
  } catch (error) {
    return send(res, 502,
      '<!doctype html><title>Temporarily unavailable | EatSwada</title><h1>Restaurant page temporarily unavailable</h1><p>Please try again.</p>',
      {'X-Robots-Tag':'noindex, nofollow'});
  }
};
