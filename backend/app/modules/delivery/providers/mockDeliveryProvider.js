export const mockDeliveryProvider = {
  name: "mock",

  async createShipment(context) {
    const orderId = context?.orderId || "unknown";
    return {
      externalId: `mock_${orderId}`,
      trackingUrl: `https://tracking.example/mock/${encodeURIComponent(String(orderId))}`,
      label: null,
      providerStatus: "CREATED",
      meta: { mock: true },
    };
  },

  async cancelShipment() {
    return { cancelled: true };
  },

  async getTrackingInfo() {
    return {
      providerStatus: "IN_TRANSIT",
      location: "Mock City",
      etaTimestamp: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      events: [{ at: new Date().toISOString(), status: "IN_TRANSIT" }],
    };
  },

  async getETA() {
    return { etaMinutes: 30, etaTimestamp: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
  },

  async getQuote() {
    return { providerName: "mock", price: 1, currency: "INR", estimatedMinutes: 30, validUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
  },

  mapStatus() {
    return null;
  },

  parseWebhookPayload() {
    return { orderId: null, externalId: null, providerStatus: null, meta: { mock: true } };
  },

  verifyWebhookSignature() {
    return true;
  },

  async refreshToken() {},

  async emitDeliveryBroadcastForSeller() {},
  async retractDeliveryBroadcastForOrder() {
    return { removedCount: 0 };
  },
  async emitReturnBroadcastForCustomer() {},
  async emitToDelivery() {},
};

