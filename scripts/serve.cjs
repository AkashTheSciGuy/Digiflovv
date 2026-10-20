const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.jsonld': 'application/ld+json', '.mp4': 'video/mp4', '.webm': 'video/webm' };

function createServer(options = {}) {
  const deviceBridge = options.deviceBridge || null;
  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; media-src 'self' https:; connect-src 'self' https://xqfgikcepbgcppfudpcm.supabase.co; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'");
    if (deviceBridge && await deviceBridge(request, response)) return;
    if (request.url === '/api/health' && ['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      return response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, service: 'digiflovv', mode: 'showcase' }));
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      return response.end();
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const segments = pathname.split(/[\\/]/);
      if (segments.some(segment => segment.startsWith('.')) || /[\x00-\x1f:*?\"<>|]/.test(pathname)) {
        response.writeHead(404); return response.end();
      }
      const filename = path.resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
      const actual = await fs.realpath(filename);
      const relative = path.relative(root, actual);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !types[path.extname(actual)]) {
        response.writeHead(404); return response.end();
      }
      const content = await fs.readFile(actual);
      response.writeHead(200, { 'Content-Type': types[path.extname(actual)], 'Content-Length': content.length });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404 : 500);
      response.end();
    }
  });
}

function startServer() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 5500);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Choose a port between 1 and 65535: npm run dev -- --port 5501');
    process.exitCode = 1;
  } else {
    const { bridgeFromEnvironment } = require('./device-bridge.cjs');
    const server = createServer({ deviceBridge: bridgeFromEnvironment() });
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use. Stop the existing preview or run: npm run dev -- --port ${port === 65535 ? 5500 : port + 1}`
        : 'The local server could not start. Check local network permissions.');
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`DigiFlovv is running at http://127.0.0.1:${port}\nSave your changes and refresh the browser. Press Ctrl+C to stop.`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  }
}
if (require.main === module) startServer();
module.exports = { createServer, startServer };
