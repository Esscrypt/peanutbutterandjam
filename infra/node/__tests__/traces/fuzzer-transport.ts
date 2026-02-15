/**
 * Shared length-prefixed transport and fuzz message helpers for JAM conformance
 * fuzzer drivers (single-trace and multi-trace). Used by jam-conformance-trace-fuzzer-driver.ts
 * and jam-conformance-traces-fuzzer-driver.ts to avoid duplication and ensure consistent
 * behavior (e.g. sendRawMessage awaits write completion and surfaces errors).
 */

import * as net from 'node:net'

import { decodeFuzzMessage, encodeFuzzMessage } from '@pbnjam/codec'
import type { FuzzMessage, FuzzPeerInfo, JamVersion } from '@pbnjam/types'

import type { ConfigService } from '../../services/config-service'

const SOCKET_NOT_WRITABLE = 'Socket not writable or destroyed; message was not sent'

/** Send one length-prefixed message. Resolves when the write has been flushed; rejects on error or if socket is not writable/destroyed so callers do not assume success and desync the protocol. */
export function sendRawMessage(
  socket: net.Socket,
  message: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.destroyed || !socket.writable) {
      reject(new Error(SOCKET_NOT_WRITABLE))
      return
    }
    const onCloseOrError = (err?: Error) => {
      socket.removeListener('close', onClose)
      socket.removeListener('error', onError)
      reject(err ?? new Error(SOCKET_NOT_WRITABLE))
    }
    const onClose = () => onCloseOrError()
    const onError = (err: Error) => onCloseOrError(err)
    socket.once('close', onClose)
    socket.once('error', onError)

    const lengthBytes = Buffer.alloc(4)
    lengthBytes.writeUInt32LE(message.length, 0)
    socket.write(
      Buffer.concat([lengthBytes, Buffer.from(message)]),
      (err) => {
        socket.removeListener('close', onClose)
        socket.removeListener('error', onError)
        if (err) {
          reject(err)
          return
        }
        resolve()
      },
    )
  })
}

/** Read one length-prefixed message. */
export function readRawMessage(socket: net.Socket): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let lengthBytes = Buffer.alloc(0)
    let expectedLength = 0

    const cleanup = () => {
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
      socket.removeListener('close', onClose)
      socket.removeListener('end', onClose)
    }

    const onData = (data: Buffer) => {
      lengthBytes = Buffer.concat([lengthBytes, data])
      if (lengthBytes.length < 4) return
      if (expectedLength === 0) {
        expectedLength = lengthBytes.readUInt32LE(0)
        lengthBytes = lengthBytes.subarray(4)
      }
      if (lengthBytes.length >= expectedLength) {
        cleanup()
        resolve(new Uint8Array(lengthBytes.subarray(0, expectedLength)))
      }
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onClose = () => {
      cleanup()
      reject(new Error('Socket closed before message was fully received'))
    }

    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('close', onClose)
    socket.on('end', onClose)
  })
}

/** Encode and send one fuzz message. Caller should await readFuzzMessage before sending again (strict request-response). */
export async function sendFuzzMessage(
  socket: net.Socket,
  msg: FuzzMessage,
  codecConfig: ConfigService,
): Promise<void> {
  const encoded = encodeFuzzMessage(msg, codecConfig)
  await sendRawMessage(socket, encoded)
}

/** Read and decode one fuzz message. */
export async function readFuzzMessage(
  socket: net.Socket,
  codecConfig: ConfigService,
): Promise<FuzzMessage> {
  const data = await readRawMessage(socket)
  return decodeFuzzMessage(data, codecConfig)
}

/** Build PeerInfo for the fuzzer handshake. appName identifies the driver (e.g. 'pbnj-trace-fuzzer-driver' vs 'pbnj-traces-fuzzer-driver'). */
export function buildPeerInfo(
  jamVersion: JamVersion,
  appName: string,
): FuzzPeerInfo {
  return {
    fuzz_version: 1,
    fuzz_features: 0,
    jam_version: jamVersion,
    app_version: { major: 0, minor: 0, patch: 1 },
    app_name: appName,
  }
}
