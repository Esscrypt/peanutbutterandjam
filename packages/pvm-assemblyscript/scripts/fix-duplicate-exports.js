#!/usr/bin/env node
/**
 * Post-processing script to remove duplicate exports from AssemblyScript-generated JavaScript files.
 *
 * AssemblyScript generates multiple overloaded generic functions with the same name,
 * which causes TypeScript errors when exported. This script removes the duplicate
 * export entries, keeping only one of each function name.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Allow specifying target directory via --target flag, otherwise use build/
const targetIndex = process.argv.indexOf('--target')
const BUILD_DIR =
  targetIndex !== -1 && process.argv[targetIndex + 1]
    ? process.argv[targetIndex + 1]
    : join(process.cwd(), 'build')

function fixDuplicateExports(filePath) {
  const content = readFileSync(filePath, 'utf-8')

  // Pattern to match duplicate exports in the export object
  // Matches: decodeVariableSequence,\n  decodeVariableSequence,\n  decodeVariableSequence,\n  decodeVariableSequence,
  const patterns = [
    // Fix decodeVariableSequence duplicates (4 instances)
    /(\s+decodeVariableSequence,\n)(\s+decodeVariableSequence,\n)(\s+decodeVariableSequence,\n)(\s+decodeVariableSequence,\n)/g,
    // Fix encodeVariableSequenceGeneric duplicates (4 instances)
    /(\s+encodeVariableSequenceGeneric,\n)(\s+encodeVariableSequenceGeneric,\n)(\s+encodeVariableSequenceGeneric,\n)(\s+encodeVariableSequenceGeneric,\n)/g,
  ]

  let fixed = content
  let changed = false

  for (const pattern of patterns) {
    if (pattern.test(fixed)) {
      // Replace 4 duplicates with 1
      fixed = fixed.replace(pattern, '$1')
      changed = true
    }
  }

  if (changed) {
    writeFileSync(filePath, fixed, 'utf-8')
    console.log(`Fixed duplicate exports in ${filePath}`)
    return true
  }

  return false
}

function main() {
  const files = ['debug.js', 'pvm.js']
  let anyChanged = false

  for (const file of files) {
    const filePath = join(BUILD_DIR, file)
    try {
      if (fixDuplicateExports(filePath)) {
        anyChanged = true
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`Warning: ${filePath} not found, skipping`)
      } else {
        throw error
      }
    }
  }

  if (anyChanged) {
    console.log('Duplicate exports fixed successfully')
  } else {
    console.log('No duplicate exports found')
  }
}

main()
