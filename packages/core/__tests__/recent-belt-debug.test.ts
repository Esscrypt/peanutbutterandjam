/**
 * Recent History Belt Debug Test
 *
 * Parses and compares the expected vs actual recent history encoding
 * to identify the exact difference causing the Block 50 mismatch.
 */

import { describe, expect, it } from 'vitest'
import { hexToBytes, bytesToHex } from '../src/utils/crypto'
import { mmrappend, mmrsuperpeak, merklizewb, defaultKeccakHash } from '../src/merklization'

// Test vector value (what jamduna expects) - from the test output "Received"
const EXPECTED_HEX = '0x08e55a9d464759c4be4b312b2f12ebd788e9307ca4ca890d278ec2457515ca83633faf381b55ff77a1bd5538c44475a78593f0835a9bf50b42e996feecbdae25caa8d930ccf137aed4bfe1e62fd880f33a8c351ccc7f145eb1a7394559a9f4e17d005ee547d962a64803dad5d000712ea9b54f671be93bf68ff4091000dde5b8d3a31e918ce5698f7e70fe1e9da89fcab3c6222b55fb9718340add716b9e62e8c5fedae10311a850045ffd2ffd01935f2e01197852f2221f439930adca4ff7d2b1d702946e58583ed136da85bc6be38a1dc7461ac7da04518642176c3b115ce2c0db860000000000000000000000000000000000000000000000000000000000000000bb2cc0b093e7a73f7c848819297cbd6b5daf7cbb0e0c0971e6d622375c6078040000000000000000000000000000000000000000000000000000000000000000619bb5ac01324126e92e6a5b6a6021822b136ccf2c2c1d2d91b79b64d3908972839601ef1058731fc4dc24aff99f2c2b84229d9e8af1e980d5571251c935d598d8afa00448f7da90c39c86205260df2398a0fd239e432ca6db3f18a0257a538f012b85f006e2851c7848a449b1c34f8175bd72e99a35774fb8537edeef23cf067c00000000000000000000000000000000000000000000000000000000000000001c397edfba4a028f1e05a246a1c675893d8317a4b0c81ab142385072401d536cee2e2b1e5afbf05a2d1f6665b1b4b30d3e264157e103ceff444f9ac0dd3c7536742b166600e82424817fab2093c6e21782ef75605970af2a96ff8acbbed2be08002436637cdbde60c9c78545393360ffaee282cb234b95f542ec0ad0513939882c4a05f2ee489798bcb4a3689c325b10c2d234d1fadf213681c17d69a382f100dd4f8b889d642d47cab1b27cb1e8d80bdd4a8f28e1b10f958f0ccb8648d31b61f1013a8477ee919a14f9f736050d1f3714ebdd56ee6d59b55c2fd969f7ad69876e4e0000000000000000000000000000000000000000000000000000000000000000aec31c0d4bafa2b16c498fab658792e0f05e7a4f023eafa989b0718bdf2f72195e266af20004bd78049e19d033c0351da44b29f1adea721238364dfc226b8adab95ee210e153d6a0bba6c9d6fc1fe59af1f4732ae7379b406c18f23d4198461601095e54a1242a3a1be88b5afc40ce9d1e90a97186380b5e2a01930cd460daff570000000000000000000000000000000000000000000000000000000000000000b41492fb481de199738e34f5ae37c6c841f70b87be069d3c99ae6bf336d82f359ed12dbad021c76c6a3731b29321d51383e85e43fb6120db41b673a18c5fff57018f251f7044ff04df859cd28de2f455aa7d21e70ac67fb04dfb8afcef03b8a401fb6505f807baa1c65a4f8651978791af0a215d7f6f54416abbb34ae05f1b67020000000000000000000000000000000000000000000000000000000000000000a6334dc2c1063f2d92f466035fb19cba386542cbeb0fd2199104de28594da16f1f2c85e1de3a9f603e8339b0a121ef69978b41c0a380fab215514049c3da2bc300000000000000000000000000000000000000000000000000000000000000000220db118fbf0fda25345ef32b77180f5ee602ad6ec9996f891fe2cb5cceffcc6f000000000000000000000000000000000000000000000000000000000000000089625c24f93304e955dc449c1d36bf8ca1d131730892fe47bc0511ab991fd6c8000000000000000000000000000000000000000000000000000000000000000006000147c9d078140731056a722439695d316232cb4d13dafe5b5d1a18c8ed11bad428000001a8406e3cadf221a11e89b8f8697d07f3067cc362b851dfe5e30d08f3f17f045b0167fe4c0e9bcd17f84ec8ba8b8b784f478e55a430f73fa96e092a9bdacbab6a3a'

// Our code's value - from the test output "Expected" (but Jest labels it confusingly)
const ACTUAL_HEX = '0x08e55a9d464759c4be4b312b2f12ebd788e9307ca4ca890d278ec2457515ca83633faf381b55ff77a1bd5538c44475a78593f0835a9bf50b42e996feecbdae25caa8d930ccf137aed4bfe1e62fd880f33a8c351ccc7f145eb1a7394559a9f4e17d005ee547d962a64803dad5d000712ea9b54f671be93bf68ff4091000dde5b8d3a31e918ce5698f7e70fe1e9da89fcab3c6222b55fb9718340add716b9e62e8c5fedae10311a850045ffd2ffd01935f2e01197852f2221f439930adca4ff7d2b1d702946e58583ed136da85bc6be38a1dc7461ac7da04518642176c3b115ce2c0db860000000000000000000000000000000000000000000000000000000000000000bb2cc0b093e7a73f7c848819297cbd6b5daf7cbb0e0c0971e6d622375c6078040000000000000000000000000000000000000000000000000000000000000000619bb5ac01324126e92e6a5b6a6021822b136ccf2c2c1d2d91b79b64d3908972839601ef1058731fc4dc24aff99f2c2b84229d9e8af1e980d5571251c935d598d8afa00448f7da90c39c86205260df2398a0fd239e432ca6db3f18a0257a538f012b85f006e2851c7848a449b1c34f8175bd72e99a35774fb8537edeef23cf067c00000000000000000000000000000000000000000000000000000000000000001c397edfba4a028f1e05a246a1c675893d8317a4b0c81ab142385072401d536cee2e2b1e5afbf05a2d1f6665b1b4b30d3e264157e103ceff444f9ac0dd3c7536742b166600e82424817fab2093c6e21782ef75605970af2a96ff8acbbed2be08002436637cdbde60c9c78545393360ffaee282cb234b95f542ec0ad0513939882c4a05f2ee489798bcb4a3689c325b10c2d234d1fadf213681c17d69a382f100dd4f8b889d642d47cab1b27cb1e8d80bdd4a8f28e1b10f958f0ccb8648d31b61f1013a8477ee919a14f9f736050d1f3714ebdd56ee6d59b55c2fd969f7ad69876e4e0000000000000000000000000000000000000000000000000000000000000000aec31c0d4bafa2b16c498fab658792e0f05e7a4f023eafa989b0718bdf2f72195e266af20004bd78049e19d033c0351da44b29f1adea721238364dfc226b8adab95ee210e153d6a0bba6c9d6fc1fe59af1f4732ae7379b406c18f23d4198461601095e54a1242a3a1be88b5afc40ce9d1e90a97186380b5e2a01930cd460daff570000000000000000000000000000000000000000000000000000000000000000b41492fb481de199738e34f5ae37c6c841f70b87be069d3c99ae6bf336d82f359ed12dbad021c76c6a3731b29321d51383e85e43fb6120db41b673a18c5fff57018f251f7044ff04df859cd28de2f455aa7d21e70ac67fb04dfb8afcef03b8a401fb6505f807baa1c65a4f8651978791af0a215d7f6f54416abbb34ae05f1b67020000000000000000000000000000000000000000000000000000000000000000a6334dc2c1063f2d92f466035fb19cba386542cbeb0fd2199104de28594da16fef021eab5c1155a91866721f11a0d23a75dc4e977107f885b92f8a695c30a8d200000000000000000000000000000000000000000000000000000000000000000220db118fbf0fda25345ef32b77180f5ee602ad6ec9996f891fe2cb5cceffcc6f000000000000000000000000000000000000000000000000000000000000000089625c24f93304e955dc449c1d36bf8ca1d131730892fe47bc0511ab991fd6c80000000000000000000000000000000000000000000000000000000000000000060001ad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5000001a8406e3cadf221a11e89b8f8697d07f3067cc362b851dfe5e30d08f3f17f045b0167fe4c0e9bcd17f84ec8ba8b8b784f478e55a430f73fa96e092a9bdacbab6a3a'

interface ParsedHistoryEntry {
  headerHash: string
  accoutLogSuperPeak: string
  stateRoot: string
  reportedPackageHashesCount: number
}

interface ParsedBelt {
  totalCount: number
  peaks: (string | null)[]
}

interface ParsedRecent {
  historyCount: number
  history: ParsedHistoryEntry[]
  belt: ParsedBelt
}

function parseRecentHex(hex: string): ParsedRecent {
  const bytes = hexToBytes(hex as `0x${string}`)
  let offset = 0

  // First byte is history count
  const historyCount = bytes[offset++]

  const history: ParsedHistoryEntry[] = []
  for (let i = 0; i < historyCount; i++) {
    // Each entry is: headerHash (32) + accoutLogSuperPeak (32) + stateRoot (32) + reportedPackageHashes (variable)
    const headerHash = '0x' + bytesToHex(bytes.slice(offset, offset + 32)).slice(2)
    offset += 32
    const accoutLogSuperPeak = '0x' + bytesToHex(bytes.slice(offset, offset + 32)).slice(2)
    offset += 32
    const stateRoot = '0x' + bytesToHex(bytes.slice(offset, offset + 32)).slice(2)
    offset += 32

    // reportedPackageHashes - for simplicity, assume 0 for now (00 00)
    // First byte is number of entries
    const reportedPackageHashesCount = bytes[offset++]
    // Skip the actual hashes if any
    offset += reportedPackageHashesCount * 64 // Each entry is hash + hash

    history.push({ headerHash, accoutLogSuperPeak, stateRoot, reportedPackageHashesCount })
  }

  // Parse belt
  const totalCount = bytes[offset++]
  const peaks: (string | null)[] = []
  for (let i = 0; i < totalCount; i++) {
    const isPresent = bytes[offset++]
    if (isPresent === 0x01) {
      const peakHash = '0x' + bytesToHex(bytes.slice(offset, offset + 32)).slice(2)
      offset += 32
      peaks.push(peakHash)
    } else {
      peaks.push(null)
    }
  }

  return { historyCount, history, belt: { totalCount, peaks } }
}

describe('Recent History Belt Debug', () => {
  it('should identify differences between expected and actual recent encoding', () => {
    const expected = parseRecentHex(EXPECTED_HEX)
    const actual = parseRecentHex(ACTUAL_HEX)

    console.log('\n=== EXPECTED (test vector) ===')
    console.log('History count:', expected.historyCount)
    console.log('Belt total count:', expected.belt.totalCount)
    console.log('Belt peaks:')
    expected.belt.peaks.forEach((peak, i) => {
      console.log(`  [${i}]: ${peak ?? 'null'}`)
    })
    console.log('\nLast history entry accoutLogSuperPeak:', expected.history[expected.historyCount - 1]?.accoutLogSuperPeak)

    console.log('\n=== ACTUAL (our code) ===')
    console.log('History count:', actual.historyCount)
    console.log('Belt total count:', actual.belt.totalCount)
    console.log('Belt peaks:')
    actual.belt.peaks.forEach((peak, i) => {
      console.log(`  [${i}]: ${peak ?? 'null'}`)
    })
    console.log('\nLast history entry accoutLogSuperPeak:', actual.history[actual.historyCount - 1]?.accoutLogSuperPeak)

    console.log('\n=== DIFFERENCES ===')
    
    // Compare history entries
    for (let i = 0; i < Math.max(expected.historyCount, actual.historyCount); i++) {
      const exp = expected.history[i]
      const act = actual.history[i]
      if (exp?.accoutLogSuperPeak !== act?.accoutLogSuperPeak) {
        console.log(`History[${i}] accoutLogSuperPeak differs:`)
        console.log(`  Expected: ${exp?.accoutLogSuperPeak}`)
        console.log(`  Actual:   ${act?.accoutLogSuperPeak}`)
      }
    }

    // Compare belt peaks
    for (let i = 0; i < Math.max(expected.belt.totalCount, actual.belt.totalCount); i++) {
      if (expected.belt.peaks[i] !== actual.belt.peaks[i]) {
        console.log(`Belt peak[${i}] differs:`)
        console.log(`  Expected: ${expected.belt.peaks[i]}`)
        console.log(`  Actual:   ${actual.belt.peaks[i]}`)
      }
    }

    // Just print diff, don't fail for now
    expect(true).toBe(true)
  })

  it('should verify keccak(64 zeros) equals 0xad3228b...', () => {
    const zeros64 = new Uint8Array(64)
    const [error, result] = defaultKeccakHash(zeros64)
    expect(error).toBeNull()
    console.log('keccak(64 zeros):', bytesToHex(result!))
    expect(bytesToHex(result!)).toBe('0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5')
  })

  it('should test MMR append with known values', () => {
    // The test shows peak[1] is wrong. Let's see what happens if we append some values.
    // Peak[1] should be H(block49_output || block50_output) for 50 blocks
    
    // Start with empty MMR
    let mmrPeaks: (Uint8Array | null)[] = []
    
    // Simulate 50 blocks with some having outputs, some not
    // For simplicity, let's test with all zeros (empty accumulation outputs)
    const zerohash = new Uint8Array(32) // merklizewb([]) = zerohash
    
    for (let block = 1; block <= 50; block++) {
      const [error, newPeaks] = mmrappend(mmrPeaks, zerohash, defaultKeccakHash)
      expect(error).toBeNull()
      mmrPeaks = newPeaks!
    }

    console.log('\n=== MMR after 50 appends of zerohash ===')
    console.log('Peak count:', mmrPeaks.length)
    mmrPeaks.forEach((peak, i) => {
      console.log(`  [${i}]: ${peak ? bytesToHex(peak) : 'null'}`)
    })

    // Calculate super-peak
    const [spError, superPeak] = mmrsuperpeak(mmrPeaks, defaultKeccakHash)
    expect(spError).toBeNull()
    console.log('Super-peak:', bytesToHex(superPeak!))
  })

  it('should compare what merklizewb returns for empty sequence', () => {
    const [error, result] = merklizewb([], defaultKeccakHash)
    expect(error).toBeNull()
    console.log('merklizewb([]) with keccak:', bytesToHex(result!))
    expect(bytesToHex(result!)).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
  })
})

