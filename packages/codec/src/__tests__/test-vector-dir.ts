/**
 * Resolve jam-test-vectors submodule path so tests work when run from
 * repo root, packages/, or packages/codec.
 */

import { existsSync } from 'fs'
import { join } from 'path'

const JAM_TEST_VECTORS = join('submodules', 'jam-test-vectors')
const JAM_CONFORMANCE = join('submodules', 'jam-conformance')

function findMonorepoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, JAM_TEST_VECTORS)
    if (existsSync(candidate)) return dir
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

function findMonorepoRootBySubmodule(submoduleDir: string): string {
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, submoduleDir))) return dir
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

/**
 * Get the codec test vectors directory (full or tiny).
 */
export function getCodecTestVectorsDir(subdir: 'full' | 'tiny' = 'full'): string {
  const root = findMonorepoRoot()
  return join(root, JAM_TEST_VECTORS, 'codec', subdir)
}

/**
 * Get a path under the jam-test-vectors submodule (e.g. traces/preimages/foo.json).
 */
export function getJamTestVectorsPath(...pathSegments: string[]): string {
  const root = findMonorepoRoot()
  return join(root, JAM_TEST_VECTORS, ...pathSegments)
}

/**
 * Get the fuzz-proto examples directory (0.7.2/no_forks) for jam-conformance.
 * Used by fuzz-initialize-roundtrip.test.ts.
 */
export function getFuzzProtoExamplesDir(): string {
  const root = findMonorepoRootBySubmodule(JAM_CONFORMANCE)
  return join(root, JAM_CONFORMANCE, 'fuzz-proto', 'examples', '0.7.2', 'no_forks')
}
