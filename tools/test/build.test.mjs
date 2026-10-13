import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../build.mjs';

test('A release includes only manifest assets; private files never ride along', async () => {
  const root = await mkdtemp(join(tmpdir(), 'slopfest-build-'));
  try {
    await writeFile(join(root, 'site.manifest.json'), JSON.stringify({ files: ['index.html'] }));
    await writeFile(join(root, 'index.html'), 'A cabinet');
    await writeFile(join(root, '.env'), 'PRIVATE');
    await writeFile(join(root, 'README.md'), 'Not a browser asset');
    const result = await buildSite(root);
    assert.deepEqual(result.files, ['index.html']);
    assert.deepEqual(await readdir(join(root, 'dist')), ['index.html']);
    assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), 'A cabinet');
    await writeFile(join(root, 'dist/stale.html'), 'Old build');
    await buildSite(root);
    assert.deepEqual(await readdir(join(root, 'dist')), ['index.html']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('Invalid manifests and symlinks fail before replacing an existing release', async () => {
  const root = await mkdtemp(join(tmpdir(), 'slopfest-build-'));
  try {
    await writeFile(join(root, 'index.html'), 'Last good version');
    const manifest = files => writeFile(join(root, 'site.manifest.json'), JSON.stringify({ files }));
    await manifest(['index.html']); await buildSite(root);
    for (const files of [[], ['index.html', 'index.html'], ['../index.html'], ['/index.html'], ['.env'], ['file.pem'], ['missing.html']]) {
      await manifest(files); await assert.rejects(buildSite(root));
      assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), 'Last good version');
    }
    await symlink(join(root, 'index.html'), join(root, 'linked.html'));
    await manifest(['linked.html']); await assert.rejects(buildSite(root), /Symlinks/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('Shipped HTML and module references resolve at a project-site base path', async () => {
  // Purely relative URLs are what let the same bundle run at / and /repo-name/.
  const root = new URL('../../', import.meta.url);
  const { files } = JSON.parse(await readFile(new URL('site.manifest.json', root), 'utf8'));
  for (const file of files) {
    const source = await readFile(new URL(file, root), 'utf8');
    const references = ext(file) === '.html' ? [...source.matchAll(/(?:href|src)="([^"#]+)"/g)].map(match => match[1])
      : ext(file) === '.mjs' ? [...source.matchAll(/from\s+'([^']+)'/g)].map(match => match[1]) : [];
    for (const reference of references) {
      assert.ok(!reference.startsWith('/') && !reference.includes(':'), `${file}: ${reference} must stay relative`);
      const url = new URL(reference, `https://example.invalid/cabinet/${file}`);
      assert.ok(url.pathname.startsWith('/cabinet/'), `${reference} escaped the project base`);
      const target = url.pathname.slice('/cabinet/'.length);
      assert.ok(target === '' || target.endsWith('/') ? files.includes(`${target}index.html`) : files.includes(target), `${file} references missing asset ${target}`);
    }
  }
});
const ext = file => file.slice(file.lastIndexOf('.'));
