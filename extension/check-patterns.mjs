// The sandbox and safety rules of the extension, as a grep. Part of `verify`.
// Test files are not shipped and are skipped.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

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

// The budget of what every opening loads, gzipped: main.js and the chunks it
// imports. 243,711 bytes before compose-values-from-fields; 256,426 after it
// (+5.2 %, within design D10's 15 %: the composing rules in values.ts, words
// in model.ts and checks.ts, and the composer's place in Value.tsx; the
// editor library is its own chunk below), plus 5 KB. Raise it on purpose,
// never by accident.
const BUDGET = 256426 + 5 * 1024;
const size = (file) => gzipSync(readFileSync(`dist/${file}`), { level: 9 }).length;
const main = readFileSync('dist/main.js', 'utf8');
const imported = [...main.matchAll(/from"\.\/([\w-]+\.js)"/g)].map((match) => match[1]);
const gzipped = size('main.js') + imported.reduce((sum, file) => sum + size(file), 0);
if (gzipped > BUDGET) {
  found.push(`dist/main.js and its chunks: ${gzipped} bytes gzipped, over the budget of ${BUDGET}`);
}
// The composer and its editor library load only where a value composes, as
// their own chunk, never with every opening (design D10: at most 45 KB).
const COMPOSER_BUDGET = 45 * 1024;
const lazy = [...main.matchAll(/import\("\.\/(Composer-[\w-]+\.js)"\)/g)].map((match) => match[1]);
if (lazy.length !== 1 || imported.some((file) => file.startsWith('Composer-'))) {
  found.push('dist/main.js: the composer must be one chunk that main.js loads only when it is needed');
}
const composer = lazy.length === 1 ? size(lazy[0]) : 0;
if (composer > COMPOSER_BUDGET) {
  found.push(`dist/${lazy[0]}: ${composer} bytes gzipped, over the composer's budget of ${COMPOSER_BUDGET}`);
}

if (found.length) {
  console.error(`Forbidden patterns:\n${found.join('\n')}`);
  process.exit(1);
}
console.log(`No forbidden patterns. Every opening loads ${gzipped} bytes gzipped (budget ${BUDGET}); the composer ${composer} (budget ${COMPOSER_BUDGET}).`);
