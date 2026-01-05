import { blake2bHash, type Hex } from '@pbnjam/core'
import type {
  Block,
  BlockHeader,
  IConfigService,
  Safe,
  WorkPackage,
  WorkReport,
} from '@pbnjam/types'
import { safeError } from '@pbnjam/types'
import { encodeHeader } from './block/header'
import { encodeWorkPackage } from './work-package/package'
import { encodeWorkReport } from './work-package/work-report'

/**
 * Calculate block hash
 */
export function calculateBlockHash(
  block: Block,
  config: IConfigService,
): Safe<Hex> {
  const [headerBytesError, headerBytes] = encodeHeader(block.header, config)
  if (headerBytesError) {
    return safeError(headerBytesError)
  }
  return blake2bHash(headerBytes)
}

export function calculateBlockHashFromHeader(
  header: BlockHeader,
  config: IConfigService,
): Safe<Hex> {
  const [headerBytesError, headerBytes] = encodeHeader(header, config)
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
