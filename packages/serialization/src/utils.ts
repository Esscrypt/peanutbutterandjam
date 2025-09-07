import { blake2bHash, type Hex, type Safe, safeError } from '@pbnj/core'
import type { Block, WorkPackage, WorkReport } from '@pbnj/types'
import { encodeHeader } from './block/header'
import { encodeWorkPackage } from './work-package/package'
import { encodeWorkReport } from './work-package/work-report'

/**
 * Calculate block hash
 */
export function calculateBlockHash(block: Block): Safe<Hex> {
  const [headerBytesError, headerBytes] = encodeHeader(block.header)
  if (headerBytesError) {
    return safeError(headerBytesError)
  }
  return blake2bHash(headerBytes)
}

/**
 * Calculate work package hash from serialized data
 */
export function calculateWorkPackageHash(workPackage: WorkPackage): Safe<Hex> {
  const [encodeError, encoded] = encodeWorkPackage(workPackage)
  if (encodeError) {
    return safeError(encodeError)
  }
  return blake2bHash(encoded)
}

/**
 * Calculate work report hash from serialized data
 */
export function calculateWorkReportHash(workReport: WorkReport): Safe<Hex> {
  const [encodeError, encoded] = encodeWorkReport(workReport)
  if (encodeError) {
    return safeError(encodeError)
  }
  return blake2bHash(encoded)
}
