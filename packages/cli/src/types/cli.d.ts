declare module 'cli' {
  interface CliOptions {
    help?: boolean
    version?: boolean
    chain?: string
    port?: number
    'rpc-port'?: number
    'data-path'?: string
    datadir?: string
    bootnode?: string
    debug?: string
    'dev-validator'?: number
    validatorindex?: number
    'external-ip'?: string
    'listen-ip'?: string
    'peer-id'?: number
    'pvm-backend'?: string
    'rpc-listen-ip'?: string
    'start-time'?: string
    telemetry?: string
    bandersnatch?: string
    bls?: string
    ed25519?: string
    genesis?: string
    metadata?: string
    ts?: number
    [key: string]: unknown
  }

  interface CliArgs {
    args: string[]
  }

  function parse(
    options: Record<string, [string, string, string, unknown]>,
    args?: string[],
  ): CliOptions & CliArgs

  const cli: {
    parse: typeof parse
    args: string[]
  }

  export = cli
}
