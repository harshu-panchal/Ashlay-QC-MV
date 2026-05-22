import Bull from "bull";
import {
  getRedisOptionsForBull,
  isRedisEnabled,
  createBullRedisClient,
} from "../config/redis.js";

const redisOpts = getRedisOptionsForBull();

const queueSettings = {
  stalledInterval: 30000,
  maxStalledCount: 2,
};

function createNoopQueue() {
  return {
    add: async () => ({}),
    getJob: async () => null,
    process: () => {},
    on: () => {},
    close: async () => {},
  };
}

export const deliveryShipmentQueue = isRedisEnabled()
  ? new Bull("delivery:shipment", {
      redis: redisOpts,
      createClient: createBullRedisClient,
      settings: queueSettings,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
  : createNoopQueue();

export const deliveryCancellationQueue = isRedisEnabled()
  ? new Bull("delivery:cancellation", {
      redis: redisOpts,
      createClient: createBullRedisClient,
      settings: queueSettings,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
  : createNoopQueue();

export const deliveryWebhookQueue = isRedisEnabled()
  ? new Bull("delivery:webhook", {
      redis: redisOpts,
      createClient: createBullRedisClient,
      settings: queueSettings,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "fixed", delay: 2000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    })
  : createNoopQueue();

export const deliveryTrackingQueue = isRedisEnabled()
  ? new Bull("delivery:tracking", {
      redis: redisOpts,
      createClient: createBullRedisClient,
      settings: queueSettings,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "fixed", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
  : createNoopQueue();

export const DELIVERY_JOB_NAMES = {
  SHIPMENT_CREATE: "shipment:create",
  SHIPMENT_CANCEL: "shipment:cancel",
  WEBHOOK_PROCESS: "webhook:process",
  TRACKING_POLL: "tracking:poll",
};

