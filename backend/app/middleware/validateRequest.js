import handleResponse from "../utils/helper.js";

/**
 * Middleware to validate request payload using Joi schemas.
 * 
 * @param {Object} schema - Joi schema to validate against
 * @param {String} source - Request property to validate (body, query, params)
 * @returns {Function} Express middleware
 */
export const validateRequest = (schema, source = "body") => {
  return (req, res, next) => {
    if (!schema) return next();

    const payload = req[source] || {};
    const { error, value } = schema.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((item) => item.message).join("; ");
      return handleResponse(res, 400, `Validation Error: ${message}`);
    }

    // Replace request payload with validated and sanitized data
    req[source] = value;
    next();
  };
};
