import type { KeyPair } from './core'

export interface ValidatorCredentials {
  bandersnatchKeyPair: KeyPair
  ed25519KeyPair: KeyPair
  blsKeyPair: KeyPair
  seed: Uint8Array
  metadata: Uint8Array
}
