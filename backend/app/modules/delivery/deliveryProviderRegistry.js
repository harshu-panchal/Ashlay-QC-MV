import { getDeliveryProviderName } from "./deliveryFlags.js";
import { noopDeliveryProvider } from "./providers/noopDeliveryProvider.js";
import { shiprocketProvider } from "./providers/shiprocket/shiprocketProvider.js";

const internalDeliveryProvider = {
  name: "internal",
  async createShipment() {
    return { externalId: null, trackingUrl: null, label: null, providerStatus: null };
  },
  async cancelShipment() {
    return { cancelled: false, reason: "unsupported" };
  },
  async getTrackingInfo() {
    return { providerStatus: null, location: null, etaTimestamp: null, events: [] };
  },
  async getETA() {
    return { etaMinutes: null, etaTimestamp: null };
  },
  async getQuote() {
    return { providerName: "internal", price: null, currency: null, estimatedMinutes: null, validUntil: null };
  },
  mapStatus() {
    return null;
  },
  parseWebhookPayload() {
    return { orderId: null, externalId: null, providerStatus: null };
  },
  verifyWebhookSignature() {
    return false;
  },
  async refreshToken() {},
  async emitDeliveryBroadcastForSeller(sellerId, payload) {
    const mod = await import("../../services/orderSocketEmitter.js");
    return mod.emitDeliveryBroadcastForSeller(sellerId, payload);
  },
  async retractDeliveryBroadcastForOrder(orderId, winnerDeliveryId) {
    const mod = await import("../../services/orderSocketEmitter.js");
    return mod.retractDeliveryBroadcastForOrder(orderId, winnerDeliveryId);
  },
  async emitReturnBroadcastForCustomer(customerLocation, payload) {
    const mod = await import("../../services/orderSocketEmitter.js");
    return mod.emitReturnBroadcastForCustomer(customerLocation, payload);
  },
  emitToDelivery(deliveryId, { event, payload }) {
    // intentionally not async â€” used in hot paths
    // NOTE: this will throw if imported while delivery sockets are not wired.
    // Caller should guard via deliveryManager feature flags.
    return import("../../services/orderSocketEmitter.js").then((mod) =>
      mod.emitToDelivery(deliveryId, { event, payload }),
    );
  },
};

const PROVIDERS = new Map([
  ["internal", internalDeliveryProvider],
  ["shiprocket", shiprocketProvider],
  ["none", noopDeliveryProvider],
  ["disabled", noopDeliveryProvider],
  ["off", noopDeliveryProvider],
]);

export function getDeliveryProvider() {
  const key = getDeliveryProviderName();
  return PROVIDERS.get(key) || internalDeliveryProvider;
}

export function getDeliveryProviderByName(providerName) {
  const key = String(providerName || "").toLowerCase();
  if (!key) return internalDeliveryProvider;
  return PROVIDERS.get(key) || null;
}
