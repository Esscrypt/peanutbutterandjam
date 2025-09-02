/**
 * Extrinsic Validator
 *
 * Validates extrinsics according to JAM Protocol specifications
 * Reference: Gray Paper extrinsic validation
 */

import { logger, type SafePromise, safeError, safeResult } from '@pbnj/core'
import type {
  BlockAuthoringConfig,
  BlockAuthoringValidationResult,
  Extrinsic as CoreExtrinsic,
  ValidationError,
  ValidationWarning,
} from '@pbnj/types'

// Extend core Extrinsic with node-specific properties
interface Extrinsic extends CoreExtrinsic {
  id: string
  author: string
}

/**
 * Extrinsic Validator
 */
export class ExtrinsicValidator {
  /**
   * Validate extrinsics
   */
  async validate(
    extrinsics: Extrinsic[],
    config: BlockAuthoringConfig,
  ): SafePromise<BlockAuthoringValidationResult> {
    logger.debug('Validating extrinsics', {
      extrinsicCount: extrinsics.length,
    })

    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check extrinsic count limit
    if (extrinsics.length > config.maxExtrinsicsPerBlock) {
      errors.push({
        code: 'EXTRINSIC_COUNT_EXCEEDED',
        message: `Too many extrinsics: ${extrinsics.length} > ${config.maxExtrinsicsPerBlock}`,
      })
    }

    // Validate each extrinsic
    for (let i = 0n; i < BigInt(extrinsics.length); i++) {
      const extrinsic = extrinsics[Number(i)]
      const [extrinsicErrorsError, extrinsicErrors] =
        await this.validateExtrinsic(extrinsic, i, config)
      if (extrinsicErrorsError) {
        return safeError(extrinsicErrorsError)
      }
      const [extrinsicWarningsError, extrinsicWarnings] =
        await this.validateExtrinsicWarnings(extrinsic, i, config)
      if (extrinsicWarningsError) {
        return safeError(extrinsicWarningsError)
      }

      errors.push(...extrinsicErrors)
      warnings.push(...extrinsicWarnings)
    }

    const valid = errors.length === 0

    logger.debug('Extrinsic validation completed', {
      valid,
      errorCount: errors.length,
      warningCount: warnings.length,
    })

    return safeResult({
      valid,
      errors,
      warnings,
    })
  }

  /**
   * Validate a single extrinsic
   */
  private async validateExtrinsic(
    extrinsic: Extrinsic,
    index: bigint,
    _config: BlockAuthoringConfig,
  ): SafePromise<ValidationError[]> {
    const errors: ValidationError[] = []

    // Validate extrinsic ID
    if (!extrinsic.id || extrinsic.id.length === 0) {
      errors.push({
        code: 'INVALID_EXTRINSIC_ID',
        message: 'Extrinsic ID is required',
        extrinsicIndex: index,
        field: 'id',
      })
    }

    // Validate extrinsic data
    if (!extrinsic.data || extrinsic.data.length === 0) {
      errors.push({
        code: 'INVALID_EXTRINSIC_DATA',
        message: 'Extrinsic data is required',
        extrinsicIndex: index,
        field: 'data',
      })
    }

    // Validate extrinsic signature
    if (!extrinsic.signature || extrinsic.signature.length === 0) {
      errors.push({
        code: 'INVALID_EXTRINSIC_SIGNATURE',
        message: 'Extrinsic signature is required',
        extrinsicIndex: index,
        field: 'signature',
      })
    }

    // Validate extrinsic author
    if (!extrinsic.author || extrinsic.author.length === 0) {
      errors.push({
        code: 'INVALID_EXTRINSIC_AUTHOR',
        message: 'Extrinsic author is required',
        extrinsicIndex: index,
        field: 'author',
      })
    }

    // TODO: Add more validation rules:
    // - Signature verification
    // - Author authorization
    // - Data format validation
    // - Gas limit validation
    // - Fee validation

    return safeResult(errors)
  }

  /**
   * Validate extrinsic warnings
   */
  private async validateExtrinsicWarnings(
    extrinsic: Extrinsic,
    index: bigint,
    _config: BlockAuthoringConfig,
  ): SafePromise<ValidationWarning[]> {
    const warnings: ValidationWarning[] = []

    // Check for large extrinsic data
    if (extrinsic.data.length > 1024 * 1024) {
      // 1MB
      warnings.push({
        code: 'LARGE_EXTRINSIC_DATA',
        message: 'Extrinsic data is very large',
        extrinsicIndex: index,
        field: 'data',
      })
    }

    // TODO: Add more warning checks:
    // - High gas usage
    // - Unusual author patterns
    // - Duplicate extrinsics
    // - Suspicious timing

    return safeResult(warnings)
  }
}
