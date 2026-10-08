const https = require('https');

const API_BASE = 'https://api.eatswada.com/api';
const ORIGIN = 'https://eatswada.com';

// Keep this list the same as NEVER_INDEX_IDS in restaurant-seo.js (test / demo restaurants).
const NEVER_INDEX_IDS = ['6ac5cbd0933976c30865d23e']; // Eatswada 2 (test)

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { accept: 'application/json' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error('API ' + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function toList(result) {
  if (Array.isArray(result)) return result;
  const d = result && result.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.restaurants)) return d.restaurants;
  if (result && Array.isArray(result.restaurants)) return result.restaurants;
  return [];
}

module.exports = async function handler(req, res) {
  try {
    const list = toList(await getJson(API_BASE + '/restaurants'));
    const urls = [ORIGIN + '/'];
    list.forEach(r => {
      const id = r && (r._id || r.id);
      if (!id || !/^[a-zA-Z0-9_-]{8,80}$/.test(String(id))) return;
      if (r.isActive !== true) return;
      if (r.approvalStatus && r.approvalStatus !== 'approved') return;
      if (NEVER_INDEX_IDS.indexOf(String(id)) !== -1) return;
      urls.push(ORIGIN + '/restaurant?id=' + encodeURIComponent(String(id)));
    });
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(u => '  <url><loc>' + u.replace(/&/g, '&amp;') + '</loc></url>').join('\n') +
      '\n</urlset>\n';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.end(xml);
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Sitemap temporarily unavailable');
  }
};
