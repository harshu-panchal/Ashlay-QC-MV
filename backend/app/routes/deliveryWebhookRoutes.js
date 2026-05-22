import express from "express";
import { deliveryWebhookRateLimiter } from "../middleware/securityMiddlewares.js";
import { handleDeliveryWebhook } from "../controller/deliveryWebhookController.js";

const router = express.Router();

router.post("/webhook/:provider", deliveryWebhookRateLimiter, handleDeliveryWebhook);

export default router;

