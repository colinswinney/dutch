// Adds a content hash to every script and the stylesheet in index.html, so a browser never mixes
// an old cached module with a new one after a deploy. Run after changing any file in js/ or css/:
//   node scripts/stamp.mjs
// Pass --check to only report whether index.html is up to date.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const hash = async (path) => createHash('sha1').update(await readFile(new URL(path, root))).digest('hex').slice(0, 10);

const modules = (await readdir(new URL('js/', root))).filter((f) => f.endsWith('.js')).sort();
const imports = {};
for (const file of modules) imports[`./js/${file}`] = `./js/${file}?v=${await hash(`js/${file}`)}`;

const block = [
  '<!-- stamp:start · written by scripts/stamp.mjs -->',
  `  <link rel="stylesheet" href="css/styles.css?v=${await hash('css/styles.css')}">`,
  `  <script type="importmap">${JSON.stringify({ imports })}</script>`,
  `  <script type="module" src="${imports['./js/app.js']}"></script>`,
  '  <!-- stamp:end -->',
].join('\n');

const indexUrl = new URL('index.html', root);
const html = await readFile(indexUrl, 'utf8');
const pattern = /<!-- stamp:start[\s\S]*?<!-- stamp:end -->/;
if (!pattern.test(html)) throw new Error('index.html has no stamp:start … stamp:end block');
const next = html.replace(pattern, block);

if (process.argv.includes('--check')) {
  if (next !== html) {
    console.error('✗ index.html has old version tags. Run: node scripts/stamp.mjs');
    process.exit(1);
  }
  console.log('✓ Version tags are up to date.');
} else {
  await writeFile(indexUrl, next);
  console.log(next === html ? 'Version tags were already up to date.' : 'Updated the version tags in index.html.');
}
