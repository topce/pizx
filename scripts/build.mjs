import * as esbuild from 'esbuild'

const isWatch = process.argv.includes('--watch')

/** @type {esbuild.BuildOptions} */
const opts = {
  entryPoints: ['src/index.ts', 'src/cli.ts', 'src/globals.ts'],
  bundle: true,
  // Code-split shared modules into dist/chunks so every entry loads ONE copy
  // of the core (PizxError, Schema, …). Without this, dist/index.js and
  // dist/cli.js would each bundle their own class copies and `instanceof`
  // checks across entries — e.g. a plugin that imports { PizxError } from
  // '@topce/pizx' while the CLI catches it — would silently fail.
  splitting: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: 'dist',
  external: [
    'zx',
    '@agentclientprotocol/sdk',
    '@earendil-works/pi-ai',
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-agent-core',
    '@earendil-works/pi-tui',
    '@cordisjs/core',
    'schemastery',
    'cosmokit',
    '@standard-schema/spec',
    // Node built-ins handled automatically by esbuild
  ],
  sourcemap: true,
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  logLevel: 'info',
}

if (isWatch) {
  const ctx = await esbuild.context(opts)
  await ctx.watch()
  console.log('[pizx] watching for changes...')
} else {
  await esbuild.build(opts)
  console.log('[pizx] build complete')
}
