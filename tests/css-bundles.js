/* Bundled-CSS contract. Run: node tests/css-bundles.js */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools/css-bundles.json'), 'utf8'));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL: ' + m); } };
(async () => {
  const { buildBundle } = await import('../tools/build-css.mjs');
  for (const [name, def] of Object.entries(manifest)) {
    const bundlePath = path.join(root, def.out);
    ok(fs.existsSync(bundlePath), name + ': bundle file exists');
    const fresh = buildBundle(def);
    const onDisk = fs.existsSync(bundlePath) ? fs.readFileSync(bundlePath, 'utf8') : '';
    ok(onDisk === fresh.body, name + ': bundle is up to date with its source files (run node tools/build-css.mjs)');
    /* every source present, in manifest order */
    let at = -1;
    def.sources.forEach(s => { const i = onDisk.indexOf('/* ==== ' + s + ' ==== */'); ok(i > at, name + ': ' + s + ' is in the bundle, in order'); at = i; });
    ok(!/@import\b/.test(onDisk), name + ': no @import inside the bundle');
    for (const m of onDisk.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
      if (/^(data:|https?:|\/|#)/i.test(m[1])) continue;
      ok(fs.existsSync(path.join(path.dirname(bundlePath), m[1])), name + ': url(' + m[1] + ') resolves');
    }
    for (const page of def.pages) {
      const html = fs.readFileSync(path.join(root, page), 'utf8').split('</head>')[0];
      const links = [...html.matchAll(/<link\b[^>]*>/g)].map(x => x[0]);
      const b = links.filter(l => l.includes(def.out));
      ok(b.length === 1, page + ': links the bundle exactly once');
      ok(b.length === 1 && b[0].includes('?v=' + fresh.hash), page + ': bundle link carries the current ?v= hash');
      def.sources.forEach(s => ok(!links.some(l => l.includes('"' + s) || l.includes("'" + s)), page + ': no longer links ' + s + ' separately'));
    }
  }
  console.log(fail ? '\n' + fail + ' FAILED' : '\nALL PASSED'); process.exit(fail ? 1 : 0);
})();
