import { type Hex, type Safe, type SafePromise, safeError } from '@pbnj/core'

export abstract class NetworkingProtocol<TRequest, TResponse> {
  //   handleIncomingMessage(validatorIndex: bigint, streamKind: StreamKind, data: Uint8Array): StreamHandler
  abstract serializeRequest(data: TRequest): Safe<Uint8Array>

  abstract deserializeRequest(data: Uint8Array): Safe<TRequest>

  abstract serializeResponse(data: TResponse): Safe<Uint8Array>

  abstract deserializeResponse(data: Uint8Array): Safe<TResponse>

  abstract processRequest(
    data: TRequest,
    peerPublicKey: Hex,
  ): SafePromise<TResponse>

  abstract processResponse(
    data: TResponse,
    peerPublicKey: Hex,
  ): SafePromise<void>

  async handleStreamData(
    data: Uint8Array,
    peerPublicKey: Hex,
  ): SafePromise<TResponse> {
    const [error, request] = this.deserializeRequest(data)
    if (error) {
      return safeError(error)
    }
    return this.processRequest(request, peerPublicKey)
  }

  async handleResponseStreamData(
    data: Uint8Array,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    const [error, response] = this.deserializeResponse(data)
    if (error) {
      return safeError(error)
    }
    return this.processResponse(response, peerPublicKey)
  }
}
