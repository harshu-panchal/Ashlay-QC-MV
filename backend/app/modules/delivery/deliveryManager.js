import { isDeliveryModuleEnabled } from "./deliveryFlags.js";
import { getDeliveryProvider } from "./deliveryProviderRegistry.js";

export function getActiveDeliveryProviderName() {
  return getDeliveryProvider().name;
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
