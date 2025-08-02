import type { GlobalOptions } from './types'

export interface GenKeysOptions extends GlobalOptions {
  // Command-specific options can be added here
}

export interface GenSpecOptions extends GlobalOptions {
  // Command-specific options can be added here
}

export interface ListKeysOptions extends GlobalOptions {
  // Command-specific options can be added here
}

export interface PrintSpecOptions extends GlobalOptions {
  // Command-specific options can be added here
}

export interface RunOptions extends GlobalOptions {
  // Command-specific options can be added here
}

export interface TestStfOptions extends GlobalOptions {
  // Command-specific options can be added here
}

export interface TestSafroleOptions extends GlobalOptions {
  vectors?: string
  vector?: string
}

export interface TestAllOptions extends GlobalOptions {
  vectors?: string
}

export type CommandOptions =
  | GenKeysOptions
  | GenSpecOptions
  | ListKeysOptions
  | PrintSpecOptions
  | RunOptions
  | TestStfOptions
  | TestSafroleOptions
  | TestAllOptions

// Interface for commander options
export interface CommanderOptions {
  config?: string
  logLevel?: string
  temp?: boolean
  verbose?: boolean
  [key: string]: unknown
}

export function parseArguments(options: CommanderOptions): CommandOptions {
  // Convert commander options to our typed options
  const parsed: CommandOptions = {
    config: options.config,
    logLevel: options.logLevel,
    temp: options.temp,
    verbose: options.verbose,
  }

  return parsed
}
