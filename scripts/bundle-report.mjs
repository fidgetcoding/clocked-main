// Run after: npm run build -- --manifest
// Reports all statically imported JS required by the entry, excluding on-demand routes.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
const root = path.resolve(process.argv[2] ?? 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.vite/manifest.json'), 'utf8'));
const seen = new Set();
function visit(key) {
  if (seen.has(key)) return;
  if (!manifest[key]) throw new Error(`Missing manifest entry: ${key}`);
  seen.add(key);
  for (const dependency of manifest[key].imports ?? []) visit(dependency);
}
visit('index.html');
const files = [...seen].filter((key) => manifest[key].file.endsWith('.js')).map((key) => {
  const file = manifest[key].file;
  const bytes = fs.readFileSync(path.join(root, file));
  return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
});
console.log(JSON.stringify({ files, totalBytes: files.reduce((n, f) => n + f.bytes, 0), totalGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0) }, null, 2));
