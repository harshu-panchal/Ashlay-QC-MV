# Third-Party Delivery Integration — Production Plan (Part 2 of 2)

---

## 11. Live Tracking & ETA

### Hybrid approach: Webhooks (primary) + Polling (fallback)

```
Provider sends webhook → webhookProcessor → update DeliveryShipment.timeline
                                         → emit socket: order:tracking_update

Polling fallback (when provider lacks webhooks or is silent > N minutes):
[trackingPollQueue] — scheduled Bull job per active shipment
  → provider.getTrackingInfo(context)
  → diff against last known status
  → if changed → update DB + emit socket
```

**Polling schedule config** (`deliveryTrackingQueue`):
```js
// Enqueue when shipment created, repeat until delivered/cancelled
{
  repeat: { every: 120_000 },   // every 2 min while in transit
  jobId: `track:${orderId}`,
  removeOnComplete: true,
}
// Stop repeating job on DELIVERED or CANCELLED webhook
```

### ETA Socket Push
```js
// When getETA() result changes by > 5 min, push update
emitToCustomer(customerId, {
  event: "order:eta_update",
  payload: { orderId, etaMinutes, etaTimestamp }
});
```

---

## 12. Dynamic Pricing / Quotes

### Quote Context → Unified Quote Result
```js
// provider.getQuote(context) returns:
{
  providerName: "shiprocket",
  price: 45.00,
  currency: "INR",
  breakdown: { base: 35, fuel: 5, gst: 5 },
  estimatedMinutes: 30,
  validUntil: Date,
}
```

### Multi-Provider Quote Comparison
```js
// app/modules/delivery/selection/quoteAggregator.js
export async function getBestQuote(context) {
  const providers = getEnabledProviders();
  const quotes = await Promise.allSettled(
    providers.map(p => p.getQuote(context).then(q => ({ ...q, provider: p.name })))
  );

  const valid = quotes
    .filter(r => r.status === "fulfilled")
    .map(r => r.value)
    .sort((a, b) => a.price - b.price);

  return { best: valid[0], all: valid };
}
```

**Admin can configure** selection strategy via `Setting` model:
- `QUOTE_STRATEGY`: `"cheapest"` | `"fastest"` | `"preferred:shiprocket"` | `"manual"`

---

## 13. Provider Status Mapping Tables

Extend `deliveryStatusMapping.js` to per-provider lookup tables:

```js
// Shiprocket status → canonical
const SHIPROCKET_MAP = {
  "PICKUP SCHEDULED":       WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  "OUT FOR PICKUP":         WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  "PICKUP COMPLETE":        WORKFLOW_STATUS.OUT_FOR_DELIVERY,
  "OUT FOR DELIVERY":       WORKFLOW_STATUS.OUT_FOR_DELIVERY,
  "DELIVERED":              WORKFLOW_STATUS.DELIVERED,
  "UNDELIVERED":            WORKFLOW_STATUS.DELIVERY_FAILED,
  "RTO INITIATED":          WORKFLOW_STATUS.RETURN_INITIATED,
  "CANCELLED":              WORKFLOW_STATUS.CANCELLED,
};

// Porter status → canonical
const PORTER_MAP = {
  "order_accepted":         WORKFLOW_STATUS.DELIVERY_ASSIGNED,
  "driver_arrived_pickup":  WORKFLOW_STATUS.PICKUP_READY,
  "order_picked_up":        WORKFLOW_STATUS.OUT_FOR_DELIVERY,
  "order_delivered":        WORKFLOW_STATUS.DELIVERED,
  "order_cancelled":        WORKFLOW_STATUS.CANCELLED,
};

const PROVIDER_MAPS = { shiprocket: SHIPROCKET_MAP, porter: PORTER_MAP };

export function providerStatusToWorkflowStatus(providerName, providerStatus) {
  const map = PROVIDER_MAPS[providerName?.toLowerCase()];
  if (!map) return null;  // Unknown provider — callers handle null
  return map[providerStatus] ?? null;
}
```

> **Rule:** If `null` is returned, **do not** transition order state. Store raw status in `DeliveryShipment.timeline` and log a warning for ops visibility.

---

## 14. Token Refresh & Rate Limiting

### Token Lifecycle (per provider)
```js
// app/modules/delivery/providers/shiprocket/shiprocketClient.js

class ShiprocketClient {
  async getToken() {
    const stored = await ProviderTokenStore.findOne({ providerName: "shiprocket" });
    if (stored && stored.expiresAt > new Date()) return stored.accessToken;
    return this.refreshToken();
  }

  async refreshToken() {
    const res = await axios.post("https://apiv2.shiprocket.in/v1/external/auth/login", {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });
    await ProviderTokenStore.findOneAndUpdate(
      { providerName: "shiprocket" },
      { accessToken: res.data.token, expiresAt: addHours(new Date(), 23), updatedAt: new Date() },
      { upsert: true }
    );
    return res.data.token;
  }

  async request(method, path, data) {
    const token = await this.getToken();
    try {
      return await axios({ method, url: BASE_URL + path, data, headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      if (err.response?.status === 401) {
        await ProviderTokenStore.deleteOne({ providerName: "shiprocket" });  // force refresh
        throw new ProviderError("TOKEN_EXPIRED", err);
      }
      throw new ProviderError("REQUEST_FAILED", err);
    }
  }
}
```

### Rate Limiting Strategy
```js
// Per-provider rate limit via Redis sliding window
// Shiprocket: 500 req/min per token
// Porter: 100 req/min

const PROVIDER_RATE_LIMITS = {
  shiprocket: { rpm: 500, windowMs: 60_000 },
  porter:     { rpm: 100, windowMs: 60_000 },
};

// Before any provider API call:
async function checkRateLimit(providerName) {
  const limit = PROVIDER_RATE_LIMITS[providerName];
  const key = `ratelimit:${providerName}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.pexpire(key, limit.windowMs);
  if (count > limit.rpm) throw new ProviderError("RATE_LIMITED");
}
```

---

## 15. Security Best Practices

| Concern | Implementation |
|---|---|
| Webhook signatures | HMAC-SHA256 verify with provider secret before any processing |
| Provider secrets | Store in `.env` / secrets manager. Never in DB or logs |
| Webhook raw body | Use `express.raw()` middleware on webhook routes only (not global) |
| Inbound webhook IPs | Whitelist provider IP ranges in nginx/cloud firewall if available |
| Token storage | `ProviderTokenStore` — tokens never logged, rotated proactively |
| Input sanitization | Validate webhook `orderId` against DB before processing |
| Webhook replay | Idempotency check on event ID — reject duplicates |
| Logging | Redact `accessToken`, `password` from all structured logs |
| Webhook endpoint | Do not expose internal error details — always return generic 200/400 |

```js
// Webhook route — raw body capture
router.post("/webhook/:provider",
  express.raw({ type: "*/*" }),   // MUST be before express.json()
  async (req, res) => {
    const provider = getRegisteredProvider(req.params.provider);
    if (!provider) return res.status(404).end();

    const valid = provider.verifyWebhookSignature(req.body, req.headers);
    if (!valid) {
      logger.warn({ provider: req.params.provider }, "webhook signature invalid");
      return res.status(401).end();
    }

    await deliveryWebhookQueue.add({ provider: req.params.provider, rawBody: req.body.toString(), headers: req.headers });
    res.status(200).end();   // always respond fast
  }
);
```

---

## 16. Logging & Observability

Use your existing `logger.js` (structured logging) with delivery-specific metadata:

```js
// Standard log shape for all delivery operations
logger.info({
  domain: "delivery",
  provider: "shiprocket",
  orderId,
  externalId: shipment.externalShipmentId,
  operation: "createShipment",
  durationMs: Date.now() - start,
  status: "success",
});

logger.error({
  domain: "delivery",
  provider: "shiprocket",
  orderId,
  operation: "createShipment",
  attempt: job.attemptsMade,
  error: err.message,
  code: err.code,
});
```

### Metrics (extend existing `metrics.js`)
```js
// Prometheus counters/histograms to add
delivery_shipment_created_total{provider, status}
delivery_shipment_failed_total{provider, reason}
delivery_webhook_received_total{provider, status}
delivery_webhook_processing_ms{provider}   // histogram
delivery_provider_api_latency_ms{provider, operation}
delivery_provider_circuit_open{provider}   // gauge
```

### Health Check (extend existing `healthCheck.js`)
```js
// Add to existing health checks:
{ name: "delivery:shiprocket", check: () => shiprocketClient.ping() }
{ name: "delivery:porter",     check: () => porterClient.ping() }
```

---

## 17. Real-time Updates via Sockets

### Customer-Facing Tracking Events
```js
// Emitted to room: `order:${orderId}`
socket.emit("order:tracking_update", {
  orderId,
  status: canonicalStatus,           // e.g. "OUT_FOR_DELIVERY"
  providerStatus: "Out For Delivery", // raw for display
  location: { lat, lng, label },
  etaMinutes: 12,
  timeline: [{ status, timestamp, location }],
  trackingUrl,
});

socket.emit("order:eta_update", { orderId, etaMinutes, etaTimestamp });
socket.emit("order:delivered", { orderId, deliveredAt });
```

### Admin/Seller Dashboard
```js
// Emitted to room: `seller:${sellerId}` and admin room
socket.emit("delivery:status_change", {
  orderId, providerName, oldStatus, newStatus, timestamp
});
socket.emit("delivery:provider_alert", {
  providerName, type: "circuit_open" | "rate_limited" | "token_expired"
});
```

### Integration with `webhookProcessor.js`
```js
// After status transition confirmed:
import { emitToCustomer } from "../../services/orderSocketEmitter.js";
import { emitToSeller }   from "../../services/orderSocketEmitter.js";

await emitToCustomer(customerId, { event: "order:tracking_update", payload });
await emitToSeller(sellerId, { event: "delivery:status_change", payload });
```

---

## 18. Testing Strategy

### Unit Tests (per provider file)
```js
// __tests__/delivery/shiprocketProvider.test.js
describe("shiprocketProvider", () => {
  it("createShipment returns canonical UnifiedShipmentResult");
  it("mapStatus maps all known Shiprocket statuses correctly");
  it("verifyWebhookSignature accepts valid HMAC, rejects tampered");
  it("parseWebhookPayload extracts orderId and providerStatus");
  it("getQuote returns price and breakdown");
  it("cancelShipment returns { cancelled: true }");
  it("handles 401 by refreshing token and retrying once");
  it("throws ProviderError with code RATE_LIMITED when throttled");
});
```

### Integration Tests
```js
// __tests__/delivery/providerRegistry.test.js
describe("providerSelector", () => {
  it("returns shiprocket when healthy and DELIVERY_PROVIDER=auto");
  it("falls back to porter when shiprocket circuit is open");
  it("falls back to internal when all third-party providers down");
});

// __tests__/delivery/webhookProcessor.test.js
describe("webhookProcessor", () => {
  it("transitions order to OUT_FOR_DELIVERY on shiprocket OUT_FOR_DELIVERY webhook");
  it("ignores duplicate webhook (idempotency)");
  it("stores unmapped status in timeline without crashing");
  it("emits socket event after status transition");
});
```

### Webhook Simulation Script
```js
// scripts/simulateWebhook.js — for local/staging testing
const SAMPLE_PAYLOADS = {
  shiprocket: { awb_code: "123", current_status: "OUT FOR DELIVERY", order_id: "ORD-001" },
  porter:     { order_id: "ORD-001", status: "order_picked_up", driver: { lat: 12.9, lng: 77.6 } },
};

async function simulate(provider, orderId, status) {
  const payload = { ...SAMPLE_PAYLOADS[provider], order_id: orderId, current_status: status };
  const sig = computeHmac(JSON.stringify(payload), process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`]);
  await axios.post(`http://localhost:3000/api/delivery/webhook/${provider}`, payload, {
    headers: { "x-shiprocket-signature": sig }
  });
}
```

### Mock Provider for Tests
```js
// app/modules/delivery/providers/mockDeliveryProvider.js
// Used in test env (DELIVERY_PROVIDER=mock)
export const mockDeliveryProvider = {
  name: "mock",
  async createShipment(ctx) { return { externalId: "MOCK-AWB", trackingUrl: "#" }; },
  async cancelShipment()    { return { cancelled: true }; },
  async getTrackingInfo()   { return { providerStatus: "DELIVERED", events: [] }; },
  mapStatus: (s) => WORKFLOW_STATUS[s] || null,
  verifyWebhookSignature: () => true,
  parseWebhookPayload: (raw) => JSON.parse(raw),
  // ... other interface stubs
};
```

---

## 19. Decoupling `orderWorkflowService.js`

**Current problem:** `orderWorkflowService.js` directly imports:
- `deliveryAssignmentStore.js` (internal delivery module)
- `deliveryManager.js` (broadcast layer)

**Fix:** Route all delivery interactions through `deliveryManager.js` only:

```js
// BEFORE (tight coupling):
import { markLatestBroadcastAssigned } from "../modules/delivery/internal/deliveryAssignmentStore.js";

// AFTER (loose coupling via manager):
import { markBroadcastAssigned } from "../modules/delivery/deliveryManager.js";

// Add to deliveryManager.js:
export async function markBroadcastAssigned({ orderId, winnerDeliveryId }) {
  if (!isDeliveryModuleEnabled()) return null;
  const { markLatestBroadcastAssigned } = await import("./internal/deliveryAssignmentStore.js");
  return markLatestBroadcastAssigned({ orderId, winnerDeliveryId });
}
```

Also extract `deliveryBroadcastPayloadFromOrder()` out of `orderWorkflowService.js`:
```js
// Move to: app/modules/delivery/internal/deliveryBroadcastPayload.js
// Import in orderWorkflowService.js via deliveryManager.js facade
```

---

## 20. Phased Implementation Roadmap

### Phase 1 — Foundation (Week 1–2) 🏗️
- [ ] Expand provider interface contract (`IDeliveryProvider.js`)
- [ ] Add new fields to `DeliveryAssignment` schema (additive, safe)
- [ ] Create `DeliveryShipment` and `ProviderTokenStore` models
- [ ] Create `deliveryQueues.js` with Bull queue definitions
- [ ] Extend `deliveryStatusMapping.js` with provider map tables
- [ ] Add new methods to `deliveryManager.js` (createShipment, cancelShipment, etc.)
- [ ] Write `mockDeliveryProvider.js` for test parity

### Phase 2 — Decouple & Harden (Week 2–3) 🔧
- [ ] Extract `deliveryBroadcastPayload.js` from `orderWorkflowService.js`
- [ ] Remove direct `deliveryAssignmentStore` import from `orderWorkflowService.js`
- [ ] Add `markBroadcastAssigned` to `deliveryManager.js` facade
- [ ] Extract `internalDeliveryProvider.js` out of the registry inline
- [ ] Wire `deliveryShipmentQueue` to `orderWorkflowService.deliveryAcceptAtomic()`
- [ ] Write unit tests for provider interface and status mapping

### Phase 3 — First Provider: Shiprocket (Week 3–4) 🚀
- [ ] Implement `ShiprocketClient` with token refresh + rate limiting
- [ ] Implement full `shiprocketProvider.js` (all interface methods)
- [ ] Implement `shiprocketWebhookParser.js` with HMAC verification
- [ ] Add webhook ingestion route + raw body middleware
- [ ] Wire `webhookProcessor.js` → `orderWorkflowService` transitions
- [ ] Add Prometheus metrics for provider API calls
- [ ] End-to-end test with Shiprocket sandbox

### Phase 4 — Multi-Provider & Auto Selection (Week 5–6) ⚡
- [ ] Implement `porterProvider.js` (second provider)
- [ ] Implement `providerSelector.js` with circuit breaker (Redis)
- [ ] Implement `quoteAggregator.js` for multi-provider price comparison
- [ ] Add `QUOTE_STRATEGY` setting in admin `Setting` model
- [ ] Add tracking poller (`trackingPollQueue`) as webhook fallback
- [ ] Add ETA socket push on significant change
- [ ] Admin dashboard: provider health status, circuit state, active shipments

### Phase 5 — Observability, Testing & Hardening (Week 7–8) 🛡️
- [ ] Full integration test suite (provider, webhook, fallback, idempotency)
- [ ] Webhook simulation script for staging
- [ ] Structured delivery log fields across all processors
- [ ] Prometheus metrics dashboards (Grafana)
- [ ] Rate limit tuning per provider
- [ ] Token rotation via scheduled job (proactive, not just on 401)
- [ ] Runbook: provider failure, circuit open, token expired, webhook signature failure
- [ ] Load test: 1000 concurrent shipment creations with fallback

---

## 21. Common Edge Cases & Failure Scenarios

| Scenario | Handling |
|---|---|
| Provider creates shipment but DB write fails | Idempotency key prevents double-creation on retry |
| Webhook arrives before `createShipment` completes | Buffer in `DeliveryShipment.webhookLog`, process on next poll |
| Two webhooks arrive out of order | Timeline stores all events; status only advances forward (no regression) |
| Provider returns `null` AWB | Retry job; log alert; do not emit tracking URL to customer |
| `orderId` in webhook doesn't match any order | Log + discard; do not 500 |
| Customer cancels while shipment is in transit | Cancel with provider; if provider rejects → mark `CANCELLATION_PENDING`; alert ops |
| Provider goes down mid-delivery | Continue tracking via last known state; show "Tracking unavailable" on frontend |
| Shipment delivered but webhook not received | Polling job catches it; or delivery partner marks delivered via internal flow |
| Duplicate `DELIVERED` webhooks | Idempotency on event ID — second one is no-op |

---

## 22. Scalability & Performance Considerations

- **All provider HTTP calls are async via Bull queues** — never block the request cycle
- **Redis circuit breaker** prevents cascade failures across providers
- **Polling is opt-in per shipment** — not a global cron that hammers all providers
- **Webhook endpoints return 200 immediately** — heavy processing is queued
- **Token is cached in DB + memory** — no per-request auth roundtrip
- **Rate limiting per provider** prevents 429s that exhaust retry budget
- **`DeliveryShipment.timeline` is append-only** — no index contention on updates
- **Socket events are fire-and-forget** — delivery workflow never waits on socket
- **`withProviderFallback()` adds ~0ms latency** when primary provider is healthy
- **Idempotency keys have 24h TTL** — Redis memory stays bounded
- Future: Consider event sourcing for `DeliveryShipment.timeline` if audit requirements grow
