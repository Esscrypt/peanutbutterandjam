/**
 * Extrinsic Validator
 *
 * Validates extrinsics according to JAM Protocol specifications
 * Reference: Gray Paper extrinsic validation
 */

import { logger } from '@pbnj/core'
import type {
  BlockAuthoringConfig,
  Extrinsic,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './types'

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
  ): Promise<ValidationResult> {
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
    for (let i = 0; i < extrinsics.length; i++) {
      const extrinsic = extrinsics[i]
      const extrinsicErrors = await this.validateExtrinsic(extrinsic, i, config)
      const extrinsicWarnings = await this.validateExtrinsicWarnings(
        extrinsic,
        i,
        config,
      )

      errors.push(...extrinsicErrors)
      warnings.push(...extrinsicWarnings)
    }

    const valid = errors.length === 0

    logger.debug('Extrinsic validation completed', {
      valid,
      errorCount: errors.length,
      warningCount: warnings.length,
    })

    return {
      valid,
      errors,
      warnings,
    }
  }

  /**
   * Validate a single extrinsic
   */
  private async validateExtrinsic(
    extrinsic: Extrinsic,
    index: number,
    _config: BlockAuthoringConfig,
  ): Promise<ValidationError[]> {
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

    return errors
  }

  /**
   * Validate extrinsic warnings
   */
  private async validateExtrinsicWarnings(
    extrinsic: Extrinsic,
    index: number,
    _config: BlockAuthoringConfig,
  ): Promise<ValidationWarning[]> {
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

    return warnings
  }
}
