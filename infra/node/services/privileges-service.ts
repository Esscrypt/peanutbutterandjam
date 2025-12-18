/**
 * Privileges Service
 *
 * Manages privileged service indices according to Gray Paper specifications.
 *
 * Gray Paper Reference: accounts.tex (Equation 168-181)
 * privileges ≡ tuple{manager, delegator, registrar, assigners, alwaysaccers}
 *
 * Operations:
 * - Manager: Service able to alter privileges and bestow storage deposit credits
 * - Delegator: Service able to set staging set (validator keys)
 * - Registrar: Service able to create new service accounts in protected range
 * - Assigners: Services capable of altering authorizer queue (one per core)
 * - Always Accers: Services that automatically accumulate with basic gas
 */

import { logger } from '@pbnjam/core'
import { BaseService, type Privileges } from '@pbnjam/types'
import type { ConfigService } from './config-service'

/**
 * Privileges Service Interface
 */
export interface IPrivilegesService {
  getPrivileges(): Privileges
  setPrivileges(privileges: Privileges): void

  // Manager operations
  getManager(): bigint
  setManager(serviceId: bigint): void

  // Delegator operations
  getDelegator(): bigint
  setDelegator(serviceId: bigint): void

  // Registrar operations
  getRegistrar(): bigint
  setRegistrar(serviceId: bigint): void

  // Assigner operations
  getAssigners(): bigint[]
  setAssigners(assigners: bigint[]): void
  getAssignerForCore(coreIndex: bigint): bigint | undefined
  setAssignerForCore(coreIndex: bigint, serviceId: bigint): void

  // Always Accers operations
  getAlwaysAccers(): Map<bigint, bigint>
  setAlwaysAccers(alwaysAccers: Map<bigint, bigint>): void
  addAlwaysAccer(serviceId: bigint, gasLimit: bigint): void
  removeAlwaysAccer(serviceId: bigint): void
  getGasLimitForService(serviceId: bigint): bigint | undefined

  // Validation
  validatePrivileges(): boolean
  isServicePrivileged(serviceId: bigint): boolean
}

/**
 * Privileges Service Implementation
 */
export class PrivilegesService
  extends BaseService
  implements IPrivilegesService
{
  private privileges: Privileges
  private readonly configService: ConfigService

  constructor(options: { configService: ConfigService }) {
    super('privileges-service')
    this.configService = options.configService
    this.privileges = {
      manager: 0n,
      delegator: 0n,
      registrar: 0n,
      assigners: [],
      alwaysaccers: new Map<bigint, bigint>(),
    }
  }

  /**
   * Get current privileges state
   *
   * Gray Paper: privileges ≡ tuple{manager, delegator, registrar, assigners, alwaysaccers}
   */
  getPrivileges(): Privileges {
    return this.privileges
  }

  /**
   * Set privileges state
   *
   * Gray Paper: privileges ≡ tuple{manager, delegator, registrar, assigners, alwaysaccers}
   */
  setPrivileges(privileges: Privileges): void {
    this.privileges = privileges
  }

  /**
   * Get manager service ID
   *
   * Gray Paper: manager ∈ serviceid
   */
  getManager(): bigint {
    return this.privileges.manager
  }

  /**
   * Set manager service ID
   *
   * Gray Paper: manager ∈ serviceid
   */
  setManager(serviceId: bigint): void {
    this.privileges.manager = serviceId
  }

  /**
   * Get delegator service ID
   *
   * Gray Paper: delegator ∈ serviceid
   */
  getDelegator(): bigint {
    return this.privileges.delegator
  }

  /**
   * Set delegator service ID
   *
   * Gray Paper: delegator ∈ serviceid
   */
  setDelegator(serviceId: bigint): void {
    this.privileges.delegator = serviceId
  }

  /**
   * Get registrar service ID
   *
   * Gray Paper: registrar ∈ serviceid
   */
  getRegistrar(): bigint {
    return this.privileges.registrar
  }

  /**
   * Set registrar service ID
   *
   * Gray Paper: registrar ∈ serviceid
   */
  setRegistrar(serviceId: bigint): void {
    this.privileges.registrar = serviceId
  }

  /**
   * Get assigner services array
   *
   * Gray Paper: assigners ∈ sequence[Ccorecount]{serviceid}
   */
  getAssigners(): bigint[] {
    return this.privileges.assigners
  }

  /**
   * Set assigner services array
   *
   * Gray Paper: assigners ∈ sequence[Ccorecount]{serviceid}
   */
  setAssigners(assigners: bigint[]): void {
    this.privileges.assigners = assigners
  }

  /**
   * Get assigner service for specific core
   *
   * Gray Paper: assigners ∈ sequence[Ccorecount]{serviceid}
   */
  getAssignerForCore(coreIndex: bigint): bigint | undefined {
    const index = Number(coreIndex)
    return this.privileges.assigners[index]
  }

  /**
   * Set assigner service for specific core
   *
   * Gray Paper: assigners ∈ sequence[Ccorecount]{serviceid}
   */
  setAssignerForCore(coreIndex: bigint, serviceId: bigint): void {
    const index = Number(coreIndex)

    // Ensure assigners array is large enough
    while (this.privileges.assigners.length <= index) {
      this.privileges.assigners.push(0n)
    }

    this.privileges.assigners[index] = serviceId
    logger.debug('Assigner for core updated', {
      coreIndex: coreIndex.toString(),
      serviceId: serviceId.toString(),
    })
  }

  /**
   * Get always accers dictionary
   *
   * Gray Paper: alwaysaccers ∈ dictionary{serviceid}{gas}
   */
  getAlwaysAccers(): Map<bigint, bigint> {
    return this.privileges.alwaysaccers
  }

  /**
   * Set always accers dictionary
   *
   * Gray Paper: alwaysaccers ∈ dictionary{serviceid}{gas}
   */
  setAlwaysAccers(alwaysAccers: Map<bigint, bigint>): void {
    this.privileges.alwaysaccers = alwaysAccers
  }

  /**
   * Add always accer service
   *
   * Gray Paper: alwaysaccers ∈ dictionary{serviceid}{gas}
   */
  addAlwaysAccer(serviceId: bigint, gasLimit: bigint): void {
    this.privileges.alwaysaccers.set(serviceId, gasLimit)
  }

  /**
   * Remove always accer service
   */
  removeAlwaysAccer(serviceId: bigint): void {
    this.privileges.alwaysaccers.delete(serviceId)
  }

  /**
   * Get gas limit for always accer service
   *
   * Gray Paper: alwaysaccers ∈ dictionary{serviceid}{gas}
   */
  getGasLimitForService(serviceId: bigint): bigint | undefined {
    return this.privileges.alwaysaccers.get(serviceId)
  }

  /**
   * Validate privileges structure
   */
  validatePrivileges(): boolean {
    try {
      // Check that assigners array has correct length
      const expectedLength = this.configService.numCores
      if (this.privileges.assigners.length !== expectedLength) {
        logger.warn('Invalid assigners length', {
          expected: expectedLength,
          actual: this.privileges.assigners.length,
        })
        return false
      }

      // Check that all service IDs are valid (non-negative)
      const allServiceIds = [
        this.privileges.manager,
        this.privileges.delegator,
        this.privileges.registrar,
        ...this.privileges.assigners,
        ...this.privileges.alwaysaccers.keys(),
      ]

      for (const serviceId of allServiceIds) {
        if (serviceId < 0n) {
          logger.warn('Invalid service ID', { serviceId: serviceId.toString() })
          return false
        }
      }

      return true
    } catch (error) {
      logger.error('Error validating privileges', { error })
      return false
    }
  }

  /**
   * Check if service has any privileges
   */
  isServicePrivileged(serviceId: bigint): boolean {
    return (
      this.privileges.manager === serviceId ||
      this.privileges.delegator === serviceId ||
      this.privileges.registrar === serviceId ||
      this.privileges.assigners.includes(serviceId) ||
      this.privileges.alwaysaccers.has(serviceId)
    )
  }
}
