import Joi from "joi";

export const rejectDeliveryPartnerSchema = Joi.object({
  reason: Joi.string().required().min(5).max(500).messages({
    "string.empty": "Rejection reason cannot be empty",
    "string.min": "Rejection reason must be at least 5 characters long",
    "string.max": "Rejection reason cannot exceed 500 characters",
    "any.required": "Rejection reason is required",
  }),
});

export const rejectSellerSchema = Joi.object({
  reason: Joi.string().required().min(5).max(500).messages({
    "string.empty": "Rejection reason cannot be empty",
    "string.min": "Rejection reason must be at least 5 characters long",
    "string.max": "Rejection reason cannot exceed 500 characters",
    "any.required": "Rejection reason is required",
  }),
});

export const updateWithdrawalStatusSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
  remarks: Joi.string().allow("").max(500).optional(),
});
