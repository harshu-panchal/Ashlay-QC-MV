export const noopDeliveryProvider = {
  name: "none",
  async createShipment() {
    return { externalId: null, trackingUrl: null, label: null, providerStatus: null };
  },
  async cancelShipment() {
    return { cancelled: false, reason: "disabled" };
  },
  async getTrackingInfo() {
    return { providerStatus: null, location: null, etaTimestamp: null, events: [] };
  },
  async getETA() {
    return { etaMinutes: null, etaTimestamp: null };
  },
  async getQuote() {
    return { providerName: "none", price: null, currency: null, estimatedMinutes: null, validUntil: null };
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
  async emitDeliveryBroadcastForSeller() {},
  async retractDeliveryBroadcastForOrder() {
    return { removedCount: 0 };
  },
  async emitReturnBroadcastForCustomer() {},
  async emitToDelivery() {},
};
