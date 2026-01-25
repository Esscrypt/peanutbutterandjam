/**
 * CE 129: State Request Protocol
 *
 * Implements the state request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting ranges of state trie data.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { decodeFixedLength, encodeFixedLength } from '@pbnjam/codec'
import type { EventBusService, Hex } from '@pbnjam/core'
import { bytesToHex, concatBytes, hexToBytes, logger } from '@pbnjam/core'
import type {
  Safe,
  SafePromise,
  StateRequest,
  StateResponse,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * State request protocol handler
 */
export class StateRequestProtocol extends NetworkingProtocol<
  StateRequest,
  StateResponse
> {
  private readonly eventBusService: EventBusService
  constructor(eventBusService: EventBusService) {
    super()
    this.eventBusService = eventBusService

    this.initializeEventHandlers()
  }

  /**
   * Process state request and generate response
   */
  async processRequest(
    request: StateRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    try {
      logger.info('[CE129] Processing state request', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        headerHash: bytesToHex(request.headerHash),
        startKey: bytesToHex(request.startKey),
        endKey: bytesToHex(request.endKey),
        maximumSize: request.maximumSize.toString(),
      })

      this.eventBusService.emitStateRequested(request, peerPublicKey)

      logger.debug('[CE129] State request processed successfully', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        headerHash: `${bytesToHex(request.headerHash).slice(0, 18)}...`,
      })
    } catch (error) {
      logger.error('[CE129] Failed to process state request', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        headerHash: bytesToHex(request.headerHash),
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(`Failed to process state request: ${String(error)}`),
      )
    }
    return safeResult(undefined)
  }

  async processResponse(
    response: StateResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    try {
      logger.info('[CE129] Processing state response', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        boundaryNodesCount: response.boundaryNodes.length,
        keyValuePairsCount: response.keyValuePairs.length,
      })

      // Log state response to JSON file
      try {
        const logEntry = {
          timestamp: new Date().toISOString(),
          protocol: 'CE129',
          peerPublicKey: peerPublicKey,
          boundaryNodesCount: response.boundaryNodes.length,
          keyValuePairsCount: response.keyValuePairs.length,
          boundaryNodes: response.boundaryNodes.map((node) => bytesToHex(node)),
          keyValuePairs: response.keyValuePairs.map((pair) => ({
            key: bytesToHex(pair.key),
            value: bytesToHex(pair.value),
          })),
        }

        // Write to JSON file (append mode)
        const logDir = path.join(process.cwd(), 'logs')
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true })
        }

        const logFile = path.join(logDir, 'ce129-state-responses.json')
        let logEntries: unknown[] = []

        // Read existing entries if file exists
        if (fs.existsSync(logFile)) {
          try {
            const existingContent = fs.readFileSync(logFile, 'utf-8')
            logEntries = JSON.parse(existingContent)
          } catch (error) {
            logger.warn(
              '[CE129] Failed to parse existing log file, starting fresh',
              {
                error: error instanceof Error ? error.message : String(error),
              },
            )
          }
        }

        // Append new entry
        logEntries.push(logEntry)

        // Write back to file
        fs.writeFileSync(logFile, JSON.stringify(logEntries, null, 2), 'utf-8')

        logger.debug('[CE129] Logged state response to JSON file', {
          logFile,
          keyValuePairsCount: response.keyValuePairs.length,
          boundaryNodesCount: response.boundaryNodes.length,
        })
      } catch (error) {
        logger.error('[CE129] Failed to log state response to JSON file', {
          error: error instanceof Error ? error.message : String(error),
        })
        // Don't fail the response if logging fails
      }

      // Emit event for chain-manager-service to handle
      // chain-manager-service listens to this event via addStateResponseCallback
      try {
        this.eventBusService.emitStateResponse(response, peerPublicKey)
        logger.debug('[CE129] State response event emitted successfully', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          keyValuePairsCount: response.keyValuePairs.length,
        })
      } catch (emitError) {
        logger.error('[CE129] Failed to emit state response event', {
          peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
          keyValuePairsCount: response.keyValuePairs.length,
          error:
            emitError instanceof Error ? emitError.message : String(emitError),
        })
        return safeError(
          emitError instanceof Error
            ? emitError
            : new Error(
                `Failed to emit state response event: ${String(emitError)}`,
              ),
        )
      }

      return safeResult(undefined)
    } catch (error) {
      logger.error('[CE129] Unexpected error in processResponse', {
        peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
        boundaryNodesCount: response.boundaryNodes.length,
        keyValuePairsCount: response.keyValuePairs.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      // Still try to emit the event so chain manager can attempt to handle it
      try {
        this.eventBusService.emitStateResponse(response, peerPublicKey)
      } catch (emitError) {
        logger.error(
          '[CE129] Failed to emit state response event after error',
          {
            error:
              emitError instanceof Error
                ? emitError.message
                : String(emitError),
          },
        )
      }
      return safeError(
        error instanceof Error
          ? error
          : new Error(`Unexpected error in processResponse: ${String(error)}`),
      )
    }
  }

  /**
   * Serialize state request message
   */
  serializeRequest(request: StateRequest): Safe<Uint8Array> {
    try {
      // Serialize according to JAMNP-S specification
      const parts: Uint8Array[] = []
      parts.push(request.headerHash)
      parts.push(request.startKey)
      parts.push(request.endKey)
      const [error, maximumSize] = encodeFixedLength(request.maximumSize, 4n)
      if (error) {
        logger.error(
          '[CE129] Failed to encode maximumSize in serializeRequest',
          {
            headerHash: `${bytesToHex(request.headerHash).slice(0, 18)}...`,
            maximumSize: request.maximumSize.toString(),
            error: error.message,
          },
        )
        return safeError(error)
      }
      parts.push(maximumSize)
      return safeResult(concatBytes(parts))
    } catch (error) {
      logger.error('[CE129] Unexpected error in serializeRequest', {
        headerHash: bytesToHex(request.headerHash),
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(`Unexpected error in serializeRequest: ${String(error)}`),
      )
    }
  }

  /**
   * Deserialize state request message
   */
  deserializeRequest(data: Uint8Array): Safe<StateRequest> {
    try {
      // State request format: headerHash (32 bytes) + startKey (32 bytes) + endKey (32 bytes) + maximumSize (4 bytes) = 100 bytes
      if (data.length < 100) {
        const error = new Error(
          `Insufficient data for state request deserialization: expected at least 100 bytes, got ${data.length}`,
        )
        logger.error(
          '[CE129] Failed to deserialize state request: insufficient data',
          {
            dataLength: data.length,
            expectedLength: 100,
            error: error.message,
          },
        )
        return safeError(error)
      }

      let currentData = data
      const headerHash = bytesToHex(currentData.slice(0, 32))
      currentData = currentData.slice(32)

      const startKey = bytesToHex(currentData.slice(0, 32))
      currentData = currentData.slice(32)

      const endKey = bytesToHex(currentData.slice(0, 32))
      currentData = currentData.slice(32)

      const maximumSize = bytesToHex(currentData.slice(0, 4))
      currentData = currentData.slice(4)

      logger.debug('[CE129] Successfully deserialized state request', {
        headerHash: `${headerHash.slice(0, 18)}...`,
        startKey: `${startKey.slice(0, 18)}...`,
        endKey: `${endKey.slice(0, 18)}...`,
        maximumSize,
      })

      return safeResult({
        headerHash: hexToBytes(headerHash),
        startKey: hexToBytes(startKey),
        endKey: hexToBytes(endKey),
        maximumSize: BigInt(maximumSize),
      })
    } catch (error) {
      logger.error('[CE129] Unexpected error in deserializeRequest', {
        dataLength: data.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(
              `Unexpected error in deserializeRequest: ${String(error)}`,
            ),
      )
    }
  }

  /**
   * Serialize state response message
   */
  serializeResponse(response: StateResponse): Safe<Uint8Array> {
    try {
      // Calculate total size
      const parts: Uint8Array[] = []
      const [error, numberOfBoundaryNodes] = encodeFixedLength(
        BigInt(response.boundaryNodes.length),
        4n,
      )
      if (error) {
        logger.error(
          '[CE129] Failed to encode number of boundary nodes in serializeResponse',
          {
            boundaryNodesCount: response.boundaryNodes.length,
            error: error.message,
          },
        )
        return safeError(error)
      }
      parts.push(numberOfBoundaryNodes)
      for (const node of response.boundaryNodes) {
        if (node.length !== 32) {
          const error = new Error(
            `Invalid boundary node length: expected 32 bytes, got ${node.length}`,
          )
          logger.error(
            '[CE129] Invalid boundary node length in serializeResponse',
            {
              expectedLength: 32,
              actualLength: node.length,
              error: error.message,
            },
          )
          return safeError(error)
        }
        parts.push(node)
      }
      const [error2, numberOfKeyValuePairs] = encodeFixedLength(
        BigInt(response.keyValuePairs.length),
        4n,
      )
      if (error2) {
        logger.error(
          '[CE129] Failed to encode number of key-value pairs in serializeResponse',
          {
            keyValuePairsCount: response.keyValuePairs.length,
            error: error2.message,
          },
        )
        return safeError(error2)
      }
      parts.push(numberOfKeyValuePairs)
      for (let i = 0; i < response.keyValuePairs.length; i++) {
        const pair = response.keyValuePairs[i]
        const [error3, key] = encodeFixedLength(BigInt(pair.key.length), 4n)
        if (error3) {
          logger.error(
            '[CE129] Failed to encode key length in serializeResponse',
            {
              pairIndex: i,
              keyLength: pair.key.length,
              error: error3.message,
            },
          )
          return safeError(error3)
        }
        parts.push(key)
        const [error4, value] = encodeFixedLength(BigInt(pair.value.length), 4n)
        if (error4) {
          logger.error(
            '[CE129] Failed to encode value length in serializeResponse',
            {
              pairIndex: i,
              valueLength: pair.value.length,
              error: error4.message,
            },
          )
          return safeError(error4)
        }
        parts.push(value)
      }
      return safeResult(concatBytes(parts))
    } catch (error) {
      logger.error('[CE129] Unexpected error in serializeResponse', {
        boundaryNodesCount: response.boundaryNodes.length,
        keyValuePairsCount: response.keyValuePairs.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(
              `Unexpected error in serializeResponse: ${String(error)}`,
            ),
      )
    }
  }

  /**
   * Deserialize state response message
   */
  deserializeResponse(data: Uint8Array): Safe<StateResponse> {
    try {
      if (data.length === 0) {
        const error = new Error('Empty state response data')
        logger.error(
          '[CE129] Failed to deserialize state response: empty data',
          {
            error: error.message,
          },
        )
        return safeError(error)
      }

      let currentData = data
      const [error, numberOfBoundaryNodes] = decodeFixedLength(currentData, 4n)
      if (error) {
        logger.error(
          '[CE129] Failed to decode number of boundary nodes in deserializeResponse',
          {
            dataLength: data.length,
            error: error.message,
          },
        )
        return safeError(error)
      }
      currentData = currentData.slice(4)
      const boundaryNodes: Uint8Array[] = []

      // Check if we have enough data for all boundary nodes
      const requiredBytesForBoundaryNodes =
        Number(numberOfBoundaryNodes.value) * 32
      if (currentData.length < requiredBytesForBoundaryNodes) {
        const error = new Error(
          `Insufficient data for boundary nodes: expected ${requiredBytesForBoundaryNodes} bytes, got ${currentData.length}`,
        )
        logger.error(
          '[CE129] Failed to deserialize state response: insufficient data for boundary nodes',
          {
            expectedBytes: requiredBytesForBoundaryNodes,
            actualBytes: currentData.length,
            numberOfBoundaryNodes: numberOfBoundaryNodes.value.toString(),
            error: error.message,
          },
        )
        return safeError(error)
      }

      for (let i = 0; i < numberOfBoundaryNodes.value; i++) {
        const node = currentData.slice(0, 32)
        if (node.length !== 32) {
          const error = new Error(
            `Invalid boundary node length at index ${i}: expected 32 bytes, got ${node.length}`,
          )
          logger.error(
            '[CE129] Invalid boundary node length in deserializeResponse',
            {
              nodeIndex: i,
              expectedLength: 32,
              actualLength: node.length,
              error: error.message,
            },
          )
          return safeError(error)
        }
        currentData = currentData.slice(32)
        boundaryNodes.push(node)
      }

      if (currentData.length < 4) {
        const error = new Error(
          `Insufficient data for number of key-value pairs: expected at least 4 bytes, got ${currentData.length}`,
        )
        logger.error(
          '[CE129] Failed to deserialize state response: insufficient data for key-value pairs count',
          {
            remainingDataLength: currentData.length,
            error: error.message,
          },
        )
        return safeError(error)
      }

      const [error2, numberOfKeyValuePairs] = decodeFixedLength(currentData, 4n)
      if (error2) {
        logger.error(
          '[CE129] Failed to decode number of key-value pairs in deserializeResponse',
          {
            remainingDataLength: currentData.length,
            error: error2.message,
          },
        )
        return safeError(error2)
      }
      currentData = currentData.slice(4)

      // Check if we have enough data for all key-value pairs
      // Each pair has: key length (4 bytes) + key + value length (4 bytes) + value
      // For now, we'll validate as we go
      const keyValuePairs: Array<{ key: Uint8Array; value: Uint8Array }> = []
      for (let i = 0; i < numberOfKeyValuePairs.value; i++) {
        if (currentData.length < 4) {
          const error = new Error(
            `Insufficient data for key length at pair ${i}: expected at least 4 bytes, got ${currentData.length}`,
          )
          logger.error(
            '[CE129] Failed to deserialize state response: insufficient data for key length',
            {
              pairIndex: i,
              totalPairs: numberOfKeyValuePairs.value.toString(),
              remainingDataLength: currentData.length,
              error: error.message,
            },
          )
          return safeError(error)
        }

        const [keyLengthError, keyLengthResult] = decodeFixedLength(
          currentData,
          4n,
        )
        if (keyLengthError) {
          logger.error(
            '[CE129] Failed to decode key length in deserializeResponse',
            {
              pairIndex: i,
              error: keyLengthError.message,
            },
          )
          return safeError(keyLengthError)
        }
        currentData = keyLengthResult.remaining
        const keyLength = Number(keyLengthResult.value)

        if (currentData.length < keyLength) {
          const error = new Error(
            `Insufficient data for key at pair ${i}: expected ${keyLength} bytes, got ${currentData.length}`,
          )
          logger.error(
            '[CE129] Failed to deserialize state response: insufficient data for key',
            {
              pairIndex: i,
              expectedKeyLength: keyLength,
              actualRemainingData: currentData.length,
              error: error.message,
            },
          )
          return safeError(error)
        }

        const key = currentData.slice(0, keyLength)
        currentData = currentData.slice(keyLength)

        if (currentData.length < 4) {
          const error = new Error(
            `Insufficient data for value length at pair ${i}: expected at least 4 bytes, got ${currentData.length}`,
          )
          logger.error(
            '[CE129] Failed to deserialize state response: insufficient data for value length',
            {
              pairIndex: i,
              remainingDataLength: currentData.length,
              error: error.message,
            },
          )
          return safeError(error)
        }

        const [valueLengthError, valueLengthResult] = decodeFixedLength(
          currentData,
          4n,
        )
        if (valueLengthError) {
          logger.error(
            '[CE129] Failed to decode value length in deserializeResponse',
            {
              pairIndex: i,
              error: valueLengthError.message,
            },
          )
          return safeError(valueLengthError)
        }
        currentData = valueLengthResult.remaining
        const valueLength = Number(valueLengthResult.value)

        if (currentData.length < valueLength) {
          const error = new Error(
            `Insufficient data for value at pair ${i}: expected ${valueLength} bytes, got ${currentData.length}`,
          )
          logger.error(
            '[CE129] Failed to deserialize state response: insufficient data for value',
            {
              pairIndex: i,
              expectedValueLength: valueLength,
              actualRemainingData: currentData.length,
              error: error.message,
            },
          )
          return safeError(error)
        }

        const value = currentData.slice(0, valueLength)
        currentData = currentData.slice(valueLength)
        keyValuePairs.push({ key, value })
      }

      logger.debug('[CE129] Successfully deserialized state response', {
        boundaryNodesCount: boundaryNodes.length,
        keyValuePairsCount: keyValuePairs.length,
        totalDataLength: data.length,
      })

      return safeResult({
        boundaryNodes,
        keyValuePairs,
      })
    } catch (error) {
      logger.error('[CE129] Unexpected error in deserializeResponse', {
        dataLength: data.length,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      })
      return safeError(
        error instanceof Error
          ? error
          : new Error(
              `Unexpected error in deserializeResponse: ${String(error)}`,
            ),
      )
    }
  }
}
