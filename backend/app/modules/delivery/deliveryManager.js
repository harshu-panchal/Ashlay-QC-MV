import { isDeliveryModuleEnabled } from "./deliveryFlags.js";
import { getDeliveryProvider } from "./deliveryProviderRegistry.js";
import { providerStatusToWorkflowStatus } from "./deliveryStatusMapping.js";

export function getActiveDeliveryProviderName() {
  return getDeliveryProvider().name;
}

function ensureEnabledOrThrow() {
  if (!isDeliveryModuleEnabled()) {
    const err = new Error("Delivery module is disabled");
    err.code = "DELIVERY_DISABLED";
    throw err;
  }
}

export async function createShipment(context) {
  ensureEnabledOrThrow();
  return getDeliveryProvider().createShipment(context);
}

export async function cancelShipment(context) {
  ensureEnabledOrThrow();
  return getDeliveryProvider().cancelShipment(context);
}

export async function getTrackingInfo(context) {
  ensureEnabledOrThrow();
  return getDeliveryProvider().getTrackingInfo(context);
}

export async function getETA(context) {
  ensureEnabledOrThrow();
  return getDeliveryProvider().getETA(context);
}

export async function getQuote(context) {
  ensureEnabledOrThrow();
  return getDeliveryProvider().getQuote(context);
}

export function mapProviderStatusToWorkflowStatus(providerName, providerStatus) {
  return providerStatusToWorkflowStatus(providerName, providerStatus);
}

export function verifyWebhookSignature(rawBody, headers) {
  ensureEnabledOrThrow();
  return getDeliveryProvider().verifyWebhookSignature(rawBody, headers);
}

export function parseWebhookPayload(rawBody, headers) {
  ensureEnabledOrThrow();
  return getDeliveryProvider().parseWebhookPayload(rawBody, headers);
}

export async function refreshProviderToken() {
  ensureEnabledOrThrow();
  return getDeliveryProvider().refreshToken();
}

export async function emitDeliveryBroadcastForSeller(sellerId, payload) {
  if (!isDeliveryModuleEnabled()) return;
  return getDeliveryProvider().emitDeliveryBroadcastForSeller(sellerId, payload);
}

export async function retractDeliveryBroadcastForOrder(orderId, winnerDeliveryId) {
  if (!isDeliveryModuleEnabled()) return { removedCount: 0 };
  return getDeliveryProvider().retractDeliveryBroadcastForOrder(orderId, winnerDeliveryId);
}

export async function emitReturnBroadcastForCustomer(customerLocation, payload) {
  if (!isDeliveryModuleEnabled()) return;
  return getDeliveryProvider().emitReturnBroadcastForCustomer(customerLocation, payload);
}

export async function emitToDelivery(deliveryId, { event, payload }) {
  if (!isDeliveryModuleEnabled()) return;
  return getDeliveryProvider().emitToDelivery(deliveryId, { event, payload });
}
