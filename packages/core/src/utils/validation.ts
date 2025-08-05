/**
 * Validation Utilities for JAM Protocol
 *
 * Input validation functions and schema validation helpers
 * Reference: Gray Paper validation specifications
 */

import type { Bytes, Hash, HexString, Optional } from '../types'
import { isValidHex, isValidHexLength } from './crypto'
import { isValidBase58, isValidBase64 } from './encoding'

/**
 * Validation error
 */
export interface ValidationError {
  /** Field name */
  field: string
  /** Error message */
  message: string
  /** Error code */
  code: string
  /** Error context */
  context?: Record<string, unknown>
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Is valid */
  isValid: boolean
  /** Validation errors */
  errors: ValidationError[]
  /** Validation warnings */
  warnings: ValidationError[]
}

/**
 * Validator function type
 */
export type ValidatorFunction<T> = (value: T) => ValidationResult

/**
 * Type guard function type
 */
export type TypeGuard<T> = (value: unknown) => value is T

/**
 * Validate required field
 */
export function validateRequired(
  value: unknown,
  fieldName: string,
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} is required`,
          code: 'REQUIRED',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate string field
 */
export function validateString(
  value: unknown,
  fieldName: string,
): ValidationResult {
  const required = validateRequired(value, fieldName)
  if (!required.isValid) {
    return required
  }

  if (typeof value !== 'string') {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be a string`,
          code: 'TYPE_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate number field
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
): ValidationResult {
  const required = validateRequired(value, fieldName)
  if (!required.isValid) {
    return required
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be a valid number`,
          code: 'TYPE_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate integer field
 */
export function validateInteger(
  value: unknown,
  fieldName: string,
): ValidationResult {
  const number = validateNumber(value, fieldName)
  if (!number.isValid) {
    return number
  }

  if (!Number.isInteger(value as number)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be an integer`,
          code: 'TYPE_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate boolean field
 */
export function validateBoolean(
  value: unknown,
  fieldName: string,
): ValidationResult {
  const required = validateRequired(value, fieldName)
  if (!required.isValid) {
    return required
  }

  if (typeof value !== 'boolean') {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be a boolean`,
          code: 'TYPE_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate array field
 */
export function validateArray(
  value: unknown,
  fieldName: string,
): ValidationResult {
  const required = validateRequired(value, fieldName)
  if (!required.isValid) {
    return required
  }

  if (!Array.isArray(value)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be an array`,
          code: 'TYPE_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate object field
 */
export function validateObject(
  value: unknown,
  fieldName: string,
): ValidationResult {
  const required = validateRequired(value, fieldName)
  if (!required.isValid) {
    return required
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be an object`,
          code: 'TYPE_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate hex string field
 */
export function validateHexString(
  value: unknown,
  fieldName: string,
  expectedLength?: number,
): ValidationResult {
  const string = validateString(value, fieldName)
  if (!string.isValid) {
    return string
  }

  if (!isValidHex(value as string)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be a valid hex string`,
          code: 'FORMAT_ERROR',
        },
      ],
      warnings: [],
    }
  }

  if (expectedLength && !isValidHexLength(value as string, expectedLength)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be ${expectedLength} bytes long`,
          code: 'LENGTH_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate base64 string field
 */
export function validateBase64String(
  value: unknown,
  fieldName: string,
): ValidationResult {
  const string = validateString(value, fieldName)
  if (!string.isValid) {
    return string
  }

  if (!isValidBase64(value as string)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be a valid base64 string`,
          code: 'FORMAT_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate base58 string field
 */
export function validateBase58String(
  value: unknown,
  fieldName: string,
): ValidationResult {
  const string = validateString(value, fieldName)
  if (!string.isValid) {
    return string
  }

  if (!isValidBase58(value as string)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be a valid base58 string`,
          code: 'FORMAT_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  minLength: number,
  maxLength?: number,
): ValidationResult {
  if (value.length < minLength) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be at least ${minLength} characters long`,
          code: 'LENGTH_ERROR',
        },
      ],
      warnings: [],
    }
  }

  if (maxLength && value.length > maxLength) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be at most ${maxLength} characters long`,
          code: 'LENGTH_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  fieldName: string,
  min: number,
  max?: number,
): ValidationResult {
  if (value < min) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be at least ${min}`,
          code: 'RANGE_ERROR',
        },
      ],
      warnings: [],
    }
  }

  if (max && value > max) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be at most ${max}`,
          code: 'RANGE_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate array length
 */
export function validateArrayLength(
  value: unknown[],
  fieldName: string,
  minLength: number,
  maxLength?: number,
): ValidationResult {
  if (value.length < minLength) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must have at least ${minLength} items`,
          code: 'LENGTH_ERROR',
        },
      ],
      warnings: [],
    }
  }

  if (maxLength && value.length > maxLength) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must have at most ${maxLength} items`,
          code: 'LENGTH_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  enumValues: T[],
): ValidationResult {
  const string = validateString(value, fieldName)
  if (!string.isValid) {
    return string
  }

  if (!enumValues.includes(value as T)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be one of: ${enumValues.join(', ')}`,
          code: 'ENUM_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Validate pattern (regex)
 */
export function validatePattern(
  value: string,
  fieldName: string,
  pattern: RegExp,
): ValidationResult {
  const string = validateString(value, fieldName)
  if (!string.isValid) {
    return string
  }

  if (!pattern.test(value)) {
    return {
      isValid: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} does not match the required pattern`,
          code: 'PATTERN_ERROR',
        },
      ],
      warnings: [],
    }
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
  }
}

/**
 * Type guard for Hash
 */
export function isHash(value: unknown): value is Hash {
  return typeof value === 'string' && isValidHex(value)
}

/**
 * Type guard for HexString
 */
export function isHexString(value: unknown): value is HexString {
  return typeof value === 'string' && isValidHex(value)
}

/**
 * Type guard for Bytes
 */
export function isBytes(value: unknown): value is Bytes {
  return value instanceof Uint8Array || Buffer.isBuffer(value)
}

/**
 * Type guard for Optional
 */
export function isOptional<T>(
  value: unknown,
  validator: TypeGuard<T>,
): value is Optional<T> {
  return value === null || value === undefined || validator(value)
}

/**
 * Combine validation results
 */
export function combineValidationResults(
  ...results: ValidationResult[]
): ValidationResult {
  const allErrors: ValidationError[] = []
  const allWarnings: ValidationError[] = []

  for (const result of results) {
    allErrors.push(...result.errors)
    allWarnings.push(...result.warnings)
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  }
}
