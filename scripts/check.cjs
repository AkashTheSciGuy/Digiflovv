const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'dist');
const issues = [];
const publicFiles = fs.readdirSync(publicRoot);
for (const file of publicFiles.filter(name => /\.(html|js|css)$/.test(name))) {
  const content = fs.readFileSync(path.join(publicRoot,file),'utf8');
  if (/[\u00e2][\u20ac\u2020]|\u00c3[\u0080-\u00bf]|\ufffd/.test(content)) issues.push(`Text encoding corruption: ${file}`);
}
for (const file of publicFiles.filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(publicRoot,file),'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) issues.push(`Duplicate HTML IDs: ${file}`);
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (value.startsWith('#')) {
      if (value.length > 1 && !ids.includes(value.slice(1))) issues.push(`Broken anchor in ${file}: ${value}`);
    } else if (!/^[a-z]+:/i.test(value)) {
      const destination = value.split(/[?#]/)[0];
      if (!fs.existsSync(path.join(publicRoot,destination))) issues.push(`Missing asset/page in ${file}: ${value}`);
    }
  }
  if (/data-purchase|id="checkout-dialog"/.test(html)) issues.push(`Showcase must not display checkout controls: ${file}`);
  if (/type="password"/.test(html) && !/<fieldset[^>]*disabled/.test(html)) issues.push(`Password form needs a safe no-JavaScript fallback: ${file}`);
}
for (const folder of ['dist','scripts','server','tests']) {
  for (const file of fs.readdirSync(path.join(root,folder)).filter(name => /\.(?:c?js)$/.test(name))) {
    const result = spawnSync(process.execPath,['--check',path.join(root,folder,file)],{encoding:'utf8'});
    if (result.status) issues.push(`Syntax: ${folder}/${file}\n${result.stderr}`);
  }
}
if (issues.length) { console.error(issues.join('\n')); process.exitCode=1; }
else console.log('All pages: syntax, text encoding, anchors, assets, and safe form defaults passed.');
