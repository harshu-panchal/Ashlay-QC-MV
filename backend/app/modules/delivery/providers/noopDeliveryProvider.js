export const noopDeliveryProvider = {
  name: "none",
  async emitDeliveryBroadcastForSeller() {},
  async retractDeliveryBroadcastForOrder() {
    return { removedCount: 0 };
  },
  async emitReturnBroadcastForCustomer() {},
  async emitToDelivery() {},
};
