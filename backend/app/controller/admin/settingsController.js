import Setting from "../../models/setting.js";
import handleResponse from "../../utils/helper.js";
import { normalizeProductApprovalConfig } from "../../services/productModerationService.js";
import Joi from "joi";

const updateSettingsSchema = Joi.object({
  appName: Joi.string().allow("").max(200),
  supportEmail: Joi.string().email().allow("").max(200),
  supportPhone: Joi.string().allow("").max(50),
  currencySymbol: Joi.string().allow("").max(10),
  currencyCode: Joi.string().allow("").max(10),
  timezone: Joi.string().allow("").max(100),
  logoUrl: Joi.string().allow("").max(2000),
  faviconUrl: Joi.string().allow("").max(2000),
  primaryColor: Joi.string().allow("").max(50),
  secondaryColor: Joi.string().allow("").max(50),
  companyName: Joi.string().allow("").max(200),
  taxId: Joi.string().allow("").max(100),
  address: Joi.string().allow("").max(500),
  facebook: Joi.string().allow("").max(500),
  twitter: Joi.string().allow("").max(500),
  instagram: Joi.string().allow("").max(500),
  linkedin: Joi.string().allow("").max(500),
  youtube: Joi.string().allow("").max(500),
  playStoreLink: Joi.string().allow("").max(500),
  appStoreLink: Joi.string().allow("").max(500),
  metaTitle: Joi.string().allow("").max(200),
  metaDescription: Joi.string().allow("").max(500),
  metaKeywords: Joi.string().allow("").max(1000),
  keywords: Joi.array().items(Joi.string().max(200)),
  returnDeliveryCommission: Joi.number().min(0),
  deliveryPricingMode: Joi.string().valid("fixed_price", "distance_based"),
  pricingMode: Joi.string().valid("fixed_price", "distance_based"),
  customerBaseDeliveryFee: Joi.number().min(0),
  riderBasePayout: Joi.number().min(0),
  baseDeliveryCharge: Joi.number().min(0),
  baseDistanceCapacityKm: Joi.number().min(0),
  incrementalKmSurcharge: Joi.number().min(0),
  deliveryPartnerRatePerKm: Joi.number().min(0),
  fleetCommissionRatePerKm: Joi.number().min(0),
  fixedDeliveryFee: Joi.number().min(0),
  handlingFeeStrategy: Joi.string().valid(
    "highest_category_fee",
    "sum_of_category_fees",
    "max_single_fee",
    "per_item_fee",
  ),
  codEnabled: Joi.boolean(),
  onlineEnabled: Joi.boolean(),
  lowStockAlertsEnabled: Joi.boolean(),
  productApproval: Joi.object({
    sellerCreateRequiresApproval: Joi.boolean(),
    sellerEditRequiresApproval: Joi.boolean(),
  }).unknown(false),
}).unknown(false);

function flattenForMongoSet(prefix, value, target) {
  if (value === undefined) return;

  const isPlainObject =
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date);

  if (!isPlainObject) {
    target[prefix] = value;
    return;
  }

  const keys = Object.keys(value);
  if (!keys.length) {
    target[prefix] = value;
    return;
  }

  for (const key of keys) {
    flattenForMongoSet(`${prefix}.${key}`, value[key], target);
  }
}

export const getPlatformSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne({});

    if (!settings) {
      settings = await Setting.create({});
    }

    const result = settings?.toObject?.() || settings || {};
    result.productApproval = normalizeProductApprovalConfig(result);

    return handleResponse(
      res,
      200,
      "Platform settings fetched successfully",
      result,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updatePlatformSettings = async (req, res) => {
  try {
    const raw = req.body || {};
    const { error, value } = updateSettingsSchema.validate(raw, {
      stripUnknown: true,
    });

    if (error) {
      return handleResponse(
        res,
        400,
        error.details.map((d) => d.message).join("; "),
      );
    }

    const toSet = {};
    for (const [key, v] of Object.entries(value)) {
      flattenForMongoSet(key, v, toSet);
    }

    if (Object.keys(toSet).length === 0) {
      return handleResponse(res, 200, "Settings unchanged");
    }

    const settings = await Setting.findOneAndUpdate(
      {},
      { $set: toSet },
      { new: true, upsert: true },
    );

    const result = settings?.toObject?.() || settings || {};
    result.productApproval = normalizeProductApprovalConfig(result);

    return handleResponse(
      res,
      200,
      "Platform settings updated successfully",
      result,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
