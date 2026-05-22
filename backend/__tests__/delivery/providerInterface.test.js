import { noopDeliveryProvider } from "../../app/modules/delivery/providers/noopDeliveryProvider.js";
import { mockDeliveryProvider } from "../../app/modules/delivery/providers/mockDeliveryProvider.js";

function expectProviderShape(provider) {
  const required = [
    "name",
    "createShipment",
    "cancelShipment",
    "getTrackingInfo",
    "getETA",
    "getQuote",
    "mapStatus",
    "parseWebhookPayload",
    "verifyWebhookSignature",
    "refreshToken",
    "emitDeliveryBroadcastForSeller",
    "retractDeliveryBroadcastForOrder",
    "emitReturnBroadcastForCustomer",
    "emitToDelivery",
  ];
  for (const k of required) {
    expect(provider).toHaveProperty(k);
  }
}

describe("delivery providers implement contract shape", () => {
  test("noop provider has required methods", () => {
    expectProviderShape(noopDeliveryProvider);
  });

  test("mock provider has required methods", () => {
    expectProviderShape(mockDeliveryProvider);
  });
});

