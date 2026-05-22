import { deliveryWebhookQueue, DELIVERY_JOB_NAMES } from "../queues/deliveryQueues.js";
import { getDeliveryProviderByName } from "../modules/delivery/deliveryProviderRegistry.js";

function toBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (body == null) return Buffer.from("", "utf8");
  return Buffer.from(String(body), "utf8");
}

export async function handleDeliveryWebhook(req, res, next) {
  try {
    const providerName = String(req.params.provider || "").toLowerCase().trim();
    if (!providerName) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Provider is required",
        result: { code: "PROVIDER_REQUIRED" },
      });
    }

    const provider = getDeliveryProviderByName(providerName);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "Unknown provider",
        result: { code: "UNKNOWN_PROVIDER", providerName },
      });
    }

    const rawBody = toBuffer(req.body);
    const headers = req.headers || {};

    const skipSig =
      String(process.env.DELIVERY_WEBHOOK_SKIP_SIGNATURE || "").toLowerCase() === "true";

    if (!skipSig) {
      const ok = Boolean(provider.verifyWebhookSignature(rawBody, headers));
      if (!ok) {
        return res.status(401).json({
          success: false,
          error: true,
          message: "Invalid webhook signature",
          result: { code: "INVALID_SIGNATURE" },
        });
      }
    }

    const parsed = provider.parseWebhookPayload(rawBody, headers) || {};

    // Do not block provider: enqueue and respond quickly.
    await deliveryWebhookQueue.add(
      DELIVERY_JOB_NAMES.WEBHOOK_PROCESS,
      {
        providerName,
        receivedAt: new Date().toISOString(),
        parsed,
        headers: {
          "content-type": headers["content-type"],
          "user-agent": headers["user-agent"],
          "x-forwarded-for": headers["x-forwarded-for"],
        },
        rawBody: rawBody.toString("utf8"),
      },
      {
        // If provider supplies an event id, de-dupe by jobId best-effort.
        jobId: parsed?.meta?.eventId
          ? `delivery:webhook:${providerName}:${String(parsed.meta.eventId)}`
          : undefined,
        removeOnComplete: true,
      },
    );

    return res.status(200).json({ success: true, error: false, result: { accepted: true } });
  } catch (error) {
    return next(error);
  }
}

