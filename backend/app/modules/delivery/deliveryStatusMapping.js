import { WORKFLOW_STATUS } from "../../constants/orderWorkflow.js";

/**
 * Central mapping layer between provider-specific status and the platform's
 * canonical order workflow statuses.
 *
 * For now (internal provider), we keep a 1:1 mapping. Third-party providers
 * can map their event/status codes here without changing order flows.
 */
export function providerStatusToWorkflowStatus(providerName, providerStatus) {
  const p = String(providerName || "internal").toLowerCase();
  const s = String(providerStatus || "").trim();

  if (p === "internal" || !p) {
    const key = s.toUpperCase();
    return WORKFLOW_STATUS[key] || null;
  }

  const map = PROVIDER_MAPS[p];
  if (!map) return null;

  const normalized = normalizeProviderStatusKey(p, s);
  return map[normalized] ?? null;
}

export function workflowStatusToProviderStatus(providerName, workflowStatus) {
  const p = String(providerName || "internal").toLowerCase();
  const s = String(workflowStatus || "").toUpperCase();

  if (p === "internal" || !p) {
    return WORKFLOW_STATUS[s] ? s : null;
  }

  return null;
}

function normalizeProviderStatusKey(providerName, status) {
  if (providerName === "shiprocket") return String(status || "").trim().toUpperCase();
  if (providerName === "porter") return String(status || "").trim().toLowerCase();
  return String(status || "").trim();
}

// Provider status tables (only map to statuses that exist in WORKFLOW_STATUS).
const SHIPROCKET_MAP = {
  "PICKUP SCHEDULED": WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  "OUT FOR PICKUP": WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  "PICKUP COMPLETE": WORKFLOW_STATUS.OUT_FOR_DELIVERY,
  "OUT FOR DELIVERY": WORKFLOW_STATUS.OUT_FOR_DELIVERY,
  DELIVERED: WORKFLOW_STATUS.DELIVERED,
  CANCELLED: WORKFLOW_STATUS.CANCELLED,
};

const PORTER_MAP = {
  order_accepted: WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  driver_arrived_pickup: WORKFLOW_STATUS.PICKUP_READY,
  order_picked_up: WORKFLOW_STATUS.OUT_FOR_DELIVERY,
  order_delivered: WORKFLOW_STATUS.DELIVERED,
  order_cancelled: WORKFLOW_STATUS.CANCELLED,
};

const PROVIDER_MAPS = {
  shiprocket: SHIPROCKET_MAP,
  porter: PORTER_MAP,
};
