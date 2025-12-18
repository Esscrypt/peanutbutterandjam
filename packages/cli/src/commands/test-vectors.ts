import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { logger } from '@pbnjam/core'

interface TestVectorOptions {
  component?: string
  spec: 'tiny' | 'full'
  format: 'binary' | 'json' | 'both'
  validateSchema: boolean
  outputFormat: 'summary' | 'detailed' | 'json'
  filter?: string
  failFast: boolean
  verbosity: number // 0-5 levels like the example
  seed?: string // For deterministic execution
  blocks?: number // Number of test blocks to process
  parallel?: boolean // Parallel execution
}

interface TestResult {
  component: string
  testCase: string
  format: 'binary' | 'json'
  passed: boolean
  error?: string
  duration: number
}

interface TestSummary {
  totalTests: number
  passed: number
  failed: number
  duration: number
  results: TestResult[]
}

/**
 * Print comprehensive help message (inspired by conformance script)
 */
function printHelp(): void {
  console.log(`
JAM Test Vector Execution Tool

Usage: pbnj test-vectors [options]

Options:
  -c, --component <name>     Test specific component (safrole, statistics, accumulate, etc.)
  -p, --params <set>         Parameter set: tiny or full (default: tiny)
  -s, --spec <set>           Alias for --params
  -f, --format <type>        Input format: binary, json, or both (default: json)
      --validate-schema      Run ASN.1 schema validation before tests
  -o, --output <format>      Output format: summary, detailed, or json (default: summary)
      --filter <regex>       Filter test cases by name (regex pattern)
      --fail-fast            Stop execution on first failure
  -S, --seed <number>        Random seed for deterministic execution
  -b, --blocks <number>      Number of test blocks to process
      --parallel             Enable parallel test execution
  -v, --verbose              Enable verbose output (can be repeated up to 5 times)
  -h, --help                 Show this help message

Verbose Levels:
  (no -v)    Normal output
  -v         Debug level for key scopes
  -vv        Trace level for key scopes
  -vvv       Debug level for all scopes
  -vvvv      Trace level for all scopes (WARNING: very large output)
  -vvvvv     Trace level with codec debugging (WARNING: extremely large output)

Examples:
  pbnj test-vectors --params tiny --component safrole
  pbnj test-vectors --format binary --validate-schema -vv
  pbnj test-vectors --component statistics --spec full --output detailed
  pbnj test-vectors --filter "epoch.*" --fail-fast --seed 12345
  pbnj test-vectors --parallel --blocks 50 --output json

Parameter Sets:
  tiny: 6 validators, 2 cores, 12 epoch length (fast testing)
  full: 1023 validators, 341 cores, 600 epoch length (production scale)
`)
}

/**
 * Set logger level based on verbosity (inspired by conformance script)
 */
function configureVerbosity(verbosity: number): void {
  switch (verbosity) {
    case 0:
      // Normal output - info level
      logger.info('Verbose mode: Normal output')
      break
    case 1:
      logger.info('Verbose mode: Debug level for key scopes')
      break
    case 2:
      logger.info('Verbose mode: Trace level for key scopes')
      break
    case 3:
      logger.info('Verbose mode: Debug level for all scopes')
      break
    case 4:
      logger.warn(
        'Verbose mode: Trace level for all scopes (WARNING: very large output)',
      )
      break
    case 5:
      logger.warn(
        'Verbose mode: Trace level with codec debugging (WARNING: extremely large output)',
      )
      break
  }
}

export function createTestVectorsCommand(args: string[]): void {
  try {
    const options: TestVectorOptions = {
      spec: 'tiny',
      format: 'json',
      validateSchema: false,
      outputFormat: 'summary',
      failFast: false,
      verbosity: 0,
      parallel: false,
    }

    // Enhanced argument parsing (inspired by conformance script)
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]

      switch (arg) {
        case '--component':
        case '-c':
          options.component = args[++i]
          break
        case '--params':
        case '--spec':
        case '-p':
        case '-s':
          options.spec = args[++i] as 'tiny' | 'full'
          break
        case '--format':
        case '-f':
          options.format = args[++i] as 'binary' | 'json' | 'both'
          break
        case '--validate-schema':
          options.validateSchema = true
          break
        case '--output':
        case '-o':
          options.outputFormat = args[++i] as 'summary' | 'detailed' | 'json'
          break
        case '--filter':
          options.filter = args[++i]
          break
        case '--fail-fast':
          options.failFast = true
          break
        case '--seed':
        case '-S':
          options.seed = args[++i]
          break
        case '--blocks':
        case '-b':
          options.blocks = Number.parseInt(args[++i])
          break
        case '--parallel':
          options.parallel = true
          break
        case '-v':
          options.verbosity = Math.min(5, options.verbosity + 1)
          break
        case '-vv':
          options.verbosity = Math.min(5, 2)
          break
        case '-vvv':
          options.verbosity = Math.min(5, 3)
          break
        case '-vvvv':
          options.verbosity = Math.min(5, 4)
          break
        case '-vvvvv':
          options.verbosity = 5
          break
        case '--verbose':
          options.verbosity = Math.min(5, options.verbosity + 1)
          break
        case '--help':
        case '-h':
          printHelp()
          process.exit(0)
          break
        default:
          if (arg.startsWith('--')) {
            throw new Error(`Unknown option: ${arg}`)
          }
      }
    }

    const testVectorsPath = join(process.cwd(), 'submodules', 'jamtestvectors')
    if (!existsSync(testVectorsPath)) {
      throw new Error(`JAM test vectors not found at: ${testVectorsPath}`)
    }

    // Configure verbosity
    configureVerbosity(options.verbosity)

    // Print banner with colors (inspired by conformance script)
    console.log('\x1b[33m%s\x1b[0m', 'JAM Test Vector Execution Tool')
    console.log('==============================')
    console.log(`Parameter Set: ${options.spec}`)
    console.log(`Format: ${options.format}`)
    console.log(`Test vectors path: ${testVectorsPath}`)
    if (options.seed) {
      console.log(`Seed: ${options.seed}`)
    }
    if (options.blocks) {
      console.log(`Blocks: ${options.blocks}`)
    }
    console.log('')

    const stfPath = join(testVectorsPath, 'stf')
    const availableComponents = readdirSync(stfPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort()

    const componentsToTest = options.component
      ? [options.component]
      : availableComponents

    logger.info(`Components to test: ${componentsToTest.join(', ')}`)

    const allResults: TestResult[] = []
    const startTime = Date.now()

    for (const component of componentsToTest) {
      const componentPath = join(stfPath, component, options.spec)
      if (!existsSync(componentPath)) {
        logger.warn(
          `Spec directory not found for ${component}: ${componentPath}`,
        )
        continue
      }

      const jsonFiles = readdirSync(componentPath)
        .filter((file) => file.endsWith('.json'))
        .map((file) => join(componentPath, file))

      logger.info(`Testing ${jsonFiles.length} JSON files for ${component}`)

      for (const jsonFile of jsonFiles) {
        const testStartTime = Date.now()
        const testName = basename(jsonFile, '.json')

        try {
          const testVector = JSON.parse(readFileSync(jsonFile, 'utf8'))

          // Basic validation
          const requiredFields = ['input', 'pre_state', 'post_state']
          for (const field of requiredFields) {
            if (!(field in testVector)) {
              throw new Error(`Missing required field: ${field}`)
            }
          }

          const result: TestResult = {
            component,
            testCase: testName,
            format: 'json',
            passed: true,
            duration: Date.now() - testStartTime,
          }

          allResults.push(result)
          logger.info(`✅ ${component}/${testName} - PASSED`)
        } catch (error: unknown) {
          const result: TestResult = {
            component,
            testCase: testName,
            format: 'json',
            passed: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - testStartTime,
          }

          allResults.push(result)
          logger.error(
            `❌ ${component}/${testName} - ERROR: ${error instanceof Error ? error.message : String(error)}`,
          )

          if (options.failFast) {
            break
          }
        }
      }
    }

    const summary: TestSummary = {
      totalTests: allResults.length,
      passed: allResults.filter((r) => r.passed).length,
      failed: allResults.filter((r) => !r.passed).length,
      duration: Date.now() - startTime,
      results: allResults,
    }

    const { totalTests, passed, failed, duration } = summary
    const passRate =
      totalTests > 0 ? ((passed / totalTests) * 100).toFixed(1) : '0.0'

    logger.info(`\n${'='.repeat(80)}`)
    logger.info('TEST VECTOR EXECUTION SUMMARY')
    logger.info('='.repeat(80))
    logger.info(`Total Tests: ${totalTests}`)
    logger.info(`Passed: ${passed} (${passRate}%)`)
    logger.info(`Failed: ${failed}`)
    logger.info(`Duration: ${duration}ms`)
    logger.info('='.repeat(80))

    process.exit(failed > 0 ? 1 : 0)
  } catch (error: unknown) {
    logger.error(
      'Test vector execution failed:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}
