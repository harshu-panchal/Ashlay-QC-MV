import { providerStatusToWorkflowStatus } from "../../app/modules/delivery/deliveryStatusMapping.js";
import { WORKFLOW_STATUS } from "../../app/constants/orderWorkflow.js";

describe("deliveryStatusMapping", () => {
  test("shiprocket maps DELIVERED", () => {
    expect(providerStatusToWorkflowStatus("shiprocket", "DELIVERED")).toBe(WORKFLOW_STATUS.DELIVERED);
  });

  test("porter maps order_delivered", () => {
    expect(providerStatusToWorkflowStatus("porter", "order_delivered")).toBe(WORKFLOW_STATUS.DELIVERED);
  });

  test("unknown provider returns null", () => {
    expect(providerStatusToWorkflowStatus("unknown", "DELIVERED")).toBe(null);
  });
});

