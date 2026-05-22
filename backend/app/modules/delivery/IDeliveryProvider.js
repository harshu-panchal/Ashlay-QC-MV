/**
 * @file IDeliveryProvider.js
 *
 * JSDoc-only contract for delivery providers. Not runtime enforced.
 *
 * Rule: any unsupported method must return a safe default value (do not throw).
 */

/**
 * @typedef {Object} UnifiedShipmentResult
 * @property {string|null} externalId
 * @property {string|null} trackingUrl
 * @property {string|null} label
 * @property {string|null} providerStatus
 * @property {Object} [meta]
 */

/**
 * @typedef {Object} UnifiedCancelResult
 * @property {boolean} cancelled
 * @property {string} [reason]
 */

/**
 * @typedef {Object} UnifiedTrackingInfo
 * @property {string|null} providerStatus
 * @property {string|null} location
 * @property {string|null} etaTimestamp
 * @property {Array<Object>} events
 * @property {Object} [meta]
 */

/**
 * @typedef {Object} UnifiedETAResult
 * @property {number|null} etaMinutes
 * @property {string|null} etaTimestamp
 * @property {Object} [meta]
 */

/**
 * @typedef {Object} UnifiedQuoteResult
 * @property {string} providerName
 * @property {number|null} price
 * @property {string|null} currency
 * @property {Object} [breakdown]
 * @property {number|null} estimatedMinutes
 * @property {string|null} validUntil
 * @property {Object} [meta]
 */

/**
 * @typedef {Object} UnifiedWebhookEvent
 * @property {string|null} orderId
 * @property {string|null} externalId
 * @property {string|null} providerStatus
 * @property {Object} [meta]
 */

/**
 * @typedef {Object} DeliveryProviderContext
 * @property {string} orderId
 * @property {string} [orderMongoId]
 * @property {Object} [pickup]
 * @property {Object} [drop]
 * @property {Array<Object>} [items]
 * @property {"COD"|"PREPAID"} [paymentMode]
 * @property {number} [totalValue]
 * @property {number} [weight]
 * @property {string|null} [preferredProvider]
 * @property {string} [idempotencyKey]
 */

/**
 * @interface IDeliveryProvider
 *
 * All methods should resolve with a unified result or a safe default.
 * If a provider supports the operation but fails unexpectedly, it may throw.
 */
export const DELIVERY_PROVIDER_INTERFACE = {
  name: String,

  // Core lifecycle
  /** @param {DeliveryProviderContext} context @returns {Promise<UnifiedShipmentResult>} */
  createShipment: async () => ({ externalId: null, trackingUrl: null, label: null, providerStatus: null }),
  /** @param {DeliveryProviderContext} context @returns {Promise<UnifiedCancelResult>} */
  cancelShipment: async () => ({ cancelled: false, reason: "unsupported" }),
  /** @param {DeliveryProviderContext} context @returns {Promise<UnifiedTrackingInfo>} */
  getTrackingInfo: async () => ({ providerStatus: null, location: null, etaTimestamp: null, events: [] }),
  /** @param {DeliveryProviderContext} context @returns {Promise<UnifiedETAResult>} */
  getETA: async () => ({ etaMinutes: null, etaTimestamp: null }),
  /** @param {DeliveryProviderContext} context @returns {Promise<UnifiedQuoteResult>} */
  getQuote: async () => ({ providerName: "unknown", price: null, currency: null, estimatedMinutes: null, validUntil: null }),

  // Status normalization
  /** @param {string|null} providerStatus @returns {string|null} */
  mapStatus: () => null,

  // Webhook
  /** @param {Buffer|string} rawBody @param {Object} headers @returns {UnifiedWebhookEvent} */
  parseWebhookPayload: () => ({ orderId: null, externalId: null, providerStatus: null }),
  /** @param {Buffer|string} rawBody @param {Object} headers @returns {boolean} */
  verifyWebhookSignature: () => false,

  // Auth/token lifecycle
  /** @returns {Promise<void>} */
  refreshToken: async () => {},

  // Socket broadcasts (existing interface)
  emitDeliveryBroadcastForSeller: async () => {},
  retractDeliveryBroadcastForOrder: async () => ({ removedCount: 0 }),
  emitReturnBroadcastForCustomer: async () => {},
  emitToDelivery: async () => {},
};

