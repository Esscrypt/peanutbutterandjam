#!/usr/bin/env bun
/**
 * Bun Build Script for PVM WASM Wrapper
 * 
 * This script bundles the PVM WASM wrapper into optimized JavaScript
 * that can be used in browsers or other JavaScript environments.
 * 
 * NOTE: This does NOT compile to actual WASM. For true WASM compilation,
 * see WASM-BUILD.md for AssemblyScript or Rust options.
 */

import { build } from 'bun'
import { resolve } from 'path'

console.log('Building PVM WASM Wrapper...')

// Build for Node/Bun environments
await build({
  entrypoints: ['./src/wasm-wrapper.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  splitting: false,
  minify: {
    whitespace: true,
    identifiers: false, // Keep identifiers for debugging
    syntax: true,
  },
  sourcemap: 'external',
  naming: {
    entry: 'pvm-wrapper.js',
  },
})

console.log('✅ Node/Bun build complete: dist/pvm-wrapper.js')

// Build for browser environments (external deps, logger stubbed)
console.log('⚠️  Browser builds skipped (pino logger requires Node.js)')
console.log('   For browser usage, either:')
console.log('   1. Use the Node build with a bundler (webpack/vite) that can polyfill Node modules')
console.log('   2. Create a browser-specific wrapper without @pbnj/core dependency')
console.log('   3. Use a logger polyfill for browsers')

// Note: Browser builds are skipped because pino (logger) uses Node.js builtins
// To enable browser builds:
// 1. Replace @pbnj/core logger with a browser-compatible logger
// 2. Or create a browser-specific version of wasm-wrapper.ts
//
// await build({
//   entrypoints: ['./src/wasm-wrapper.ts'],
//   outdir: './dist/browser',
//   target: 'browser',
//   format: 'esm',
//   external: ['@pbnj/core', '@pbnj/types', '@pbnj/codec'],
// })

console.log('\n📦 Build Summary:')
console.log('  ✅ Node/Bun:   dist/pvm-wrapper.js')
console.log('  ⚠️  Browser:    Skipped (requires Node.js logger polyfill)')
console.log('\n💡 For browser usage:')
console.log('  • Use the Node build with webpack/vite (they can polyfill Node modules)')
console.log('  • Or wait for AssemblyScript/Rust WASM version (see WASM-BUILD.md)')
console.log('\n🔧 For actual WASM compilation, see WASM-BUILD.md')

