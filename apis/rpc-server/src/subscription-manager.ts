import { randomUUID } from 'node:crypto'
import { logger } from '@pbnjam/core'
import type { RpcParams, RpcResult, Subscription, WebSocket } from './types'

export class SubscriptionManager {
  private subscriptions = new Map<string, Subscription>()
  private wsSubscriptions = new Map<WebSocket, Set<string>>()

  addSubscription(ws: WebSocket, type: string, params?: RpcParams): string {
    const id = randomUUID()
    const subscription: Subscription = {
      id,
      type,
      params,
      ws,
    }

    this.subscriptions.set(id, subscription)

    // Track subscriptions per WebSocket connection
    if (!this.wsSubscriptions.has(ws)) {
      this.wsSubscriptions.set(ws, new Set())
    }
    this.wsSubscriptions.get(ws)!.add(id)

    logger.debug('Added subscription', { id, type, params })
    return id
  }

  removeSubscription(id: string): boolean {
    const subscription = this.subscriptions.get(id)
    if (!subscription) {
      return false
    }

    // Remove from WebSocket tracking
    const wsSubs = this.wsSubscriptions.get(subscription.ws)
    if (wsSubs) {
      wsSubs.delete(id)
      if (wsSubs.size === 0) {
        this.wsSubscriptions.delete(subscription.ws)
      }
    }

    this.subscriptions.delete(id)
    logger.debug('Removed subscription', { id })
    return true
  }

  removeSubscriptions(ws: WebSocket): void {
    const wsSubs = this.wsSubscriptions.get(ws)
    if (!wsSubs) {
      return
    }

    // Remove all subscriptions for this WebSocket
    for (const id of wsSubs) {
      this.subscriptions.delete(id)
    }
    this.wsSubscriptions.delete(ws)

    logger.debug('Removed all subscriptions for WebSocket', {
      subscriptionCount: wsSubs.size,
    })
  }

  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id)
  }

  getSubscriptionsByType(type: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.type === type,
    )
  }

  getSubscriptionsByWebSocket(ws: WebSocket): Subscription[] {
    const wsSubs = this.wsSubscriptions.get(ws)
    if (!wsSubs) {
      return []
    }

    return Array.from(wsSubs).map((id) => this.subscriptions.get(id)!)
  }

  broadcastToType(type: string, data: RpcResult): void {
    const subscriptions = this.getSubscriptionsByType(type)

    for (const subscription of subscriptions) {
      try {
        const notification = {
          jsonrpc: '2.0',
          method: type,
          params: data,
        }

        subscription.ws.send(JSON.stringify(notification))
      } catch (error) {
        logger.error('Failed to send notification', {
          subscriptionId: subscription.id,
          error,
        })
        // Remove failed subscription
        this.removeSubscription(subscription.id)
      }
    }

    logger.debug('Broadcasted to subscriptions', {
      type,
      subscriptionCount: subscriptions.length,
    })
  }

  broadcastToSubscription(id: string, data: RpcResult): boolean {
    const subscription = this.getSubscription(id)
    if (!subscription) {
      return false
    }

    try {
      const notification = {
        jsonrpc: '2.0',
        method: subscription.type,
        params: data,
      }

      subscription.ws.send(JSON.stringify(notification))
      logger.debug('Sent notification to subscription', { id })
      return true
    } catch (error) {
      logger.error('Failed to send notification to subscription', {
        id,
        error,
      })
      this.removeSubscription(id)
      return false
    }
  }

  getStats(): {
    total: number
    byType: Record<string, number>
    byWebSocket: number
  } {
    const byType: Record<string, number> = {}

    for (const subscription of this.subscriptions.values()) {
      byType[subscription.type] = (byType[subscription.type] || 0) + 1
    }

    return {
      total: this.subscriptions.size,
      byType,
      byWebSocket: this.wsSubscriptions.size,
    }
  }

  // Cleanup method to remove stale subscriptions
  cleanup(): void {
    const beforeCount = this.subscriptions.size

    for (const [id, subscription] of this.subscriptions.entries()) {
      try {
        // Try to send a ping to check if connection is still alive
        subscription.ws.ping()
      } catch (_error) {
        // Connection is dead, remove subscription
        this.removeSubscription(id)
      }
    }

    const afterCount = this.subscriptions.size
    if (beforeCount !== afterCount) {
      logger.info('Cleaned up stale subscriptions', {
        removed: beforeCount - afterCount,
      })
    }
  }
}
