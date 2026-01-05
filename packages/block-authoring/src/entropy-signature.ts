import {
  banderout,
  generateEntropyVRFSignature,
} from '@pbnjam/bandersnatch-vrf'
import {
  type IKeyPairService,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnjam/types'

/**
 * Generate VRF signature (H_vrfsig) using safrole helper function
 *
 * Gray Paper Eq. 158: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
 * Where Xentropy = "$jam_entropy"
 *
 * @param sealSignature - Full 96-byte seal signature (H_sealsig)
 * @param keyPairService - Key pair service for author's Bandersnatch key
 * @returns 96-byte VRF signature (H_vrfsig)
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
