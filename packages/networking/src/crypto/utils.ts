import { bytesToHex, logger } from '@pbnjam/core'
import type { StreamReader } from './peer'

/**
 * Read all data from a stream reader by accumulating chunks
 * @param reader - Stream reader to read from
 * @returns Combined Uint8Array containing all data from the stream
 */
export async function readAllFromReader(
  reader: StreamReader,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let totalLength = 0

  try {
    while (true) {
      const { value, done } = await reader.read()

      if (done) {
        break
      }

      if (value && value instanceof Uint8Array) {
        chunks.push(value)
        totalLength += value.length
        logger.debug('[NetworkingService] Read stream chunk', {
          chunkLength: value.length,
          totalLength,
          chunkHex: bytesToHex(value.slice(0, Math.min(32, value.length))),
        })
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Combine all chunks into a single Uint8Array
  const data = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.length
  }

  logger.debug('[NetworkingService] Read all data from reader', {
    totalChunks: chunks.length,
    totalLength: data.length,
  })

  return data
}
