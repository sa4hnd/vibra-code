import { fetchMutation, fetchQuery, fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Shared middleware functions for Inngest functions
 */

/**
 * Retry a mutation with exponential backoff for OCC failures
 */
async function retryMutation<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's an OCC failure
      if (error?.message?.includes('OptimisticConcurrencyControlFailure') ||
          error?.code === 'OptimisticConcurrencyControlFailure') {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`⚠️ OCC conflict, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Not an OCC error, throw immediately
      throw error;
    }
  }

  throw lastError;
}

export async function updateSessionStatus(
  id: Id<"sessions">,
  status: string,
  statusMessage?: string,
  tunnelUrl?: string,
  sessionId?: string
) {
  // If setting status to CUSTOM, check if agent was stopped by user
  // This prevents the running Inngest function from overriding the stopped state
  if (status === "CUSTOM") {
    const session = await fetchQuery(api.sessions.getByIdInternal, { id });
    if (session?.agentStopped) {
      console.log(`⚠️ [middleware] Skipping CUSTOM status update - agent was stopped by user`);
      return; // Don't update status - agent was stopped
    }
  }

  await retryMutation(() => fetchMutation(api.sessions.update, {
    id,
    status,
    statusMessage,
    tunnelUrl,
    sessionId,
  }));

  // Send push notification when app becomes ready (RUNNING status)
  if (status === "RUNNING") {
    try {
      // Use Convex action directly to avoid Vercel authentication issues
      await sendAppReadyPushNotification(id);
    } catch (error) {
      console.error("Failed to send app ready push notification:", error);
      // Don't throw - push notification failure shouldn't break the session
    }
  }
}

/**
 * Send push notification when app is ready using Convex action directly
 */
async function sendAppReadyPushNotification(sessionDocId: Id<"sessions">) {
  // Get push token for the session's creator
  const tokenInfo = await fetchQuery(api.pushNotifications.getPushTokenForSessionById, {
    sessionDocId,
  });

  if (!tokenInfo || !tokenInfo.pushToken) {
    console.log(`📱 No push token registered for session ${sessionDocId}`);
    return { success: true, sent: 0 };
  }

  // Get session name using internal query (backend-only, no ownership check needed)
  const session = await fetchQuery(api.sessions.getByIdInternal, { id: sessionDocId });
  const sessionName = session?.name || "Your app";

  // Send notification via Convex action
  const result = await fetchAction(api.pushNotifications.sendNotificationToUser, {
    clerkId: tokenInfo.clerkId,
    title: "App Ready! 🚀",
    body: `Your app "${sessionName}" is ready to preview. Tap to open it.`,
    data: {
      type: "app_ready",
      sessionId: sessionDocId,
      sessionName,
    },
  });

  console.log(`📱 App ready push notification sent for session ${sessionDocId}:`, result);
  return result;
}

export async function addMessage(
  sessionId: Id<"sessions">,
  content: string,
  role: "user" | "assistant",
  additionalData?: any,
  createdAt?: number
) {
  return await retryMutation(() => fetchMutation(api.messages.add, {
    sessionId,
    content,
    role,
    createdAt: createdAt ?? Date.now(), // Use provided timestamp or current time
    ...additionalData,
  }));
}

export async function getSessionData(id: Id<"sessions">) {
  // Use internal query - this is backend-only code, no ownership check needed
  return await fetchQuery(api.sessions.getByIdInternal, { id });
}

export async function getSessionMessages(sessionId: Id<"sessions">) {
  return await fetchQuery(api.messages.getBySession, { sessionId });
}
