import crypto from "crypto";

function safeJsonParse(rawBody) {
  try {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function timingSafeEqualHex(a, b) {
  try {
    const aa = Buffer.from(String(a || ""), "hex");
    const bb = Buffer.from(String(b || ""), "hex");
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export function verifyShiprocketWebhookSignature(rawBody, headers) {
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (!secret) return false;

  const sig =
    headers?.["x-shiprocket-signature"] ||
    headers?.["x-webhook-signature"] ||
    headers?.["x-signature"];
  if (!sig) return false;

  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ""), "utf8");
  const computed = crypto.createHmac("sha256", secret).update(bodyBuf).digest("hex");
  return timingSafeEqualHex(computed, String(sig).trim());
}

export function parseShiprocketWebhookPayload(rawBody) {
  const data = safeJsonParse(rawBody) || {};

  const orderId =
    data.order_id ??
    data.orderId ??
    data.order?.order_id ??
    data.order?.orderId ??
    null;

  const externalId =
    data.awb ??
    data.awb_code ??
    data.shipment_id ??
    data.shipmentId ??
    data.shipment?.id ??
    null;

  const providerStatus =
    data.current_status ??
    data.status ??
    data.shipment_status ??
    data.tracking_status ??
    null;

  const eventId = data.event_id ?? data.eventId ?? data.webhook_event_id ?? null;

  return {
    orderId: orderId != null ? String(orderId) : null,
    externalId: externalId != null ? String(externalId) : null,
    providerStatus: providerStatus != null ? String(providerStatus) : null,
    meta: {
      eventId: eventId != null ? String(eventId) : null,
      raw: data,
    },
  };
}

