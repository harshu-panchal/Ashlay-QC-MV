import { ShiprocketClient } from "./shiprocketClient.js";
import {
  parseShiprocketWebhookPayload,
  verifyShiprocketWebhookSignature,
} from "./shiprocketWebhookParser.js";
import { shiprocketStatusToWorkflowStatus } from "./shiprocketStatusMap.js";
import { ProviderError } from "../../ProviderError.js";

const client = new ShiprocketClient();

export const shiprocketProvider = {
  name: "shiprocket",

  async createShipment(context) {
    const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION;
    if (!pickupLocation) {
      throw new ProviderError(
        "CONFIG_MISSING",
        "Missing SHIPROCKET_PICKUP_LOCATION (must match Shiprocket pickup location name)",
      );
    }

    const orderId = context?.orderId;
    if (!orderId) throw new ProviderError("INVALID_CONTEXT", "orderId is required");

    const drop = context?.drop || {};
    const items = Array.isArray(context?.items) ? context.items : [];
    const total = Number(context?.totalValue || 0);

    const payload = {
      // Shiprocket expects many fields; keep this minimal + configurable.
      order_id: String(orderId),
      order_date: new Date().toISOString(),
      pickup_location: pickupLocation,

      billing_customer_name: drop.name || "Customer",
      billing_phone: drop.phone || "",
      billing_address: drop.address || "",
      billing_city: drop.city || "",
      billing_pincode: drop.pincode || "",
      billing_state: drop.state || "",
      billing_country: "India",

      shipping_is_billing: 1,

      order_items: items.map((it, idx) => ({
        name: it?.name || `Item ${idx + 1}`,
        sku: it?.sku || `SKU-${idx + 1}`,
        units: Number(it?.qty || 1),
        selling_price: Number(it?.value || 0),
      })),

      payment_method: (context?.paymentMode || "COD") === "PREPAID" ? "Prepaid" : "COD",
      sub_total: total,
    };

    const data = await client.request("post", "/orders/create/adhoc", payload);

    const externalId =
      data?.awb_code ??
      data?.awb ??
      data?.shipment_id ??
      data?.shipmentId ??
      data?.data?.awb_code ??
      null;

    const label =
      data?.label_url ??
      data?.label ??
      data?.data?.label_url ??
      null;

    const providerStatus =
      data?.status ??
      data?.current_status ??
      data?.data?.status ??
      "CREATED";

    return {
      externalId: externalId != null ? String(externalId) : null,
      trackingUrl: data?.tracking_url ?? data?.data?.tracking_url ?? null,
      label: label != null ? String(label) : null,
      providerStatus: providerStatus != null ? String(providerStatus) : null,
      meta: { raw: data },
    };
  },

  async cancelShipment() {
    // TODO: implement with Shiprocket cancellation API.
    return { cancelled: false, reason: "not_implemented" };
  },

  async getTrackingInfo() {
    // TODO: implement using Shiprocket tracking endpoint.
    return { providerStatus: null, location: null, etaTimestamp: null, events: [] };
  },

  async getETA() {
    return { etaMinutes: null, etaTimestamp: null };
  },

  async getQuote() {
    return {
      providerName: "shiprocket",
      price: null,
      currency: null,
      estimatedMinutes: null,
      validUntil: null,
    };
  },

  mapStatus(providerStatus) {
    return shiprocketStatusToWorkflowStatus(providerStatus);
  },

  parseWebhookPayload(rawBody) {
    return parseShiprocketWebhookPayload(rawBody);
  },

  verifyWebhookSignature(rawBody, headers) {
    return verifyShiprocketWebhookSignature(rawBody, headers);
  },

  async refreshToken() {
    await client.refreshToken();
  },

  // broadcasts: keep using internal emitter for now (Shiprocket doesn't do socket pushes)
  async emitDeliveryBroadcastForSeller() {},
  async retractDeliveryBroadcastForOrder() {
    return { removedCount: 0 };
  },
  async emitReturnBroadcastForCustomer() {},
  async emitToDelivery() {},
};
