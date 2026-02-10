/**
 * Unit test: validateSealSignature with collected state from trace 1768066437_2547 block 76.
 * Reproduces the BadSealSignature failure in isolation by loading block 76's pre_state,
 * initializing services, and calling validateSealSignature directly.
 */

import { describe, it, expect } from 'bun:test'
import * as path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { bytesToHex, hexToBytes } from '@pbnjam/core'
import { decodeStateWorkReports } from '@pbnjam/codec'
import type { Hex } from '@pbnjam/core'
import { validateSealSignature } from '@pbnjam/block-importer'
import { NodeGenesisManager } from '../../services/genesis-manager'
import { ConfigService } from '../../services/config-service'
import { convertJsonBlockToBlock, initializeServices } from '../test-utils'

const WORKSPACE_ROOT = path.join(__dirname, '../../../../')
const JAM_CONFORMANCE_VERSION = process.env.JAM_CONFORMANCE_VERSION || '0.7.2'
const TRACE_ID = '1768066437_2547'
const BLOCK_NUM = 76

const TRACES_DIR = path.join(
  WORKSPACE_ROOT,
  'submodules/w3f-jam-conformance/fuzz-reports',
  JAM_CONFORMANCE_VERSION,
  'traces',
)
const TRACE_DIR = path.join(TRACES_DIR, TRACE_ID)
const BLOCK_76_PATH = path.join(TRACE_DIR, '00000076.json')

describe('validateSealSignature with block 76 state (trace 1768066437_2547)', () => {
  it('runs validateSealSignature using pre_state from block 76', async () => {
    if (!existsSync(BLOCK_76_PATH)) {
      console.warn(`Trace file not found: ${BLOCK_76_PATH}`)
      return
    }

    const configService = new ConfigService('tiny')
    const genesisJsonPath = path.join(TRACE_DIR, 'genesis.json')
    const parentGenesisPath = path.join(TRACES_DIR, 'genesis.json')
    const genesisManager = new NodeGenesisManager(configService, {
      genesisJsonPath: existsSync(genesisJsonPath)
        ? genesisJsonPath
        : existsSync(parentGenesisPath)
          ? parentGenesisPath
          : undefined,
    })

    const [genError, genesisJson] = genesisManager.getGenesisJson()
    if (genError || !genesisJson) {
      throw new Error(`Genesis not found: ${genError?.message ?? 'no genesis'}`)
    }

    const initialValidators = (genesisJson?.header?.epoch_mark?.validators ?? []).map(
      (validator: { bandersnatch: string; ed25519: string }) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
        bls: bytesToHex(new Uint8Array(144)),
        metadata: bytesToHex(new Uint8Array(128)),
      }),
    )

    const traceSubfolder = `w3f-jam-conformance/${JAM_CONFORMANCE_VERSION}/${TRACE_ID}`
    const services = await initializeServices({
      spec: 'tiny',
      traceSubfolder,
      genesisManager,
      initialValidators: initialValidators.map((validator) => ({
        bandersnatch: validator.bandersnatch as `0x${string}`,
        ed25519: validator.ed25519 as `0x${string}`,
        bls: validator.bls as `0x${string}`,
        metadata: validator.metadata as `0x${string}`,
      })),
      useRust: true,
      useRingVrfWasm: true,
      useIetfVrfWasm: true,
    })

    const { stateService, fullContext } = services
    const {
      sealKeyService,
      entropyService,
      validatorSetManager,
      ietfVerifier,
    } = fullContext as typeof fullContext & { ietfVerifier: import('@pbnjam/bandersnatch-vrf').IETFVRFVerifier | import('@pbnjam/bandersnatch-vrf').IETFVRFVerifierWasm }

    const traceData = JSON.parse(readFileSync(BLOCK_76_PATH, 'utf-8'))

    stateService.clearState()
    if (traceData.pre_state?.keyvals) {
      const [setStateErr] = stateService.setState(traceData.pre_state.keyvals)
      if (setStateErr) {
        throw new Error(`Failed to set pre-state: ${setStateErr.message}`)
      }
    }

    const reportsKeyval = traceData.pre_state?.keyvals?.find(
      (kv: { key: string }) => kv.key === '0x0a000000000000000000000000000000000000000000000000000000000000',
    )
    if (reportsKeyval) {
      const reportsData = hexToBytes(reportsKeyval.value as Hex)
      const [decodeError, decodeResult] = decodeStateWorkReports(
        reportsData,
        fullContext.configService,
      )
      if (!decodeError && decodeResult) {
        fullContext.workReportService.setPendingReports(decodeResult.value)
      }
    }

    const thetimeKeyval = traceData.pre_state?.keyvals?.find(
      (kv: { key: string }) => kv.key === '0x0b000000000000000000000000000000000000000000000000000000000000',
    )
    if (thetimeKeyval) {
      const thetimeBytes = hexToBytes(thetimeKeyval.value as Hex)
      const thetime = BigInt(
        thetimeBytes[0] |
          (thetimeBytes[1] << 8) |
          (thetimeBytes[2] << 16) |
          (thetimeBytes[3] << 24),
      )
      fullContext.accumulationService.setLastProcessedSlot(thetime)
    } else {
      fullContext.accumulationService.setLastProcessedSlot(null)
    }

    const block = convertJsonBlockToBlock(traceData.block)
    const header = block.header

    const [sealErr] = validateSealSignature(
      header,
      sealKeyService,
      validatorSetManager,
      entropyService,
      configService,
      ietfVerifier,
    )

    if (sealErr) {
      expect(sealErr.message).toBeDefined()
      console.log(`validateSealSignature result for block ${BLOCK_NUM}: ${sealErr.message}`)
    }
    expect(sealErr).toBeUndefined()
  }, 60000)
})
