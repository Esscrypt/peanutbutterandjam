import { type Safe, type SafePromise, safeError } from '@pbnj/core'
import type { StreamInfo } from '@pbnj/types'

export abstract class NetworkingProtocol<TRequest, TResponse> {
  //   handleIncomingMessage(validatorIndex: bigint, streamKind: StreamKind, data: Uint8Array): StreamHandler
  abstract serializeRequest(data: TRequest): Safe<Uint8Array>

  abstract deserializeRequest(data: Uint8Array): Safe<TRequest>

  abstract serializeResponse(data: TResponse): Safe<Uint8Array>

  abstract deserializeResponse(data: Uint8Array): Safe<TResponse>

  abstract processRequest(data: TRequest): SafePromise<TResponse>

  abstract processResponse(data: TResponse): SafePromise<void>

  async handleStreamData(
    _stream: StreamInfo,
    data: Uint8Array,
  ): SafePromise<TResponse> {
    const [error, request] = this.deserializeRequest(data)
    if (error) {
      return safeError(error)
    }
    return this.processRequest(request)
  }

  async handleResponseStreamData(
    _stream: StreamInfo,
    data: Uint8Array,
  ): SafePromise<void> {
    const [error, response] = this.deserializeResponse(data)
    if (error) {
      return safeError(error)
    }
    return this.processResponse(response)
  }
}
