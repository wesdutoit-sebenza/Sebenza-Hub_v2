import { Queue } from "bullmq";
import IORedis from "ioredis";

// Check if Redis is configured
const redisUrl = process.env.REDIS_URL;

let connection: IORedis | null = null;
let screeningQueue: Queue | null = null;
let fraudDetectionQueue: Queue | null = null;

if (redisUrl) {
  try {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    screeningQueue = new Queue("screening", { connection });
    fraudDetectionQueue = new Queue("fraud-detection", { connection });
    console.log("[Queue] Redis connected, screening and fraud detection queues initialized");
  } catch (error) {
    console.error("[Queue] Failed to connect to Redis:", error);
  }
} else {
  console.warn("[Queue] REDIS_URL not configured, background screening and fraud detection disabled");
}

export { connection, screeningQueue, fraudDetectionQueue };

// Helper to check if queue is available
export function isQueueAvailable(): boolean {
  return screeningQueue !== null;
}
