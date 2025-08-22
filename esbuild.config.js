import { build } from 'esbuild';
import { resolve } from 'path';

const config = {
  entryPoints: [resolve('server/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: 'dist',
  external: [
    'puppeteer',
    'express',
    'firebase-admin',
    'stripe',
    'drizzle-orm',
    '@neondatabase/serverless'
  ],
  packages: 'external',
  sourcemap: process.env.NODE_ENV === 'development',
  minify: process.env.NODE_ENV === 'production',
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'production'}"`
  },
  logLevel: 'info'
};

export default config;

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  build(config).catch(() => process.exit(1));
}