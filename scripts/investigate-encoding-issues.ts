/**
 * Investigate Encoding Issues Script
 *
 * Compares raw test vector values with re-encoded values to identify
 * specific encoding issues in each function.
 */

import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import type { Hex } from '@pbnj/core'
import { bytesToHex, hexToBytes } from '@pbnj/core'
import type { BlockTraceTestVector } from '@pbnj/types'
import { ConfigService } from '../infra/node/services/config-service'
import {
  decodeAccumulated,
  encodeAccumulated,
} from '../packages/serialization/src/state/accumulated'
import {
  decodeActivity,
  encodeActivity,
} from '../packages/serialization/src/state/activity'
import {
  decodeAuthpool,
  encodeAuthpool,
} from '../packages/serialization/src/state/authpool'
import {
  decodeAuthqueue,
  encodeAuthqueue,
} from '../packages/serialization/src/state/authqueue'
import {
  decodeDisputeState,
  encodeDisputeState,
} from '../packages/serialization/src/state/disputes'
import {
  decodeEntropy,
  encodeEntropy,
} from '../packages/serialization/src/state/entropy'
import {
  decodeLastAccumulationOutputs,
  encodeLastAccumulationOutputs,
} from '../packages/serialization/src/state/last-accumulation-outputs'
import {
  decodePrivileges,
  encodePrivileges,
} from '../packages/serialization/src/state/privileges'
import {
  decodeReady,
  encodeReady,
} from '../packages/serialization/src/state/ready'
import {
  decodeRecent,
  encodeRecent,
} from '../packages/serialization/src/state/recent'
import {
  decodeStateWorkReports,
  encodeStateWorkReports,
} from '../packages/serialization/src/state/reports'
import {
  decodeSafrole,
  encodeSafrole,
} from '../packages/serialization/src/state/safrole'
import {
  decodeTheTime,
  encodeTheTime,
} from '../packages/serialization/src/state/the-time'
import {
  decodeValidatorSet,
  encodeValidatorSet,
} from '../packages/serialization/src/state/validator-set'

const WORKSPACE_ROOT = path.join(__dirname, '../')

function compareBytes(
  raw: Uint8Array,
  generated: Uint8Array,
  maxDiff = 10,
): void {
  const minLength = Math.min(raw.length, generated.length)

  console.log(`  Length: raw=${raw.length}, generated=${generated.length}`)

  if (raw.length !== generated.length) {
    console.log(
      `  ⚠️  Length mismatch: ${Math.abs(raw.length - generated.length)} bytes`,
    )
  }

  let diffCount = 0
  for (let i = 0; i < minLength && diffCount < maxDiff; i++) {
    if (raw[i] !== generated[i]) {
      console.log(
        `  ❌ Byte ${i}: raw=0x${raw[i].toString(16).padStart(2, '0')}, generated=0x${generated[i].toString(16).padStart(2, '0')}`,
      )
      diffCount++
    }
  }

  if (diffCount >= maxDiff) {
    console.log(`  ... (showing first ${maxDiff} differences)`)
  } else if (diffCount === 0) {
    if (raw.length === generated.length) {
      console.log(`  ✅ Bytes match exactly`)
    } else {
      // Check if the extra bytes are all zeros (padding)
      const extraBytes =
        raw.length > generated.length
          ? raw.slice(generated.length)
          : generated.slice(raw.length)
      const allZeros = extraBytes.every((b) => b === 0)
      if (allZeros) {
        console.log(
          `  ✅ First ${minLength} bytes match exactly (${Math.abs(raw.length - generated.length)} bytes of padding in raw)`,
        )
      } else {
        console.log(`  ✅ First ${minLength} bytes match exactly`)
      }
    }
  }
}

function main() {
  try {
    console.log('🔍 Encoding Issues Investigation')
    console.log('=====================================\n')

    const configService = new ConfigService('tiny')

    // Load test vector
    const blockJsonPath = path.join(
      WORKSPACE_ROOT,
      'submodules/jam-test-vectors/traces/fallback/00000001.json',
    )
    const blockJsonData: BlockTraceTestVector = JSON.parse(
      readFileSync(blockJsonPath, 'utf-8'),
    )

    const rawKeyvals = blockJsonData.pre_state?.keyvals || []

    // Create maps for lookup
    const rawKeyvalsMap = new Map<string, Hex>()
    for (const kv of rawKeyvals) {
      const normalizedKey = kv.key.startsWith('0x') ? kv.key : `0x${kv.key}`
      rawKeyvalsMap.set(normalizedKey, kv.value)
    }

    // 1. Authpool (Chapter 1)
    console.log('📚 Chapter 1 - Authpool (α)')
    console.log('─'.repeat(50))
    const authpoolKey =
      '0x01000000000000000000000000000000000000000000000000000000000000'
    const rawAuthpool = rawKeyvalsMap.get(authpoolKey)
    if (rawAuthpool) {
      const rawBytes = hexToBytes(rawAuthpool)
      const [decodeError, decoded] = decodeAuthpool(rawBytes, configService)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeAuthpool(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded authpool')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 2. Authqueue (Chapter 2)
    console.log('📚 Chapter 2 - Authqueue (χ)')
    console.log('─'.repeat(50))
    const authqueueKey =
      '0x02000000000000000000000000000000000000000000000000000000000000'
    const rawAuthqueue = rawKeyvalsMap.get(authqueueKey)
    if (rawAuthqueue) {
      const rawBytes = hexToBytes(rawAuthqueue)
      const [decodeError, decoded] = decodeAuthqueue(rawBytes, configService)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeAuthqueue(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded authqueue')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 3. Recent (Chapter 3)
    console.log('📚 Chapter 3 - Recent (β)')
    console.log('─'.repeat(50))
    const recentKey =
      '0x03000000000000000000000000000000000000000000000000000000000000'
    const rawRecent = rawKeyvalsMap.get(recentKey)
    if (rawRecent) {
      const rawBytes = hexToBytes(rawRecent)
      const [decodeError, decoded] = decodeRecent(rawBytes)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeRecent(decoded.value)
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded recent')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 4. Safrole (Chapter 4)
    console.log('📚 Chapter 4 - Safrole (γ)')
    console.log('─'.repeat(50))
    const safroleKey =
      '0x04000000000000000000000000000000000000000000000000000000000000'
    const rawSafrole = rawKeyvalsMap.get(safroleKey)
    if (rawSafrole) {
      const rawBytes = hexToBytes(rawSafrole)
      const [decodeError, decoded] = decodeSafrole(rawBytes, configService)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeSafrole(decoded.value)
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded safrole')
          compareBytes(rawBytes, encoded, 5) // Show first 5 differences
          // Show bytes around the first difference (byte 2016)
          if (rawBytes.length > 2016 && encoded.length > 2016) {
            console.log('  Bytes around position 2016:')
            for (
              let i = 2010;
              i < Math.min(2020, Math.min(rawBytes.length, encoded.length));
              i++
            ) {
              if (rawBytes[i] !== encoded[i]) {
                console.log(
                  `    Byte ${i}: raw=0x${rawBytes[i].toString(16).padStart(2, '0')}, generated=0x${encoded[i].toString(16).padStart(2, '0')} ⚠️`,
                )
              } else {
                console.log(
                  `    Byte ${i}: 0x${rawBytes[i].toString(16).padStart(2, '0')}`,
                )
              }
            }
          }
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 5. Disputes (Chapter 5)
    console.log('📚 Chapter 5 - Disputes (ψ)')
    console.log('─'.repeat(50))
    const disputesKey =
      '0x05000000000000000000000000000000000000000000000000000000000000'
    const rawDisputes = rawKeyvalsMap.get(disputesKey)
    if (rawDisputes) {
      const rawBytes = hexToBytes(rawDisputes)
      const [decodeError, decoded] = decodeDisputeState(rawBytes)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeDisputeState(decoded.value)
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded disputes')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 6. Entropy (Chapter 6)
    console.log('📚 Chapter 6 - Entropy (ε)')
    console.log('─'.repeat(50))
    const entropyKey =
      '0x06000000000000000000000000000000000000000000000000000000000000'
    const rawEntropy = rawKeyvalsMap.get(entropyKey)
    if (rawEntropy) {
      const rawBytes = hexToBytes(rawEntropy)
      const [decodeError, decoded] = decodeEntropy(rawBytes)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeEntropy(decoded.value)
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded entropy')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 7. Stagingset (Chapter 7)
    console.log('📚 Chapter 7 - Stagingset (ι)')
    console.log('─'.repeat(50))
    const stagingsetKey =
      '0x07000000000000000000000000000000000000000000000000000000000000'
    const rawStagingset = rawKeyvalsMap.get(stagingsetKey)
    if (rawStagingset) {
      const rawBytes = hexToBytes(rawStagingset)
      const [decodeError, decoded] = decodeValidatorSet(rawBytes, configService)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeValidatorSet(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded stagingset')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 8. Activeset (Chapter 8)
    console.log('📚 Chapter 8 - Activeset (κ)')
    console.log('─'.repeat(50))
    const activesetKey =
      '0x08000000000000000000000000000000000000000000000000000000000000'
    const rawActiveset = rawKeyvalsMap.get(activesetKey)
    if (rawActiveset) {
      const rawBytes = hexToBytes(rawActiveset)
      const [decodeError, decoded] = decodeValidatorSet(rawBytes, configService)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeValidatorSet(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded activeset')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 9. Previousset (Chapter 9)
    console.log('📚 Chapter 9 - Previousset (λ)')
    console.log('─'.repeat(50))
    const previoussetKey =
      '0x09000000000000000000000000000000000000000000000000000000000000'
    const rawPreviousset = rawKeyvalsMap.get(previoussetKey)
    if (rawPreviousset) {
      const rawBytes = hexToBytes(rawPreviousset)
      const [decodeError, decoded] = decodeValidatorSet(rawBytes, configService)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeValidatorSet(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded previousset')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 10. Reports (Chapter 10)
    console.log('📚 Chapter 10 - Reports (ρ)')
    console.log('─'.repeat(50))
    const reportsKey =
      '0x0a000000000000000000000000000000000000000000000000000000000000'
    const rawReports = rawKeyvalsMap.get(reportsKey)
    if (rawReports) {
      const rawBytes = hexToBytes(rawReports)
      const [decodeError, decoded] = decodeStateWorkReports(
        rawBytes,
        configService,
      )
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeStateWorkReports(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded reports')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 11. Thetime (Chapter 11)
    console.log('📚 Chapter 11 - Thetime (τ)')
    console.log('─'.repeat(50))
    const thetimeKey =
      '0x0b000000000000000000000000000000000000000000000000000000000000'
    const rawThetime = rawKeyvalsMap.get(thetimeKey)
    if (rawThetime) {
      const rawBytes = hexToBytes(rawThetime)
      const [decodeError, decoded] = decodeTheTime(rawBytes)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeTheTime(decoded.value)
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded thetime')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 12. Privileges (Chapter 12)
    console.log('📚 Chapter 12 - Privileges')
    console.log('─'.repeat(50))
    const privilegesKey =
      '0x0c000000000000000000000000000000000000000000000000000000000000'
    const rawPrivileges = rawKeyvalsMap.get(privilegesKey)
    if (rawPrivileges) {
      const rawBytes = hexToBytes(rawPrivileges)
      const [decodeError, decoded] = decodePrivileges(rawBytes, configService)
      if (!decodeError && decoded) {
        console.log('  Decoded privileges:', {
          manager: decoded.value.manager.toString(),
          delegator: decoded.value.delegator.toString(),
          registrar: decoded.value.registrar.toString(),
          assigners: decoded.value.assigners.map((a) => a.toString()),
          alwaysaccersSize: decoded.value.alwaysaccers.size,
        })
        const [encodeError, encoded] = encodePrivileges(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Re-encoded privileges')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 13. Activity (Chapter 13)
    console.log('📚 Chapter 13 - Activity (π)')
    console.log('─'.repeat(50))
    const activityKey =
      '0x0d000000000000000000000000000000000000000000000000000000000000'
    const rawActivity = rawKeyvalsMap.get(activityKey)
    if (rawActivity) {
      const rawBytes = hexToBytes(rawActivity)
      console.log(`  Raw activity length: ${rawBytes.length} bytes`)
      console.log(`  First 20 bytes: ${bytesToHex(rawBytes.slice(0, 20))}`)

      const [decodeError, decoded] = decodeActivity(rawBytes, configService)
      if (!decodeError && decoded) {
        console.log('  Decoded activity:', {
          validatorStatsAccumulatorLength:
            decoded.value.validatorStatsAccumulator.length,
          validatorStatsPreviousLength:
            decoded.value.validatorStatsPrevious.length,
          coreStatsLength: decoded.value.coreStats.length,
          serviceStatsSize: decoded.value.serviceStats.size,
        })
        const [encodeError, encoded] = encodeActivity(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Re-encoded activity')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
        // Try to decode just the first few bytes to understand the structure
        if (rawBytes.length >= 4) {
          console.log(
            `  First 4 bytes as uint32: ${new DataView(rawBytes.buffer, rawBytes.byteOffset, 4).getUint32(0, true)}`,
          )
        }
      }
    }
    console.log()

    // 14. Ready (Chapter 14)
    console.log('📚 Chapter 14 - Ready (ω)')
    console.log('─'.repeat(50))
    const readyKey =
      '0x0e000000000000000000000000000000000000000000000000000000000000'
    const rawReady = rawKeyvalsMap.get(readyKey)
    if (rawReady) {
      const rawBytes = hexToBytes(rawReady)
      const [decodeError, decoded] = decodeReady(rawBytes, configService)
      if (!decodeError && decoded) {
        const [encodeError, encoded] = encodeReady(decoded.value, configService)
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded ready')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 15. Accumulated (Chapter 15)
    console.log('📚 Chapter 15 - Accumulated (ξ)')
    console.log('─'.repeat(50))
    const accumulatedKey =
      '0x0f000000000000000000000000000000000000000000000000000000000000'
    const rawAccumulated = rawKeyvalsMap.get(accumulatedKey)
    if (rawAccumulated) {
      const rawBytes = hexToBytes(rawAccumulated)
      console.log(`  Raw accumulated length: ${rawBytes.length} bytes`)
      console.log(`  First 20 bytes: ${bytesToHex(rawBytes.slice(0, 20))}`)

      const [decodeError, decoded] = decodeAccumulated(rawBytes, configService)
      if (!decodeError && decoded) {
        console.log('  Decoded accumulated:', {
          itemsLength: decoded.value.length,
          items: decoded.value.map((item) => ({
            dataLength: item.data.length,
            firstBytes: bytesToHex(item.data.slice(0, 10)),
          })),
        })
        const [encodeError, encoded] = encodeAccumulated(
          decoded.value,
          configService,
        )
        if (!encodeError && encoded) {
          console.log('  Re-encoded accumulated')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    // 16. Lastaccout (Chapter 16)
    console.log('📚 Chapter 16 - Lastaccout (θ)')
    console.log('─'.repeat(50))
    const lastaccoutKey =
      '0x10000000000000000000000000000000000000000000000000000000000000'
    const rawLastaccout = rawKeyvalsMap.get(lastaccoutKey)
    if (rawLastaccout) {
      const rawBytes = hexToBytes(rawLastaccout)
      const [decodeError, decoded] = decodeLastAccumulationOutputs(rawBytes)
      if (!decodeError && decoded) {
        // Convert array to Map for encoding
        const lastaccoutMap = new Map<bigint, Hex>()
        for (const item of decoded.value) {
          lastaccoutMap.set(item.serviceId, item.hash)
        }
        const [encodeError, encoded] =
          encodeLastAccumulationOutputs(lastaccoutMap)
        if (!encodeError && encoded) {
          console.log('  Decoded and re-encoded lastaccout')
          compareBytes(rawBytes, encoded)
        } else {
          console.log(`  ❌ Encode error: ${encodeError?.message}`)
        }
      } else {
        console.log(`  ❌ Decode error: ${decodeError?.message}`)
      }
    }
    console.log()

    console.log('=====================================')
    console.log('Investigation Complete')
    console.log('=====================================')
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error),
    )
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

main()
