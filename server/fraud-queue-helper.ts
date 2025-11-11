import { fraudDetectionQueue } from "./queue";

export async function queueFraudDetection(
  contentType: 'job_post' | 'cv_upload' | 'candidate_profile' | 'recruiter_profile' | 'organization',
  contentId: string,
  content: any,
  userId?: string
): Promise<void> {
  if (!fraudDetectionQueue) {
    console.warn(`[FraudQueue] Queue not available, skipping fraud detection for ${contentType} ${contentId}`);
    return;
  }

  try {
    await fraudDetectionQueue.add(
      'detect-fraud',
      {
        contentType,
        contentId,
        content,
        userId: userId || null,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
    console.log(`[FraudQueue] Queued fraud detection for ${contentType} ${contentId}`);
  } catch (error) {
    console.error(`[FraudQueue] Failed to queue fraud detection:`, error);
    // Non-blocking - content submission should not fail if fraud detection queueing fails
  }
}
