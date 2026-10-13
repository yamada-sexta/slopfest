import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createPlaygroundServer } from '../serve.mjs';

test('The gallery server serves assets but keeps dotfiles and symlink escapes private', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'slopfest-server-'));
  const root = join(dir, 'public');
  await mkdir(root); await mkdir(join(root, 'project')); await mkdir(join(root, 'private-index'));
  await writeFile(join(root, 'index.html'), '<h1>Cabinet</h1>');
  await writeFile(join(root, 'project/index.html'), '<h1>Project</h1>');
  await writeFile(join(root, 'app.mjs'), 'export const toy = 1;');
  await writeFile(join(root, '.env'), 'NOT_A_REAL_SECRET');
  await writeFile(join(dir, 'outside.txt'), 'Outside');
  await symlink(join(dir, 'outside.txt'), join(root, 'escape.txt'));
  await symlink(join(root, '.env'), join(root, 'private-index/index.html'));
  const server = createPlaygroundServer(root);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base); assert.equal(home.status, 200); assert.equal(await home.text(), '<h1>Cabinet</h1>');
    assert.equal((await fetch(`${base}/project/`)).status, 200);
    const module = await fetch(`${base}/app.mjs`); assert.match(module.headers.get('content-type'), /javascript/);
    for (const path of ['/.env', '/%2eenv', '/escape.txt', '/private-index/', '/missing', '/%ZZ', '/%2e%2e%2foutside.txt']) {
      assert.equal((await fetch(`${base}${path}`)).status, 404, path);
    }
    const head = await fetch(base, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
