#!/usr/bin/env bun
/**
 * Decode Service Account Comparison Script
 *
 * Decodes and compares expected vs actual service account encoded data
 * to identify differences in fields, particularly octets.
 *
 * Usage:
 *   bun scripts/decode-service-account.ts <expected_hex> <actual_hex>
 *   bun scripts/decode-service-account.ts "0x00..." "0x00..."
 */

import { decodeServiceAccount } from '@pbnjam/codec'
import type { ServiceAccountCore } from '@pbnjam/types'
import { hexToBytes } from 'viem'

/**
 * Service Account encoding format (Gray Paper merklization.tex):
 * 1. 0 (1 byte discriminator)
 * 2. codehash (32 bytes)
 * 3. encode[8]{balance, minaccgas, minmemogas, octets, gratis} (40 bytes)
 * 4. encode[4]{items, created, lastacc, parent} (16 bytes)
 * Total: 1 + 32 + 40 + 16 = 89 bytes
 */

function decodeServiceAccountFromHex(hex: string): ServiceAccountCore | null {
  try {
    // Ensure hex string has 0x prefix for hexToBytes
    const hexWithPrefix = hex.startsWith('0x') ? hex : `0x${hex}`
    const bytes = hexToBytes(hexWithPrefix as `0x${string}`)
    const [error, result] = decodeServiceAccount(bytes)

    if (error) {
      console.error(`Error decoding service account: ${error.message}`)
      if (error.stack) {
        console.error(`Stack: ${error.stack}`)
      }
      return null
    }

    if (!result) {
      console.error('Error: decodeServiceAccount returned null result')
      return null
    }

    return result.value
  } catch (error) {
    console.error(`Error decoding service account: ${error}`)
    if (error instanceof Error && error.stack) {
      console.error(`Stack: ${error.stack}`)
    }
    return null
  }
}

function formatFieldBigInt(
  name: string,
  expected: bigint,
  actual: bigint,
): string {
  const match = expected === actual ? '✅' : '❌'
  const diff = ` (diff: ${actual - expected})`
  return `${match} ${name.padEnd(15)} Expected: ${expected.toString().padStart(15)} | Actual: ${actual.toString().padStart(15)}${diff}`
}

function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error(
      'Usage: bun scripts/decode-service-account.ts <expected_hex> <actual_hex>',
    )
    console.error('Example:')
    console.error('  bun scripts/decode-service-account.ts "0x00..." "0x00..."')
    process.exit(1)
  }

  const expectedHex = args[0]
  const actualHex = args[1]

  console.log('='.repeat(80))
  console.log('Service Account Decoder - Expected vs Actual Comparison')
  console.log('='.repeat(80))
  console.log()

  const expected = decodeServiceAccountFromHex(expectedHex)
  const actual = decodeServiceAccountFromHex(actualHex)

  if (!expected || !actual) {
    console.error('Failed to decode one or both service accounts')
    process.exit(1)
  }

  console.log('📋 Decoded Service Account Fields:')
  console.log()

  // Core fields
  console.log('Core Fields:')
  console.log(
    expected.codehash === actual.codehash
      ? `✅ codehash        Expected: ${expected.codehash}`
      : `❌ codehash        Expected: ${expected.codehash} | Actual: ${actual.codehash}`,
  )
  console.log()

  // 8-byte fields
  console.log('8-byte Fields (encode[8]):')
  console.log(formatFieldBigInt('balance', expected.balance, actual.balance))
  console.log(
    formatFieldBigInt('minaccgas', expected.minaccgas, actual.minaccgas),
  )
  console.log(
    formatFieldBigInt('minmemogas', expected.minmemogas, actual.minmemogas),
  )
  console.log(formatFieldBigInt('octets', expected.octets, actual.octets))
  console.log(formatFieldBigInt('gratis', expected.gratis, actual.gratis))
  console.log()

  // 4-byte fields (stored as bigint in ServiceAccountCore)
  console.log('4-byte Fields (encode[4]):')
  console.log(formatFieldBigInt('items', expected.items, actual.items))
  console.log(formatFieldBigInt('created', expected.created, actual.created))
  console.log(formatFieldBigInt('lastacc', expected.lastacc, actual.lastacc))
  console.log(formatFieldBigInt('parent', expected.parent, actual.parent))
  console.log()

  // Summary
  const differences: string[] = []
  if (expected.codehash !== actual.codehash) differences.push('codehash')
  if (expected.balance !== actual.balance) differences.push('balance')
  if (expected.minaccgas !== actual.minaccgas) differences.push('minaccgas')
  if (expected.minmemogas !== actual.minmemogas) differences.push('minmemogas')
  if (expected.octets !== actual.octets) differences.push('octets')
  if (expected.gratis !== actual.gratis) differences.push('gratis')
  if (expected.items !== actual.items) differences.push('items')
  if (expected.created !== actual.created) differences.push('created')
  if (expected.lastacc !== actual.lastacc) differences.push('lastacc')
  if (expected.parent !== actual.parent) differences.push('parent')

  console.log('='.repeat(80))
  if (differences.length === 0) {
    console.log('✅ All fields match!')
  } else {
    console.log(
      `❌ Found ${differences.length} difference(s): ${differences.join(', ')}`,
    )
    if (differences.includes('octets')) {
      const octetsDiff = actual.octets - expected.octets
      console.log()
      console.log(`⚠️  Octets difference: ${octetsDiff} bytes`)
      console.log(`   Expected octets: ${expected.octets}`)
      console.log(`   Actual octets:   ${actual.octets}`)
    }
  }
  console.log('='.repeat(80))
}

main()
