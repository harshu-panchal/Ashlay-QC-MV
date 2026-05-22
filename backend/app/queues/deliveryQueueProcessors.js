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
import {
  cancelShipment,
  createShipment,
  getTrackingInfo,
  mapProviderStatusToWorkflowStatus,
} from "../modules/delivery/deliveryManager.js";

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

  const idemKey = validateIdempotencyKey(payload.idempotencyKey)
    ? payload.idempotencyKey
    : buildIdemKey("shipment:create", { orderId: context.orderId, providerName });

  const cached = await checkIdempotency(idemKey, { providerName, context });
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
    const result = await createShipment({ ...context, preferredProvider: providerName });

    const shipmentDoc = await DeliveryShipment.create({
      orderId: context.orderId,
      orderMongoId: context.orderMongoId,
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
      { orderId: context.orderId },
      {
        $set: {
          providerName,
          externalShipmentId: result?.externalId ?? null,
          trackingUrl: result?.trackingUrl ?? null,
          providerStatus: result?.providerStatus ?? null,
        },
      },
    );

    await storeIdempotencyResult(idemKey, { shipmentId: shipmentDoc._id.toString(), result }, { providerName, context });
    return { shipmentId: shipmentDoc._id.toString(), result };
  } catch (error) {
    if (isRetryableError(error)) {
      await releaseIdempotencyLock(idemKey);
    } else {
      await storeIdempotencyError(idemKey, error, { providerName, context });
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
