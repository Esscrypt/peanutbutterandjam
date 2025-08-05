/**
 * CLI Types for JAM Protocol
 *
 * Types for command-line interface operations
 */

import type { Result } from './core'

export interface GlobalOptions {
  config?: string
  logLevel?: string
  temp?: boolean
  verbose?: boolean
}

export interface ICommand<T extends GlobalOptions = GlobalOptions> {
  execute(options: T): Promise<Result<void>>
}
