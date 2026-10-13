import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, sep, extname } from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

export function createPlaygroundServer(root) {
  return createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      // Dotfiles are not public assets. Canonical paths also contain symlinks.
      if (pathname.split('/').some(part => part.startsWith('.'))) throw new Error('Private path');
      const canonicalRoot = await realpath(root);
      let path = await realpath(resolve(canonicalRoot, `.${pathname}`));
      const inside = p => { const rel = relative(canonicalRoot, p); return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep)); };
      if (!inside(path) || relative(canonicalRoot, path).split(sep).some(part => part.startsWith('.'))) throw new Error('Private path');
      if ((await stat(path)).isDirectory()) path = await realpath(resolve(path, 'index.html'));
      if (!inside(path) || relative(canonicalRoot, path).split(sep).some(part => part.startsWith('.'))) throw new Error('Private path');
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream',
        'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const port = Number(process.env.PORT || 4173);
  const server = createPlaygroundServer(root);
  server.on('error', error => { console.error(`Could not start playground: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Slopfest is open at http://localhost:${server.address().port}`));
}
