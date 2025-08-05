/**
 * Network Types for JAM Protocol
 *
 * Types for network communication and protocol messages
 * Reference: Gray Paper network specifications
 */

import type { Bytes } from './core'

/**
 * Network message types
 */
export enum MessageType {
  BLOCK_ANNOUNCE = 0x01,
  BLOCK_REQUEST = 0x02,
  BLOCK_RESPONSE = 0x03,
  EXTRINSIC_ANNOUNCE = 0x04,
  EXTRINSIC_REQUEST = 0x05,
  EXTRINSIC_RESPONSE = 0x06,
  WORK_PACKAGE_ANNOUNCE = 0x07,
  WORK_PACKAGE_REQUEST = 0x08,
  WORK_PACKAGE_RESPONSE = 0x09,
  TICKET_ANNOUNCE = 0x0a,
  TICKET_REQUEST = 0x0b,
  TICKET_RESPONSE = 0x0c,
  STATE_REQUEST = 0x0d,
  STATE_RESPONSE = 0x0e,
  PING = 0x0f,
  PONG = 0x10,
}

/**
 * Base network message interface
 */
export interface NetworkMessage {
  /** Message type */
  type: MessageType
  /** Message payload */
  payload: Bytes
  /** Message timestamp */
  timestamp: number
  /** Message signature */
  signature?: Bytes
  /** Message sequence number */
  sequence?: number
}

/**
 * Block announce message
 */
export interface BlockAnnounceMessage extends NetworkMessage {
  type: MessageType.BLOCK_ANNOUNCE
  payload: Bytes // Block header hash
}

/**
 * Block request message
 */
export interface BlockRequestMessage extends NetworkMessage {
  type: MessageType.BLOCK_REQUEST
  payload: Bytes // Block hash
}

/**
 * Block response message
 */
export interface BlockResponseMessage extends NetworkMessage {
  type: MessageType.BLOCK_RESPONSE
  payload: Bytes // Full block data
}

/**
 * Extrinsic announce message
 */
export interface ExtrinsicAnnounceMessage extends NetworkMessage {
  type: MessageType.EXTRINSIC_ANNOUNCE
  payload: Bytes // Extrinsic hash
}

/**
 * Extrinsic request message
 */
export interface ExtrinsicRequestMessage extends NetworkMessage {
  type: MessageType.EXTRINSIC_REQUEST
  payload: Bytes // Extrinsic hash
}

/**
 * Extrinsic response message
 */
export interface ExtrinsicResponseMessage extends NetworkMessage {
  type: MessageType.EXTRINSIC_RESPONSE
  payload: Bytes // Full extrinsic data
}

/**
 * Work package announce message
 */
export interface WorkPackageAnnounceMessage extends NetworkMessage {
  type: MessageType.WORK_PACKAGE_ANNOUNCE
  payload: Bytes // Work package hash
}

/**
 * Work package request message
 */
export interface WorkPackageRequestMessage extends NetworkMessage {
  type: MessageType.WORK_PACKAGE_REQUEST
  payload: Bytes // Work package hash
}

/**
 * Work package response message
 */
export interface WorkPackageResponseMessage extends NetworkMessage {
  type: MessageType.WORK_PACKAGE_RESPONSE
  payload: Bytes // Full work package data
}

/**
 * Ticket announce message
 */
export interface TicketAnnounceMessage extends NetworkMessage {
  type: MessageType.TICKET_ANNOUNCE
  payload: Bytes // Ticket hash
}

/**
 * Ticket request message
 */
export interface TicketRequestMessage extends NetworkMessage {
  type: MessageType.TICKET_REQUEST
  payload: Bytes // Ticket hash
}

/**
 * Ticket response message
 */
export interface TicketResponseMessage extends NetworkMessage {
  type: MessageType.TICKET_RESPONSE
  payload: Bytes // Full ticket data
}

/**
 * State request message
 */
export interface StateRequestMessage extends NetworkMessage {
  type: MessageType.STATE_REQUEST
  payload: Bytes // State root hash
}

/**
 * State response message
 */
export interface StateResponseMessage extends NetworkMessage {
  type: MessageType.STATE_RESPONSE
  payload: Bytes // Full state data
}

/**
 * Ping message
 */
export interface PingMessage extends NetworkMessage {
  type: MessageType.PING
  payload: Bytes // Ping data
}

/**
 * Pong message
 */
export interface PongMessage extends NetworkMessage {
  type: MessageType.PONG
  payload: Bytes // Pong data
}

/**
 * Union type for all network messages
 */
export type AnyNetworkMessage =
  | BlockAnnounceMessage
  | BlockRequestMessage
  | BlockResponseMessage
  | ExtrinsicAnnounceMessage
  | ExtrinsicRequestMessage
  | ExtrinsicResponseMessage
  | WorkPackageAnnounceMessage
  | WorkPackageRequestMessage
  | WorkPackageResponseMessage
  | TicketAnnounceMessage
  | TicketRequestMessage
  | TicketResponseMessage
  | StateRequestMessage
  | StateResponseMessage
  | PingMessage
  | PongMessage

/**
 * Network peer information
 */
export interface NetworkPeer {
  /** Peer ID */
  id: string
  /** Peer address */
  address: string
  /** Peer port */
  port: number
  /** Peer public key */
  publicKey: Bytes
  /** Connection status */
  connected: boolean
  /** Last seen timestamp */
  lastSeen: number
  /** Peer capabilities */
  capabilities: string[]
}

/**
 * Network connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
}

/**
 * Network statistics
 */
export interface NetworkStats {
  /** Total peers */
  totalPeers: number
  /** Connected peers */
  connectedPeers: number
  /** Messages sent */
  messagesSent: number
  /** Messages received */
  messagesReceived: number
  /** Bytes sent */
  bytesSent: number
  /** Bytes received */
  bytesReceived: number
  /** Average latency */
  averageLatency: number
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Listen address */
  listenAddress: string
  /** Listen port */
  listenPort: number
  /** Maximum peers */
  maxPeers: number
  /** Connection timeout */
  connectionTimeout: number
  /** Message timeout */
  messageTimeout: number
  /** Enable discovery */
  enableDiscovery: boolean
  /** Enable relay */
  enableRelay: boolean
}
