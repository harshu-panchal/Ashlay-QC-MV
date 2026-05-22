import mongoose from "mongoose";

const deliveryShipmentSchema = new mongoose.Schema(
  {
    orderMongoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    providerName: {
      type: String,
      required: true,
      index: true,
    },
    externalShipmentId: {
      type: String,
      default: null,
      index: true,
    },
    trackingUrl: {
      type: String,
      default: null,
    },
    labelUrl: {
      type: String,
      default: null,
    },
    providerStatus: {
      type: String,
      default: null,
      index: true,
    },
    canonicalStatus: {
      type: String,
      default: null,
      index: true,
    },
    timeline: [
      {
        at: { type: Date, default: Date.now },
        providerStatus: { type: String, default: null },
        canonicalStatus: { type: String, default: null },
        location: { type: String, default: null },
        etaTimestamp: { type: Date, default: null },
        meta: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    webhookLog: [
      {
        at: { type: Date, default: Date.now },
        eventId: { type: String, default: null, index: true },
        payload: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    meta: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

deliveryShipmentSchema.index({ orderId: 1, createdAt: -1 });
deliveryShipmentSchema.index({ providerName: 1, externalShipmentId: 1 }, { unique: true, sparse: true });
deliveryShipmentSchema.index({ providerName: 1, providerStatus: 1, createdAt: -1 });

export default mongoose.model("DeliveryShipment", deliveryShipmentSchema);

