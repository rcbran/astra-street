import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Run immediately after a build, before changing runtime source. A Git parent
// alone cannot identify the dirty working tree used for captured evidence.
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter((path) =>
    /^(src\/|app\/|public\/|package(?:-lock)?\.json$|(?:vite|next)\.config\.)/.test(
      path,
    ),
  )
  .sort();
const rows = [];
for (const path of [...new Set(files)]) {
  const bytes = await readFile(path);
  rows.push({
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const report = {
  at: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope:
    'Runtime source, public assets, dependency manifests, and Vite/Next configuration. Captured immediately after the labeled build.',
  sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
  files: rows,
};
await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log('Runtime build source fingerprint:', report.sha256);
