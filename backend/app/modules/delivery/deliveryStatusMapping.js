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
  const s = String(providerStatus || "").toUpperCase();

  if (p === "internal" || !p) {
    return WORKFLOW_STATUS[s] || null;
  }

  // Unknown provider: do not guess. Callers should handle null safely.
  return null;
}

export function workflowStatusToProviderStatus(providerName, workflowStatus) {
  const p = String(providerName || "internal").toLowerCase();
  const s = String(workflowStatus || "").toUpperCase();

  if (p === "internal" || !p) {
    return WORKFLOW_STATUS[s] ? s : null;
  }

  return null;
}

