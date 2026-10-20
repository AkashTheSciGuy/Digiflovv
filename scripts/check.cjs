const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const issues = [];
for (const file of ['index.html','features.js','app.js','styles.css']) {
  if (/[\u00e2][\u20ac\u2020]|\u00c3[\u0080-\u00bf]|\ufffd/.test(fs.readFileSync(path.join(root,'dist',file),'utf8'))) issues.push('Text encoding corruption: ' + file);
}
if (new Set(ids).size !== ids.length) issues.push('Duplicate HTML IDs');
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const value = match[1];
  if (value.startsWith('#')) {
    if (value.length > 1 && !ids.includes(value.slice(1))) issues.push(`Broken anchor: ${value}`);
  } else if (!/^[a-z]+:/i.test(value) && !fs.existsSync(path.join(root, 'dist', value))) issues.push(`Missing asset: ${value}`);
}
if (/data-purchase|id="checkout-dialog"/.test(html)) issues.push('Showcase must not display checkout controls');
for (const folder of ['dist', 'scripts', 'server', 'tests']) {
  for (const file of fs.readdirSync(path.join(root, folder)).filter(name => /\.(?:c?js)$/.test(name))) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, folder, file)], { encoding: 'utf8' });
    if (result.status) issues.push(`Syntax: ${folder}/${file}\n${result.stderr}`);
  }
}
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
else console.log('Syntax, anchors, assets, and showcase-only controls passed.');
