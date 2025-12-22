#!/usr/bin/env bun

/**
 * Decompress all gzip files in jamduna submodule
 *
 * Usage: bun scripts/unzip-jamduna-traces.ts
 */

import { execSync } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

async function findGzFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      const subFiles = await findGzFiles(fullPath)
      files.push(...subFiles)
    } else if (entry.name.endsWith('.gz')) {
      files.push(fullPath)
    }
  }

  return files
}

async function decompressFile(filePath: string): Promise<boolean> {
  try {
    execSync(`gunzip -f "${filePath}"`, { stdio: 'ignore' })
    return true
  } catch (error) {
    console.error(
      `${colors.red}Failed to decompress: ${filePath}${colors.reset}`,
    )
    return false
  }
}

async function main() {
  const workspaceRoot = join(__dirname, '..')
  const jamdunaDir = join(workspaceRoot, 'submodules', 'jamduna')

  console.log(
    `${colors.bold}${colors.cyan}Finding all .gz files in jamduna...${colors.reset}`,
  )

  const gzFiles = await findGzFiles(jamdunaDir)
  const totalFiles = gzFiles.length

  console.log(
    `${colors.green}Found ${totalFiles} gzip files to decompress${colors.reset}`,
  )
  console.log()

  let processed = 0
  let succeeded = 0
  let failed = 0

  const startTime = Date.now()

  // Process files in batches to show progress
  const batchSize = 100
  for (let i = 0; i < gzFiles.length; i += batchSize) {
    const batch = gzFiles.slice(i, i + batchSize)
    const batchPromises = batch.map(async (file) => {
      const success = await decompressFile(file)
      processed++
      if (success) {
        succeeded++
      } else {
        failed++
      }

      // Show progress every 100 files
      if (processed % 100 === 0 || processed === totalFiles) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const rate = (processed / (Date.now() - startTime)) * 1000
        const remaining = totalFiles - processed
        const eta = remaining / rate

        process.stdout.write(
          `\r${colors.cyan}Progress: ${processed}/${totalFiles} (${((processed / totalFiles) * 100).toFixed(1)}%) | ` +
            `Succeeded: ${succeeded} | Failed: ${failed} | ` +
            `Rate: ${rate.toFixed(1)} files/s | ETA: ${eta.toFixed(0)}s${colors.reset}`,
        )
      }
    })

    await Promise.all(batchPromises)
  }

  console.log()
  console.log()
  console.log(
    `${colors.bold}${colors.green}Decompression complete!${colors.reset}`,
  )
  console.log(`   Total files: ${totalFiles}`)
  console.log(`   Succeeded: ${colors.green}${succeeded}${colors.reset}`)
  if (failed > 0) {
    console.log(`   Failed: ${colors.red}${failed}${colors.reset}`)
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`   Time elapsed: ${elapsed}s`)
}

main().catch((error) => {
  console.error(`${colors.red}Error: ${error}${colors.reset}`)
  process.exit(1)
})

