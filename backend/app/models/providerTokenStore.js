import mongoose from "mongoose";

const providerTokenStoreSchema = new mongoose.Schema(
  {
    providerName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

providerTokenStoreSchema.index({ providerName: 1, expiresAt: -1 });

export default mongoose.model("ProviderTokenStore", providerTokenStoreSchema);

