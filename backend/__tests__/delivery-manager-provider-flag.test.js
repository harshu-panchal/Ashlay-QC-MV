import { jest } from "@jest/globals";

describe("deliveryManager provider flag", () => {
  beforeEach(() => {
    delete process.env.DELIVERY_PROVIDER;
    jest.resetModules();
  });

  it("noops when DELIVERY_PROVIDER=none", async () => {
    process.env.DELIVERY_PROVIDER = "none";

    const emitDeliveryBroadcastForSeller = jest.fn(async () => {});
    const retractDeliveryBroadcastForOrder = jest.fn(async () => ({ removedCount: 123 }));
    const emitReturnBroadcastForCustomer = jest.fn(async () => {});
    const emitToDelivery = jest.fn(() => {});

    const mockFactory = () => ({
      emitDeliveryBroadcastForSeller,
      retractDeliveryBroadcastForOrder,
      emitReturnBroadcastForCustomer,
      emitToDelivery,
    });

    // Mock both common specifiers (direct imports and provider registry dynamic import).
    jest.unstable_mockModule("../app/services/orderSocketEmitter.js", mockFactory);
    jest.unstable_mockModule("../app/modules/delivery/../../services/orderSocketEmitter.js", mockFactory);

    const mgr = await import("../app/modules/delivery/deliveryManager.js");

    await mgr.emitDeliveryBroadcastForSeller("seller1", { orderId: "ORD1" });
    const retract = await mgr.retractDeliveryBroadcastForOrder("ORD1", "del1");
    await mgr.emitReturnBroadcastForCustomer({ lat: 1, lng: 2 }, { orderId: "ORD2" });
    mgr.emitToDelivery("del1", { event: "x", payload: { ok: true } });

    expect(retract).toEqual({ removedCount: 0 });
    expect(emitDeliveryBroadcastForSeller).not.toHaveBeenCalled();
    expect(retractDeliveryBroadcastForOrder).not.toHaveBeenCalled();
    expect(emitReturnBroadcastForCustomer).not.toHaveBeenCalled();
    expect(emitToDelivery).not.toHaveBeenCalled();
  });

  it("defaults to internal provider when unset", async () => {
    const emitDeliveryBroadcastForSeller = jest.fn(async () => {});

    const mockFactory = () => ({
      emitDeliveryBroadcastForSeller,
      retractDeliveryBroadcastForOrder: jest.fn(async () => ({ removedCount: 0 })),
      emitReturnBroadcastForCustomer: jest.fn(async () => {}),
      emitToDelivery: jest.fn(() => {}),
    });

    jest.unstable_mockModule("../app/services/orderSocketEmitter.js", mockFactory);
    jest.unstable_mockModule("../app/modules/delivery/../../services/orderSocketEmitter.js", mockFactory);

    const mgr = await import("../app/modules/delivery/deliveryManager.js");
    await mgr.emitDeliveryBroadcastForSeller("seller1", { orderId: "ORD1" });

    expect(emitDeliveryBroadcastForSeller).toHaveBeenCalledTimes(1);
  });
});
