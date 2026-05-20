import { getDeliveryProviderName } from "./deliveryFlags.js";
import { noopDeliveryProvider } from "./providers/noopDeliveryProvider.js";

const internalDeliveryProvider = {
  name: "internal",
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
  ["none", noopDeliveryProvider],
  ["disabled", noopDeliveryProvider],
  ["off", noopDeliveryProvider],
]);

export function getDeliveryProvider() {
  const key = getDeliveryProviderName();
  return PROVIDERS.get(key) || internalDeliveryProvider;
}
