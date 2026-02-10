import {
  banderout,
  generateEntropyVRFSignature,
} from '@pbnjam/bandersnatch-vrf'
import { getValidatorCredentialsWithFallback } from '@pbnjam/core'
import type {
  IConfigService,
  IKeyPairService,
  SafePromise,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'

/**
 * Generate VRF signature (H_vrfsig) using safrole helper function
 *
 * Gray Paper Eq. 158: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
 * Where Xentropy = "$jam_entropy"
 *
 * @param sealSignature - Full 96-byte seal signature (H_sealsig)
 * @param configService - Config service with optional validatorIndex
 * @param keyPairService - Key pair service (required if validatorIndex is not set)
 * @returns 96-byte VRF signature (H_vrfsig)
 */
export async function generateVRFSignature(
  sealSignature: Uint8Array,
  configService: IConfigService,
  keyPairService?: IKeyPairService,
): SafePromise<Uint8Array> {
  // Get author's Bandersnatch key using helper with fallback logic
  const [credentialsError, validatorCredentials] =
    getValidatorCredentialsWithFallback(configService, keyPairService)
  if (credentialsError || !validatorCredentials) {
    return safeError(
      credentialsError ||
        new Error('No validator credentials available for VRF generation'),
    )
  }

  const authorBandersnatchKey =
    validatorCredentials.bandersnatchKeyPair.privateKey
  if (!authorBandersnatchKey) {
    return safeError(
      new Error('No Bandersnatch secret key available for VRF generation'),
    )
  }

  // Extract banderout{H_sealsig} from the seal signature
  // Gray Paper: banderout{s ∈ bssignature{k}{c}{m}} ∈ hash ≡ text{output}(x | x ∈ bssignature{k}{c}{m})[:32]
  const [extractError, sealOutput] = banderout(sealSignature)
  if (extractError) {
    return safeError(extractError)
  }

  // Use safrole helper function for entropy VRF signature generation
  // Gray Paper Eq. 158: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
  const [vrfError, vrfResult] = generateEntropyVRFSignature(
    authorBandersnatchKey,
    sealOutput, // banderout{H_sealsig} - 32-byte VRF output hash
  )
  if (vrfError) {
    return safeError(vrfError)
  }

  return safeResult(vrfResult.signature)
}
