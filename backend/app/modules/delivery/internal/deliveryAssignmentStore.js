import DeliveryAssignment from "../../../models/deliveryAssignment.js";
import { isDeliveryModuleEnabled } from "../deliveryFlags.js";

export async function recordDeliveryBroadcastAttempt({
  orderMongoId,
  orderId,
  radiusMeters,
  attempt,
  expiresAt,
}) {
  if (!isDeliveryModuleEnabled()) return null;
  return DeliveryAssignment.create({
    orderMongoId,
    orderId,
    status: "broadcasting",
    radiusMeters,
    attempt,
    expiresAt,
  });
}

export async function markLatestBroadcastAssigned({ orderId, winnerDeliveryId }) {
  if (!isDeliveryModuleEnabled()) return null;
  const lastBroadcast = await DeliveryAssignment.findOne({
    orderId,
    status: "broadcasting",
  }).sort({ createdAt: -1 });
  if (!lastBroadcast) return null;
  lastBroadcast.status = "assigned";
  lastBroadcast.winnerDeliveryId = winnerDeliveryId;
  await lastBroadcast.save();
  return lastBroadcast;
}

