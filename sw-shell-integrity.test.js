'use strict';
/* ============================================================
   sw-shell-integrity.test.js
   Regression guard for the Eatswada service-worker shell.

   Fails if sw.js precaches a file that does not exist on disk
   (the original bug: cache.addAll is atomic, so one missing file
   silently disabled the entire app shell cache), or if any page
   references a local script/stylesheet that does not exist.
   Run:  node sw-shell-integrity.test.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let failures = 0;

function check(name, ok, detail) {
  if (ok) {
    console.log('  ✓ ' + name);
  } else {
    failures++;
    console.error('  ✗ ' + name + (detail ? ' — ' + detail : ''));
  }
}

/* ---------- 1. sw.js precache list must only contain real files ---------- */
console.log('Service worker shell:');
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const shellMatch = swSrc.match(/const SHELL=\[([^\]]*)\]/);
check('SHELL array is defined', !!shellMatch);

if (shellMatch) {
  const entries = [...shellMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  check('SHELL has entries', entries.length > 0, String(entries.length));
  for (const entry of entries) {
    const rel = entry.replace(/^\.\//, '');
    // './' maps to index.html for a static site; skip the bare root entry.
    if (rel === '') { continue; }
    check('precache target exists: ' + entry,
      fs.existsSync(path.join(ROOT, rel)));
  }
  check('SHELL does not precache a nonexistent bottom-tab-bar.js',
    !entries.some(e => e.includes('bottom-tab-bar')));
  /* Install must not use atomic addAll over the whole SHELL: one bad URL
     would abort every other entry (original silent outage). */
  check('install uses per-entry tolerant caching (no bare addAll(SHELL))',
    !/addAll\(SHELL\)/.test(swSrc));
}

/* ---------- 2. Pages must not reference missing local assets ---------- */
console.log('\nPage asset references:');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const refRe = /(?:src|href)="([^"?#]+)(?:\?[^"]*)?"/g;
let scanned = 0;
for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  let m;
  while ((m = refRe.exec(html))) {
    const ref = m[1];
    if (!ref || /^(https?:)?\/\//.test(ref) || ref.startsWith('mailto:') ||
        ref.startsWith('tel:') || ref.startsWith('data:') ||
        ref.includes('${') || ref.includes('+')) continue;
    scanned++;
    check(page + ' -> ' + ref, fs.existsSync(path.join(ROOT, ref)));
  }
}
check('scanned a reasonable number of local refs', scanned > 50, String(scanned));

console.log('\n────────────────────────────────────────────');
if (failures) {
  console.error((failures) + ' failed');
  process.exit(1);
}
console.log('all shell-integrity checks passed');
