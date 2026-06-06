# Third-Party Delivery Integration — Production Plan (Part 1 of 2)
> Grounded in your actual codebase: `app/modules/delivery/`, `orderWorkflowService.js`, `deliveryAssignmentStore.js`, `orderQueues.js`, `idempotencyService.js`

---

## 1. Current Architecture Audit — Tight Coupling Hotspots

### What's Already Decoupled ✅
| Component | Status |
|---|---|
| `deliveryManager.js` | Clean facade — callers never touch providers directly |
| `deliveryFlags.js` | Feature-flag gate via `DELIVERY_PROVIDER` env |
| `deliveryProviderRegistry.js` | Map-based registry, easy to extend |
| `deliveryStatusMapping.js` | Canonical mapping stub exists |
| `deliveryAssignmentStore.js` | Internal store isolated behind module boundary |
| `idempotencyService.js` | Reusable, Redis-backed — ready to use |

### Still Tightly Coupled ⚠️ — Must Fix
| Problem | Location | Risk |
|---|---|---|
| Provider interface = 4 broadcast-only methods | `deliveryProviderRegistry.js` | No contract for shipment/tracking/quote/webhook |
| `orderWorkflowService.js` imports `deliveryAssignmentStore` directly | Line 36 of `orderWorkflowService.js` | Internal store leaks into core workflow |
| `deliveryStatusMapping.js` returns `null` for all third-party | Lines 18-19 | Status translation broken for any real provider |
| `DeliveryAssignment` model has no `providerName`, `externalShipmentId`, `trackingUrl` | `models/deliveryAssignment.js` | Can't track provider-side shipment lifecycle |
| No webhook ingestion route | `routes/` | Providers cannot push status updates |
| No provider selection/fallback logic | `deliveryProviderRegistry.js` | Single-provider only |
| Queue only used for timeouts | `queues/orderQueues.js` | No async queue for provider API calls |

---

## 2. Unified Provider Interface Contract

Every provider (Shiprocket, Porter, internal, noop) **must implement this interface**. This is the single contract `deliveryManager.js` will enforce.

```js
// app/modules/delivery/IDeliveryProvider.js  (JSDoc contract — not runtime enforced)

/**
 * @interface IDeliveryProvider
 * All methods must return a canonical UnifiedShipmentResult or throw a ProviderError.
 */
export const DELIVERY_PROVIDER_INTERFACE = {
  name: String,                   // e.g. "shiprocket" | "porter" | "internal"

  // Core lifecycle
  createShipment(context),        // → { externalId, trackingUrl, label, providerStatus }
  cancelShipment(context),        // → { cancelled: boolean, reason? }
  getTrackingInfo(context),       // → { providerStatus, location, eta, events[] }
  getETA(context),                // → { etaMinutes, etaTimestamp }
  getQuote(context),              // → { price, currency, breakdown, estimatedTime }

  // Status normalization
  mapStatus(providerStatus),      // → canonical WORKFLOW_STATUS | null

  // Webhook
  parseWebhookPayload(rawBody, headers), // → { orderId, externalId, providerStatus, meta }
  verifyWebhookSignature(rawBody, headers), // → boolean

  // Auth/token lifecycle
  refreshToken(),                 // → void (called by token-refresh scheduler)

  // Socket broadcasts (existing interface — preserved)
  emitDeliveryBroadcastForSeller(sellerId, payload),
  retractDeliveryBroadcastForOrder(orderId, winnerDeliveryId),
  emitReturnBroadcastForCustomer(customerLocation, payload),
  emitToDelivery(deliveryId, { event, payload }),
};
```

> **Rule:** Any method a provider does not support must return a default safe value, not throw. Unsupported methods should be stubs matching the noop pattern.

---

## 3. Recommended Folder Structure

```
backend/app/modules/delivery/
├── deliveryFlags.js                    ✅ exists
├── deliveryManager.js                  ✅ exists — expand method set
├── deliveryProviderRegistry.js         ✅ exists — add dynamic loading + fallback
├── deliveryStatusMapping.js            ✅ exists — add per-provider map tables
├── IDeliveryProvider.js                🆕 interface contract (JSDoc)
│
├── providers/
│   ├── noopDeliveryProvider.js         ✅ exists
│   ├── internalDeliveryProvider.js     🆕 extract from registry
│   ├── shiprocket/
│   │   ├── shiprocketProvider.js       🆕 implements full interface
│   │   ├── shiprocketClient.js         🆕 HTTP client (axios, token mgmt)
│   │   ├── shiprocketStatusMap.js      🆕 Shiprocket status → canonical
│   │   └── shiprocketWebhookParser.js  🆕 webhook sig verify + payload parse
│   └── porter/
│       ├── porterProvider.js
│       ├── porterClient.js
│       ├── porterStatusMap.js
│       └── porterWebhookParser.js
│
├── internal/
│   ├── deliveryAssignmentStore.js      ✅ exists
│   └── deliveryBroadcastPayload.js     🆕 extract payload builder from orderWorkflowService
│
├── selection/
│   ├── providerSelector.js             🆕 auto-select / fallback logic
│   └── providerHealthStore.js          🆕 Redis circuit-breaker state
│
├── webhooks/
│   ├── webhookRouter.js                🆕 routes POST /delivery/webhook/:provider
│   └── webhookProcessor.js            🆕 maps + dispatches to orderWorkflowService
│
└── tracking/
    └── trackingPoller.js               🆕 scheduled polling fallback (Bull job)

backend/app/queues/
├── orderQueues.js                      ✅ exists
└── deliveryQueues.js                   🆕 shipment creation, cancellation, tracking

backend/app/models/
├── deliveryAssignment.js               ✅ exists — schema needs fields added
└── deliveryShipment.js                 🆕 provider-side shipment record

backend/app/routes/
└── deliveryWebhookRoutes.js            🆕 raw-body middleware + per-provider routes
```

---

## 4. Database Schema Additions

### 4a. Extend `DeliveryAssignment` (additive, backward-compatible)
```js
// Add to existing deliveryAssignment.js schema — all new fields are optional
{
  providerName:       { type: String, default: "internal" },
  externalShipmentId: { type: String, index: true },     // AWB / tracking number
  trackingUrl:        { type: String },
  providerStatus:     { type: String },                  // raw provider status
  providerQuote:      { type: mongoose.Schema.Types.Mixed }, // { price, eta, breakdown }
  webhookEvents:      [{ type: mongoose.Schema.Types.Mixed }], // raw webhook payloads
  lastWebhookAt:      { type: Date },
  shipmentCreatedAt:  { type: Date },
  shipmentCancelledAt:{ type: Date },
  failureReason:      { type: String },
  retryCount:         { type: Number, default: 0 },
}
```

### 4b. New `DeliveryShipment` model
```js
// app/models/deliveryShipment.js
{
  orderId:            { type: String, required: true, index: true },
  orderMongoId:       { type: ObjectId, ref: "Order" },
  providerName:       { type: String, required: true },
  externalShipmentId: { type: String, unique: true, sparse: true },
  status:             { type: String, enum: ["pending","created","in_transit","delivered","cancelled","failed"] },
  trackingUrl:        { type: String },
  label:              { type: String },           // base64 label PDF
  quote:              { type: Mixed },            // price snapshot at booking time
  timeline:           [{ status, timestamp, location, raw }],
  etaTimestamp:       { type: Date },
  webhookLog:         [{ receivedAt, payload, processed }],
  idempotencyKey:     { type: String, unique: true, sparse: true },
  createdAt, updatedAt                             // auto via timestamps:true
}
```

### 4c. New `ProviderTokenStore` model
```js
// app/models/providerTokenStore.js
{
  providerName: { type: String, unique: true },
  accessToken:  { type: String },
  refreshToken: { type: String },
  expiresAt:    { type: Date },
  updatedAt:    { type: Date }
}
```

---

## 5. Expanded `deliveryManager.js` — New Methods

Add these to the existing manager facade (no breaking changes):

```js
// New additions to deliveryManager.js

export async function createShipment(context) {
  if (!isDeliveryModuleEnabled()) return null;
  const provider = getDeliveryProvider(context.preferredProvider);
  return provider.createShipment(context);
}

export async function cancelShipment(context) {
  if (!isDeliveryModuleEnabled()) return null;
  return getDeliveryProvider().cancelShipment(context);
}

export async function getTrackingInfo(context) {
  if (!isDeliveryModuleEnabled()) return null;
  return getDeliveryProvider().getTrackingInfo(context);
}

export async function getETA(context) {
  if (!isDeliveryModuleEnabled()) return null;
  return getDeliveryProvider().getETA(context);
}

export async function getQuote(context) {
  // Quote does NOT require module to be "enabled" — can always get quotes
  return getDeliveryProvider().getQuote(context);
}

export function normalizeProviderStatus(providerName, rawStatus) {
  return providerStatusToWorkflowStatus(providerName, rawStatus);
}
```

---

## 6. Provider Selection & Fallback Logic

```js
// app/modules/delivery/selection/providerSelector.js

const PROVIDER_PRIORITY = ["shiprocket", "porter", "internal"];

export async function selectProvider(context) {
  const forced = context.preferredProvider || getDeliveryProviderName();

  // If explicit override via env/request, use it directly
  if (forced && forced !== "auto") {
    return getRegisteredProvider(forced) || internalDeliveryProvider;
  }

  // Auto-selection: pick first healthy provider by priority
  for (const name of PROVIDER_PRIORITY) {
    const isHealthy = await isProviderHealthy(name);  // Redis circuit breaker
    if (isHealthy) {
      const provider = getRegisteredProvider(name);
      if (provider) return provider;
    }
  }

  return internalDeliveryProvider; // final fallback
}

export async function withProviderFallback(context, operation) {
  const providers = getProviderFallbackChain(context);
  let lastError;

  for (const provider of providers) {
    try {
      const result = await operation(provider);
      await markProviderHealthy(provider.name);
      return result;
    } catch (err) {
      lastError = err;
      await markProviderFailure(provider.name);  // increment circuit breaker
      logger.warn(`[providerFallback] ${provider.name} failed: ${err.message}. Trying next.`);
    }
  }

  throw lastError;
}
```

**Circuit breaker state** stored in Redis:
```
KEY: delivery:provider:health:{name}
VALUE: { failures: N, lastFailureAt: timestamp, open: boolean }
TTL: 300s (auto-reset)
```

---

## 7. Shipment Creation Flow

```
Order DELIVERY_ASSIGNED
        │
        ▼
[deliveryShipmentQueue] ← Bull job enqueued by orderWorkflowService
        │
        ▼
[shipmentCreationProcessor]
  1. Idempotency check (idempotencyService)
  2. getQuote() — compare providers if auto mode
  3. selectProvider(context)
  4. provider.createShipment(context)
  5. Save DeliveryShipment record
  6. Update DeliveryAssignment: externalShipmentId, trackingUrl
  7. Emit socket: shipment:created → customer
  8. On failure → retry with backoff (max 3) → fallback provider → alert
```

**Context object** passed to every provider method:
```js
{
  orderId, orderMongoId,
  pickup: { name, phone, address, lat, lng, pincode },
  drop:   { name, phone, address, lat, lng, pincode },
  items:  [{ name, qty, weight, value }],
  paymentMode: "COD" | "PREPAID",
  totalValue, weight,
  preferredProvider: null | "shiprocket" | "porter",
  idempotencyKey,
}
```

---

## 8. Webhook Handling Architecture

```
POST /api/delivery/webhook/:provider
        │
        ├── raw body captured (before JSON parse — needed for HMAC sig)
        ├── verifyWebhookSignature(rawBody, headers)  ← per-provider
        ├── idempotency check on webhook event ID
        │
        ▼
[webhookProcessor.js]
  1. provider.parseWebhookPayload(rawBody, headers)
     → { orderId, externalId, providerStatus, location, eta, meta }
  2. normalizeProviderStatus(providerName, providerStatus)
     → canonical WORKFLOW_STATUS
  3. Append to DeliveryShipment.webhookLog
  4. IF status changed → call appropriate orderWorkflowService handler
  5. Emit realtime socket: order:tracking_update → customer room
  6. Return 200 immediately (async processing via queue)
```

**Critical:** Always return `200 OK` to provider within 3s. Queue heavy work.

```js
// app/routes/deliveryWebhookRoutes.js
router.post("/webhook/:provider",
  rawBodyMiddleware,           // capture req.rawBody before express.json()
  webhookRateLimiter,          // per-provider rate limit
  webhookController.handle     // verify sig → enqueue → 200
);
```

---

## 9. Retry + Failure Recovery

### Bull Queue Config for Provider API Calls
```js
// app/queues/deliveryQueues.js
export const deliveryShipmentQueue = new Bull("delivery:shipment", {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },  // 5s, 10s, 20s
    removeOnComplete: 100,
    removeOnFail: 200,
  }
});

export const deliveryCancellationQueue = new Bull("delivery:cancellation", { ... });
export const deliveryWebhookQueue = new Bull("delivery:webhook", {
  defaultJobOptions: { attempts: 5, backoff: { type: "fixed", delay: 2000 } }
});
export const deliveryTrackingQueue = new Bull("delivery:tracking", { ... });
```

### Failure Escalation Matrix
| Failure | Action |
|---|---|
| Shipment creation fails × 3 | Fallback to next provider → if all fail, flag order as `SHIPMENT_FAILED`, alert admin |
| Webhook verify fails | Log + 401, never enqueue |
| Status map returns `null` | Log warning, skip workflow transition, store raw status in `DeliveryShipment.timeline` |
| Token expired | `refreshToken()` → retry original call once |
| Provider circuit open | Skip provider, use next in fallback chain |
| Cancellation fails | Mark `cancellation_pending`, retry job, alert admin if stuck > 30min |

----+

## 10. Idempotency Protection

Leverage your existing `idempotencyService.js` for:

| Operation | Idempotency Key Pattern |
|---|---|
| Shipment creation | `shipment:create:{orderId}:{providerName}` |
| Shipment cancellation | `shipment:cancel:{orderId}:{providerName}` |
| Webhook event | `webhook:{providerName}:{eventId}` |
| Delivery accept | `idem:delivery_accept:{orderId}:{key}` ✅ already done |

```js
// In shipmentCreationProcessor.js
const idemKey = `shipment:create:${orderId}:${providerName}`;
const existing = await idempotencyService.check(idemKey);
if (existing) return existing.result;  // skip API call, return cached result

const result = await provider.createShipment(context);
await idempotencyService.store(idemKey, result, 86400);  // 24h TTL
```
