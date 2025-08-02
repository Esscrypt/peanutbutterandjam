import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('CLI Build', () => {
  it('should have correct shebang in built index.js', () => {
    const indexPath = join(__dirname, '../dist/index.js')

    if (!existsSync(indexPath)) {
      console.warn('Built index.js not found, skipping test')
      return
    }

    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toMatch(/^#!/)
    expect(content).toContain('#!/usr/bin/env node')
  })

  it('should have package.json with correct bin configuration', () => {
    const packageJsonPath = join(__dirname, '../package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

    expect(packageJson.bin).toBeDefined()
    expect(packageJson.bin.pbnj).toBe('./dist/index.js')
  })

  it('should have pkg configuration for binary builds', () => {
    const packageJsonPath = join(__dirname, '../package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

    expect(packageJson.pkg).toBeDefined()
    expect(packageJson.pkg.targets).toContain('node18-linux-x64')
    expect(packageJson.pkg.targets).toContain('node18-macos-x64')
    expect(packageJson.pkg.targets).toContain('node18-win-x64')
  })
})
