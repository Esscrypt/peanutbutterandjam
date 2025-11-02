import { generateEntropyVRFSignature } from '@pbnj/bandersnatch-vrf'
import {
  type IKeyPairService,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/types'

/**
 * Generate VRF signature (H_vrfsig) using safrole helper function
 *
 * Gray Paper Eq. 158: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
 * Where Xentropy = "$jam_entropy"
 *
 * Note: sealSignature parameter should be the VRF output hash from the seal signature (banderout result)
 */
export async function generateVRFSignature(
  sealSignature: Uint8Array,
  keyPairService: IKeyPairService,
): SafePromise<Uint8Array> {
  // Get author's Bandersnatch key
  const authorBandersnatchKey =
    keyPairService.getLocalKeyPair().bandersnatchKeyPair.privateKey
  if (!authorBandersnatchKey) {
    return safeError(
      new Error('No Bandersnatch secret key available for VRF generation'),
    )
  }

  // Use safrole helper function for entropy VRF signature generation
  // Gray Paper Eq. 158: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
  const [vrfError, vrfResult] = generateEntropyVRFSignature(
    authorBandersnatchKey,
    sealSignature, // This should be the VRF output hash from seal signature (banderout result)
  )
  if (vrfError) {
    return safeError(vrfError)
  }

  return safeResult(vrfResult.signature)
}
