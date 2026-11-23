import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

/** Sets each file's ?v= in index.html to its hash: browsers fetch a changed one. */
async function versionAssets() {
  const hash = (file: string) =>
    createHash('sha256')
      .update(readFileSync(`dist/${file}`))
      .digest('hex')
      .slice(0, 8);
  const html = readFileSync('index.html', 'utf8');
  writeFileSync(
    'index.html',
    html.replace(
      /dist\/([\w.]+)\?v=[^"]*/g,
      (_: string, file: string) => `dist/${file}?v=${hash(file)}`,
    ),
  );
}

export default defineConfig((options) => {
  const nodeEnv = options.watch ? 'development' : 'production';
  return {
    entry: ['src/main.tsx'],
    // Modules, so that the composer and its editor library load only where a
    // value composes (a template), as their own chunk.
    format: ['esm'],
    splitting: true,
    outExtension: () => ({ js: '.js' }),
    // Everything in the bundle: the browser loads no package by name.
    noExternal: [/./],
    clean: true,
    minify: !options.watch,
    sourcemap: !!options.watch,
    env: { NODE_ENV: nodeEnv },
    onSuccess: versionAssets,
    // The browser builds of the composer's editor library, its production
    // one when not watching: never the development build beside it.
    platform: 'browser',
    esbuildOptions(esbuild) {
      esbuild.conditions = [nodeEnv];
    },
    // CJS deps (react-dom) reference `process` at runtime.
    banner: {
      js: `var process = { env: { NODE_ENV: ${JSON.stringify(nodeEnv)} } };`,
    },
  };
});
