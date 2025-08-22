#!/usr/bin/env node

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, copyFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔨 Building server...');

const buildConfig = {
  entryPoints: [resolve(__dirname, 'server/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: resolve(__dirname, 'dist'),
  external: [
    'puppeteer',
    'express',
    'firebase-admin',
    'stripe',
    'ws',
    'bufferutil',
    'vite',
    '@vitejs/plugin-react',
    '../vite.config'
  ],
  packages: 'external',
  sourcemap: process.env.NODE_ENV === 'development',
  minify: process.env.NODE_ENV === 'production',
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'production'}"`
  },
  logLevel: 'info'
};

try {
  await build(buildConfig);
  
  // Copy index.html to root of dist for Railway deployment
  const indexHtmlSource = resolve(__dirname, 'dist/public/index.html');
  const indexHtmlDest = resolve(__dirname, 'dist/index.html');
  
  if (existsSync(indexHtmlSource)) {
    copyFileSync(indexHtmlSource, indexHtmlDest);
    console.log('✅ Copied index.html to dist root');
  } else {
    console.warn('⚠️  index.html not found in dist/public/');
  }
  
  console.log('✅ Server build completed successfully');
} catch (error) {
  console.error('❌ Server build failed:', error);
  process.exit(1);
}