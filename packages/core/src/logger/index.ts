import pino from 'pino'

// Declare Bun global if not available from types
declare global {
  const Bun:
    | {
        inspect: (value: unknown) => string
      }
    | undefined
}

/**
 * LoggerProvider is a class that provides logging functionality.
 * It is a wrapper around the pino logger.
 * It is a singleton class.
 * @description ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️ !IMPORTANT! Before using the logger, it must be initialized with this method at the top of the entry point file of a service.
 */
export class LoggerProvider {
  private pino = pino(
    {
      level: process.env['PINO_LEVEL'] || 'info',
    },
    pino.multistream([
      { level: 'error', stream: process.stderr },
      { level: 'fatal', stream: process.stderr },
      { level: 'debug', stream: process.stdout },
    ]),
  )
  private hasBeenInitialized = false

  get hasBeenInitializedValue() {
    return this.hasBeenInitialized
  }

  get level() {
    return process.env['PINO_LEVEL'] || 'info'
  }

  init() {
    //TODO: connect to Prometheus or other metrics service
    this.pino.info('LoggerProvider initialized')
    this.hasBeenInitialized = true
  }

  noInitLog(message: string) {
    this.pino.info(message)
  }

  info(message: string, ...args: unknown[]) {
    this._safeLog('info', message, args)
  }

  debug(message: string, ...args: unknown[]) {
    this._safeLog('debug', message, args)
  }

  warn(message: string, ...args: unknown[]) {
    this._safeLog('warn', message, args)
  }

  warning(message: string, ...args: unknown[]) {
    this._safeLog('warn', message, args)
  }

  error(message: string, error?: unknown, ..._args: unknown[]) {
    this._safeLog('error', message, [error, ..._args])
  }

  /**
   * Safe logging method that handles uninitialized logger gracefully
   */
  private _safeLog(
    level: 'info' | 'debug' | 'warn' | 'error',
    message: string,
    args: unknown[],
  ) {
    if (!this.hasBeenInitialized) {
      // Log to console as fallback when logger is not initialized
      const timestamp = new Date().toISOString()
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`

      if (level === 'error') {
        console.error(logMessage, ...args)
      } else if (level === 'warn') {
        console.warn(logMessage, ...args)
      } else if (level === 'debug') {
        console.debug(logMessage, ...args)
      } else {
        console.log(logMessage, ...args)
      }
      return
    }

    // Use the initialized logger
    try {
      if (level === 'error') {
        const errorArgs = typeof Bun !== 'undefined' ? Bun.inspect(args) : args
        this.pino.error({ err: args[0], args: errorArgs }, message)
      } else {
        this.pino[level](args, message)
      }
    } catch (_error) {}
  }
}

export const logger = new LoggerProvider()
