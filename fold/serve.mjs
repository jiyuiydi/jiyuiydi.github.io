// Static file server for drafting the website locally. Node built-ins only.
// Serves the repository root, so the site can embed the editor where it already
// lives (../Fold Editor JS/) without copying it. "/" redirects to /website/.
// Usage: node website/serve.mjs  ->  http://localhost:8090/
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env['PORT'] ?? 8090);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.md': 'text/plain; charset=utf-8',
  '.fold': 'application/fold',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/') { res.writeHead(302, { location: '/website/' }).end(); return; }
  let path = join(ROOT, normalize(decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
  } catch { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, {
    'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(path).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
