import crypto from "crypto";
import {
  deliveryShipmentQueue,
  deliveryWebhookQueue,
  deliveryCancellationQueue,
  deliveryTrackingQueue,
  DELIVERY_JOB_NAMES,
} from "./deliveryQueues.js";
import { isRedisEnabled } from "../config/redis.js";
import logger from "../services/logger.js";
import {
  acquireIdempotencyLock,
  checkIdempotency,
  isRetryableError,
  releaseIdempotencyLock,
  storeIdempotencyError,
  storeIdempotencyResult,
  validateIdempotencyKey,
} from "../services/idempotencyService.js";
import DeliveryShipment from "../models/deliveryShipment.js";
import DeliveryAssignment from "../models/deliveryAssignment.js";
import Order from "../models/order.js";
import {
  cancelShipment,
  createShipment,
  getTrackingInfo,
  mapProviderStatusToWorkflowStatus,
} from "../modules/delivery/deliveryManager.js";
import { applyProviderCanonicalStatusAtomic } from "../services/orderWorkflowService.js";

const IDEM_PREFIX = "delivery";

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function buildIdemKey(kind, payload) {
  // idempotencyService requires 32-64 chars of [a-zA-Z0-9-]. Use 64 hex chars.
  return sha256Hex(`${IDEM_PREFIX}:${kind}:${JSON.stringify(payload || {})}`);
}

async function processShipmentCreate(job) {
  const payload = job.data || {};
  const context = payload.context || {};
  const providerName = payload.providerName || context.preferredProvider || "internal";

  const hydratedContext = { ...context };
  if (!hydratedContext.orderMongoId || !hydratedContext.pickup || !hydratedContext.drop) {
    const order = await Order.findOne({ orderId: hydratedContext.orderId })
      .populate("seller")
      .lean();

    if (!order) {
      const err = new Error("Order not found for shipment creation");
      err.code = "ORDER_NOT_FOUND";
      err.statusCode = 404;
      throw err;
    }

    hydratedContext.orderMongoId = hydratedContext.orderMongoId || order._id;

    const seller = order.seller && typeof order.seller === "object" ? order.seller : null;
    hydratedContext.pickup = hydratedContext.pickup || {
      name: seller?.shopName || seller?.name || "Seller",
      phone: seller?.phone || null,
      address: [seller?.address, seller?.locality, seller?.city, seller?.state, seller?.pincode]
        .filter(Boolean)
        .join(", "),
      lat: Array.isArray(seller?.location?.coordinates) ? seller.location.coordinates[1] : null,
      lng: Array.isArray(seller?.location?.coordinates) ? seller.location.coordinates[0] : null,
      pincode: seller?.pincode || null,
    };

    hydratedContext.drop = hydratedContext.drop || {
      name: order.address?.name || "Customer",
      phone: order.address?.phone || null,
      address: [order.address?.address, order.address?.landmark, order.address?.city]
        .filter(Boolean)
        .join(", "),
      lat: order.address?.location?.lat ?? null,
      lng: order.address?.location?.lng ?? null,
      pincode: null,
    };

    hydratedContext.items = hydratedContext.items || (order.items || []).map((it) => ({
      name: it?.name || "Item",
      qty: Number(it?.quantity || 1),
      weight: null,
      value: Number(it?.price || 0),
    }));

    hydratedContext.paymentMode = hydratedContext.paymentMode || (order.paymentMode === "ONLINE" ? "PREPAID" : "COD");
    hydratedContext.totalValue = hydratedContext.totalValue ?? order.pricing?.total ?? 0;
  }

  const idemKey = validateIdempotencyKey(payload.idempotencyKey)
    ? payload.idempotencyKey
    : buildIdemKey("shipment:create", { orderId: hydratedContext.orderId, providerName });

  const cached = await checkIdempotency(idemKey, { providerName, context: hydratedContext });
  if (cached.exists && cached.result?.status === "success") {
    return cached.result.data;
  }

  const locked = await acquireIdempotencyLock(idemKey);
  if (!locked) {
    const err = new Error("Shipment create already in progress");
    err.code = "IDEMPOTENCY_LOCKED";
    throw err;
  }

  try {
    const result = await createShipment({ ...hydratedContext, preferredProvider: providerName });

    const shipmentDoc = await DeliveryShipment.create({
      orderId: hydratedContext.orderId,
      orderMongoId: hydratedContext.orderMongoId,
      providerName,
      externalShipmentId: result?.externalId ?? null,
      trackingUrl: result?.trackingUrl ?? null,
      labelUrl: result?.label ?? null,
      providerStatus: result?.providerStatus ?? null,
      canonicalStatus: null,
      timeline: [
        {
          providerStatus: result?.providerStatus ?? null,
          canonicalStatus: null,
          meta: { source: "shipment:create" },
        },
      ],
      meta: { rawResult: result },
    });

    await DeliveryAssignment.updateMany(
      { orderId: hydratedContext.orderId },
      {
        $set: {
          providerName,
          externalShipmentId: result?.externalId ?? null,
          trackingUrl: result?.trackingUrl ?? null,
          providerStatus: result?.providerStatus ?? null,
        },
      },
    );

    await storeIdempotencyResult(
      idemKey,
      { shipmentId: shipmentDoc._id.toString(), result },
      { providerName, context: hydratedContext },
    );

    // Start tracking poller fallback (webhooks are primary; polling is a safety net).
    try {
      await deliveryTrackingQueue.add(
        DELIVERY_JOB_NAMES.TRACKING_POLL,
        {
          providerName,
          context: {
            orderId: hydratedContext.orderId,
            orderMongoId: hydratedContext.orderMongoId,
            externalShipmentId: result?.externalId ?? null,
            preferredProvider: providerName,
          },
        },
        {
          jobId: `track:${hydratedContext.orderId}`,
          repeat: { every: 120000 },
          removeOnComplete: true,
        },
      );
    } catch (e) {
      logger.warn("Failed to enqueue tracking poller", { orderId: hydratedContext.orderId, error: e?.message });
    }

    return { shipmentId: shipmentDoc._id.toString(), result };
  } catch (error) {
    if (isRetryableError(error)) {
      await releaseIdempotencyLock(idemKey);
    } else {
      await storeIdempotencyError(idemKey, error, { providerName, context: hydratedContext });
    }
    throw error;
  }
}

async function processShipmentCancel(job) {
  const payload = job.data || {};
  const context = payload.context || {};
  const providerName = payload.providerName || context.preferredProvider || "internal";

  const idemKey = validateIdempotencyKey(payload.idempotencyKey)
    ? payload.idempotencyKey
    : buildIdemKey("shipment:cancel", { orderId: context.orderId, providerName });

  const cached = await checkIdempotency(idemKey, { providerName, context });
  if (cached.exists && cached.result?.status === "success") {
    return cached.result.data;
  }

  const locked = await acquireIdempotencyLock(idemKey);
  if (!locked) {
    const err = new Error("Shipment cancel already in progress");
    err.code = "IDEMPOTENCY_LOCKED";
    throw err;
  }

  try {
    const result = await cancelShipment({ ...context, preferredProvider: providerName });
    await storeIdempotencyResult(idemKey, result, { providerName, context });
    return result;
  } catch (error) {
    if (isRetryableError(error)) {
      await releaseIdempotencyLock(idemKey);
    } else {
      await storeIdempotencyError(idemKey, error, { providerName, context });
    }
    throw error;
  }
}

async function processTrackingPoll(job) {
  const payload = job.data || {};
  const context = payload.context || {};
  const providerName = payload.providerName || context.preferredProvider || "internal";

  const result = await getTrackingInfo({ ...context, preferredProvider: providerName });

  await DeliveryShipment.updateMany(
    { orderId: context.orderId, providerName },
    {
      $set: { providerStatus: result?.providerStatus ?? null },
      $push: {
        timeline: {
          at: new Date(),
          providerStatus: result?.providerStatus ?? null,
          canonicalStatus: null,
          location: result?.location ?? null,
          etaTimestamp: result?.etaTimestamp ? new Date(result.etaTimestamp) : null,
          meta: { source: "tracking:poll", events: result?.events ?? [] },
        },
      },
    },
  );

  return result;
}

async function processWebhook(job) {
  const payload = job.data || {};
  const providerName = String(payload.providerName || "").toLowerCase();
  const parsed = payload.parsed || {};

  const orderId = parsed.orderId ?? payload.orderId ?? null;
  const externalId = parsed.externalId ?? payload.externalShipmentId ?? null;
  const providerStatus = parsed.providerStatus ?? null;
  const canonicalStatus = mapProviderStatusToWorkflowStatus(providerName, providerStatus);

  await DeliveryShipment.updateMany(
    {
      ...(orderId ? { orderId } : {}),
      providerName,
      ...(externalId ? { externalShipmentId: externalId } : {}),
    },
    {
      $set: {
        providerStatus,
        canonicalStatus: canonicalStatus ?? null,
      },
      $push: {
        webhookLog: {
          at: new Date(),
          eventId: parsed?.meta?.eventId ?? null,
          payload: {
            parsed,
            rawBody: payload.rawBody ?? null,
          },
        },
        timeline: {
          at: new Date(),
          providerStatus,
          canonicalStatus: canonicalStatus ?? null,
          meta: { source: "webhook" },
        },
      },
    },
  );

  if (orderId) {
    await DeliveryAssignment.updateMany(
      { orderId },
      {
        $set: {
          providerName,
          ...(externalId ? { externalShipmentId: externalId } : {}),
          providerStatus,
        },
      },
    );
  }

  if (orderId && canonicalStatus) {
    try {
      await applyProviderCanonicalStatusAtomic(orderId, canonicalStatus, {
        providerName,
        providerStatus,
        externalId,
      });
    } catch (e) {
      logger.warn("applyProviderCanonicalStatusAtomic failed", {
        orderId,
        providerName,
        canonicalStatus,
        error: e?.message,
      });
    }
  }

  // Stop polling once terminal
  if (orderId && (canonicalStatus === "DELIVERED" || canonicalStatus === "CANCELLED")) {
    try {
      if (typeof deliveryTrackingQueue.removeRepeatable === "function") {
        await deliveryTrackingQueue.removeRepeatable(DELIVERY_JOB_NAMES.TRACKING_POLL, { every: 120000 }, `track:${orderId}`);
      }
    } catch (e) {
      logger.warn("Failed to remove repeatable tracking job", { orderId, error: e?.message });
    }
  }

  return { accepted: true, orderId, externalId, providerStatus, canonicalStatus };
}

export function registerDeliveryQueueProcessors() {
  if (!isRedisEnabled()) {
    logger.info("Redis disabled, skipping delivery queue processor registration");
    return;
  }

  deliveryShipmentQueue.process(DELIVERY_JOB_NAMES.SHIPMENT_CREATE, processShipmentCreate);
  deliveryCancellationQueue.process(DELIVERY_JOB_NAMES.SHIPMENT_CANCEL, processShipmentCancel);
  deliveryTrackingQueue.process(DELIVERY_JOB_NAMES.TRACKING_POLL, processTrackingPoll);
  deliveryWebhookQueue.process(DELIVERY_JOB_NAMES.WEBHOOK_PROCESS, processWebhook);

  logger.info("Delivery queue processors registered", {
    queues: ["delivery:shipment", "delivery:cancellation", "delivery:tracking", "delivery:webhook"],
  });
}
