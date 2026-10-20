const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'dist');
const output = path.join(root, 'release');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(source, 'config.js'), 'utf8'), context, { timeout: 1000 });
const config = context.window.DIGIFLOVV_CONFIG;
const publish = process.argv.includes('--public');
let origin;
if (config.siteUrl) {
  const url = new URL(config.siteUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('siteUrl must be an HTTPS origin, for example https://your-domain.example');
  origin = url.origin;
}
if (publish && !origin) throw new Error('Set the approved siteUrl before creating a public build.');
// Only remove our generated output, after verifying it is a direct project child.
if (path.dirname(output) !== root || path.basename(output) !== 'release') throw new Error('Invalid output path');
fs.mkdirSync(output, { recursive: true });
// A clean temporary staging directory avoids carrying deleted assets into a release.
const stage = fs.mkdtempSync(path.join(root, '.release-'));
try {
  fs.cpSync(source, stage, { recursive: true });
  let html = fs.readFileSync(path.join(stage, 'index.html'), 'utf8');
  if (publish) html = html.replace('content="noindex, nofollow"', 'content="index, follow"');
  if (origin) {
    const escape = value => value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html = html.replace('</head>', `<link rel="canonical" href="${escape(origin)}/">\n<meta property="og:url" content="${escape(origin)}/">\n</head>`);
  }
  const data = { '@context': 'https://schema.org', '@type': 'Product', name: config.product?.name || 'DigiFlovv automated plant watering system', brand: { '@type': 'Brand', name: 'DigiFlovv' }, description: 'An automated plant watering system with configurable watering schedules.' };
  if (origin) data.url = origin + '/';
  fs.writeFileSync(path.join(stage, 'product.jsonld'), JSON.stringify(data, null, 2));
  // JSON-LD is non-executable structured data; escape markup delimiters in configured text.
  html = html.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>\n</head>');
  fs.writeFileSync(path.join(stage, 'index.html'), html);
  fs.writeFileSync(path.join(stage, 'robots.txt'), publish ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
  fs.writeFileSync(path.join(stage, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${origin ? `<url><loc>${origin.replace(/&/g,'&amp;')}/</loc></url>` : ''}</urlset>\n`);
  fs.writeFileSync(path.join(stage, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n');
  fs.rmSync(output, { recursive: true, force: true });
  fs.renameSync(stage, output);
  console.log(`Built ${publish ? 'public' : 'local-review'} static website in release/. Nothing was deployed.`);
} finally {
  if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
}
