import * as esbuild from 'esbuild'
import { readFileSync, watch } from 'node:fs'

const isWatch = process.argv.includes('--watch')

/** @type {esbuild.BuildOptions} */
const opts = {
  entryPoints: ['src/index.ts', 'src/cli.ts', 'src/globals.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outdir: 'dist',
  external: [
    'zx',
    '@earendil-works/pi-ai',
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-agent-core',
    '@earendil-works/pi-tui',
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
