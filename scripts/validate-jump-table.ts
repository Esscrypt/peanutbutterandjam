#!/usr/bin/env bun

/**
 * Jump Table Validation Script
 * 
 * Validates jump table entries from decoded program blobs:
 * 1. All entries must be < code.length (valid code addresses)
 * 2. All entries must have bitmask[entry] === 1 (valid opcode positions)
 * 3. All entries should be valid basic block starts (optional check)
 * 
 * Usage:
 *   bun scripts/validate-jump-table.ts <preimage-file>
 *   bun scripts/validate-jump-table.ts <code-blob-file>
 */

import { readFileSync } from 'fs'
import { decodeBlob, decodeProgramFromPreimage } from '../packages/serialization/src/pvm/blob'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    totalEntries: number
    validEntries: number
    invalidEntries: number
    outOfBoundsEntries: number
    invalidOpcodeEntries: number
  }
}

/**
 * Validate jump table entries against code and bitmask
 */
function validateJumpTable(
  jumpTable: bigint[],
  code: Uint8Array,
  bitmask: Uint8Array,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let validEntries = 0
  let invalidEntries = 0
  let outOfBoundsEntries = 0
  let invalidOpcodeEntries = 0

  for (let i = 0; i < jumpTable.length; i++) {
    const entry = jumpTable[i]
    const entryNum = Number(entry)

    // Check 1: Entry must be within code bounds
    if (entry < 0n || entry >= BigInt(code.length)) {
      errors.push(
        `Jump table entry [${i}]: ${entry.toString()} is out of bounds (code length: ${code.length})`,
      )
      outOfBoundsEntries++
      invalidEntries++
      continue
    }

    // Check 2: Entry must be a valid opcode position (bitmask[entry] === 1)
    if (entryNum >= bitmask.length || bitmask[entryNum] === 0) {
      errors.push(
        `Jump table entry [${i}]: ${entry.toString()} is not a valid opcode position (bitmask[${entryNum}] = ${bitmask[entryNum] ?? 'undefined'})`,
      )
      invalidOpcodeEntries++
      invalidEntries++
      continue
    }

    // Check 3: Entry should be a valid basic block start (warning, not error)
    // A valid basic block start is either:
    // - Address 0, OR
    // - Follows a termination instruction
    // This is a warning because it requires parsing the code to determine
    if (entryNum > 0) {
      // Check if this address follows a termination instruction
      // This is a simplified check - full validation requires parsing instructions
      const opcode = code[entryNum]
      // Common termination opcodes: 0x01 (fallthrough), 0x40 (jump), 0x50 (jump_ind), etc.
      // For now, we'll just warn if the opcode looks suspicious
      if (opcode === 0 || opcode === undefined) {
        warnings.push(
          `Jump table entry [${i}]: ${entry.toString()} points to invalid opcode (${opcode})`,
        )
      }
    }

    validEntries++
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalEntries: jumpTable.length,
      validEntries,
      invalidEntries,
      outOfBoundsEntries,
      invalidOpcodeEntries,
    },
  }
}

/**
 * Validate from preimage blob (Y function format)
 */
function validateFromPreimage(preimagePath: string): void {
  console.log(`\n📦 Validating jump table from preimage: ${preimagePath}\n`)

  const preimageBytes = readFileSync(preimagePath)
  const [error, result] = decodeProgramFromPreimage(preimageBytes)

  if (error || !result) {
    console.error('❌ Failed to decode preimage:', error?.message)
    process.exit(1)
  }

  const { code } = result.value

  console.log('⚠️  Note: decodeProgramFromPreimage (Y function format) does not include jump table')
  console.log(`   Code length: ${code.length} bytes`)
  console.log(`   This format is used for standard program initialization`)
  console.log(`   Use decodeBlob format for jump table validation\n`)
}

/**
 * Validate from code blob (deblob function format)
 */
function validateFromBlob(blobPath: string): void {
  console.log(`\n📦 Validating jump table from blob: ${blobPath}\n`)

  const blobBytes = readFileSync(blobPath)
  const [error, result] = decodeBlob(blobBytes)

  if (error || !result) {
    console.error('❌ Failed to decode blob:', error?.message)
    process.exit(1)
  }

  const { code, bitmask, jumpTable } = result.value

  console.log(`Code length: ${code.length} bytes`)
  console.log(`Bitmask length: ${bitmask.length} bytes`)
  console.log(`Jump table entries: ${jumpTable.length}`)
  console.log(`Jump table entry size: ${result.value.elementSize} bytes\n`)

  if (jumpTable.length === 0) {
    console.log('✅ Jump table is empty (no entries to validate)')
    return
  }

  const validation = validateJumpTable(jumpTable, code, bitmask)

  console.log('📊 Validation Results:')
  console.log(`   Total entries: ${validation.stats.totalEntries}`)
  console.log(`   Valid entries: ${validation.stats.validEntries}`)
  console.log(`   Invalid entries: ${validation.stats.invalidEntries}`)
  console.log(`   Out of bounds: ${validation.stats.outOfBoundsEntries}`)
  console.log(`   Invalid opcode positions: ${validation.stats.invalidOpcodeEntries}\n`)

  if (validation.errors.length > 0) {
    console.log('❌ Errors:')
    validation.errors.forEach((error) => {
      console.log(`   - ${error}`)
    })
    console.log()
  }

  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:')
    validation.warnings.forEach((warning) => {
      console.log(`   - ${warning}`)
    })
    console.log()
  }

  if (validation.isValid) {
    console.log('✅ All jump table entries are valid!')
  } else {
    console.log('❌ Jump table validation failed!')
    process.exit(1)
  }
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: bun scripts/validate-jump-table.ts <file-path>')
    console.error('')
    console.error('The script will attempt to decode the file as:')
    console.error('  1. Preimage blob (Y function format) - uses decodeProgramFromPreimage')
    console.error('  2. Code blob (deblob function format) - uses decodeBlob')
    console.error('')
    console.error('Only deblob format contains jump table entries.')
    process.exit(1)
  }

  const filePath = args[0]

  try {
    // Try decodeBlob first (has jump table)
    try {
      validateFromBlob(filePath)
    } catch {
      // If decodeBlob fails, try decodeProgramFromPreimage
      console.log('⚠️  decodeBlob failed, trying decodeProgramFromPreimage...\n')
      validateFromPreimage(filePath)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()

