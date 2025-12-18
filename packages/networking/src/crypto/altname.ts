import type { AlternativeName, DisplayAlternativeName } from '@pbnjam/types'

/**
 * Convert alternative name to display format with $e prefix
 */
export function toDisplayAlternativeName(
  altName: AlternativeName,
): DisplayAlternativeName {
  return `$e${altName}` as DisplayAlternativeName
}

/**
 * Extract alternative name from display format (remove $e prefix)
 */
export function fromDisplayAlternativeName(
  displayAltName: DisplayAlternativeName,
): AlternativeName {
  return displayAltName.slice(1) as AlternativeName
}
