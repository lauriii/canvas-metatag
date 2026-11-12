// The sandbox and safety rules of the extension, as a grep. Part of `verify`.
// Test files are not shipped and are skipped.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// [pattern, why, files that may contain it]
const RULES = [
  [/onSubmit/, 'the sandbox never fires submit: use onClick and onKeyDown', []],
  [/_blank/, 'links open through host.openExternal', ['host.ts']],
  [/window\.open\b/, 'links open through host.openExternal', []],
  [/\bconfirm\(/, 'confirmations are inline', []],
  [
    /dangerouslySetInnerHTML|innerHTML|outerHTML|document\.write/,
    'text is rendered as React text nodes only',
    [],
  ],
  [/\.parent\b/, 'only host.ts touches the parent window', ['host.ts']],
  [/prefers-color-scheme/, 'the theme is forced to light', []],
];

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
  );

const found = [];
for (const file of files('src')) {
  if (/\.test\.tsx?$/.test(file)) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      for (const [pattern, why, allowed] of RULES) {
        if (pattern.test(line) && !allowed.some((name) => file.endsWith(name)))
          found.push(`${file}:${index + 1}: ${pattern.source} (${why})`);
      }
    });
}
// index.html loads nothing from another origin.
readFileSync('index.html', 'utf8')
  .split('\n')
  .forEach((line, index) => {
    if (/(?:src|href)\s*=\s*["']?(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(line))
      found.push(`index.html:${index + 1}: loads from another origin`);
  });

if (found.length) {
  console.error(`Forbidden patterns:\n${found.join('\n')}`);
  process.exit(1);
}
console.log('No forbidden patterns.');
