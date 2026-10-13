import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensions = new Set(['.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.webp', '.woff2', '.ico']);
export async function buildSite(root) {
  const base = await realpath(root);
  const manifest = JSON.parse(await readFile(resolve(base, 'site.manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.files) || !manifest.files.length || new Set(manifest.files).size !== manifest.files.length) {
    throw new Error('Site manifest needs a nonempty list of unique files.');
  }
  const assets = [];
  for (const file of manifest.files) {
    if (typeof file !== 'string' || file.split('/').some(part => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part)) || !extensions.has(extname(file))) {
      throw new Error(`Not a portable browser asset: ${file}`);
    }
    const path = resolve(base, file);
    if (await realpath(path) !== path) throw new Error(`Symlinks cannot enter a release: ${file}`);
    assets.push({ file, contents: await readFile(path) });
  }
  // Validate every input before replacing the old generated output.
  const output = resolve(base, 'dist');
  await rm(output, { recursive: true, force: true });
  for (const { file, contents } of assets) {
    const destination = resolve(output, file);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
  return { output, files: assets.map(asset => asset.file) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  buildSite(fileURLToPath(new URL('../', import.meta.url)))
    .then(({ files }) => console.log(`Built ${files.length} browser assets into dist/.`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
