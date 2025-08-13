/**
 * Simple argument parser to replace the problematic CLI library
 */

export interface ParsedArgs {
  [key: string]: string | number | boolean | undefined
}

export function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {}
  let i = 0

  while (i < args.length) {
    const arg = args[i]

    if (arg.startsWith('--')) {
      // Long option
      const key = arg.slice(2)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result[key] = args[i + 1]
        i += 2
      } else {
        result[key] = true
        i += 1
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short option
      const key = arg.slice(1)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result[key] = args[i + 1]
        i += 2
      } else {
        result[key] = true
        i += 1
      }
    } else {
      // Positional argument
      result['_'] = arg
      i += 1
    }
  }

  return result
}

export function getOption<T = unknown>(
  args: ParsedArgs,
  key: string,
  defaultValue?: T,
): T | undefined {
  return args[key] !== undefined ? (args[key] as T) : defaultValue
}
