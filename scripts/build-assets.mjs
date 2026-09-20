import { build } from 'esbuild';

await build({
  entryPoints: { site: './src/site.ts', dev: './src/dev/main.ts' },
  outdir: 'assets',
  entryNames: '[name]',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});
