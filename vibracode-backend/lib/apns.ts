/**
 * Expo Push Notification Service
 *
 * Uses Expo's push notification service which handles APNs/FCM automatically.
 * No APNs credentials needed - Expo Go already handles this!
 *
 * Expo Push Token format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushNotification {
  to: string; // Expo push token
  title: string;
  body: string;
  badge?: number;
  sound?: 'default' | null;
  data?: Record<string, unknown>;
  categoryId?: string;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}

interface ExpoPushResult {
  success: boolean;
  token: string;
  error?: string;
  details?: {
    error?: string;
    message?: string;
  };
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

/**
 * Send a push notification via Expo Push Service
 */
export async function sendExpoPushNotification(
  notification: ExpoPushNotification
): Promise<ExpoPushResult> {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      return {
        success: false,
        token: notification.to,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();
    // Expo returns data as object for single, array for batch
    const ticket: ExpoPushTicket = Array.isArray(result.data) ? result.data[0] : result.data;

    if (ticket.status === 'ok') {
      return {
        success: true,
        token: notification.to,
      };
    } else {
      return {
        success: false,
        token: notification.to,
        error: ticket.message || 'Unknown error',
        details: ticket.details,
      };
    }
  } catch (error) {
    return {
      success: false,
      token: notification.to,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send push notifications to multiple Expo push tokens
 */
export async function sendExpoPushNotifications(
  notifications: ExpoPushNotification[]
): Promise<ExpoPushResult[]> {
  // Expo supports batch sending up to 100 notifications at once
  const BATCH_SIZE = 100;
  const results: ExpoPushResult[] = [];

  for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
    const batch = notifications.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        // Mark all in batch as failed
        batch.forEach((n) => {
          results.push({
            success: false,
            token: n.to,
            error: `HTTP ${response.status}`,
          });
        });
        continue;
      }

      const data = await response.json();
      const tickets: ExpoPushTicket[] = data.data || [];

      tickets.forEach((ticket, index) => {
        results.push({
          success: ticket.status === 'ok',
          token: batch[index]?.to || '',
          error: ticket.status === 'error' ? ticket.message : undefined,
          details: ticket.details,
        });
      });
    } catch (error) {
      batch.forEach((n) => {
        results.push({
          success: false,
          token: n.to,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }
  }

  return results;
}

/**
 * Send "App Ready" notification to all registered Expo push tokens for a session
 */
export async function sendAppReadyNotification(
  pushTokens: string[],
  sessionName: string,
  sessionId: string
): Promise<ExpoPushResult[]> {
  if (pushTokens.length === 0) {
    return [];
  }

  const notifications: ExpoPushNotification[] = pushTokens.map((token) => ({
    to: token,
    title: 'App Ready! 🚀',
    body: `Your app "${sessionName}" is ready to preview`,
    sound: 'default',
    priority: 'high',
    categoryId: 'APP_READY',
    data: {
      type: 'app_ready',
      sessionId,
      sessionName,
    },
  }));

  console.log(`📱 Sending ${notifications.length} Expo push notifications for session ${sessionId}`);
  return sendExpoPushNotifications(notifications);
}

/**
 * Check if a token is a valid Expo push token format
 */
export function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

/**
 * Check if a token is a native APNs device token (hex string)
 */
export function isAPNsDeviceToken(token: string): boolean {
  // APNs device tokens are 64-character hex strings
  return /^[a-f0-9]{64}$/i.test(token);
}

/**
 * Format a token for Expo Push service
 * Expo Push can accept:
 * 1. ExponentPushToken[xxx] format
 * 2. Native device tokens with a prefix
 */
export function formatTokenForExpoPush(token: string, platform: 'ios' | 'android' = 'ios'): string {
  // If already an Expo push token, return as-is
  if (isExpoPushToken(token)) {
    return token;
  }

  // If it's a native device token, we need to use the native format
  // For iOS APNs tokens, Expo accepts them directly or we can use Expo's conversion
  if (isAPNsDeviceToken(token)) {
    // Expo Push service accepts native tokens in this format for direct APNs sending
    // But this requires Expo Push credentials setup
    // For Expo Go, the app already has Expo Push Token - we should use that
    console.warn(`⚠️ Received native APNs token instead of Expo Push Token. Token: ${token.substring(0, 20)}...`);
    console.warn('For background notifications in Expo Go, the app should send its Expo Push Token');

    // Return the raw token - the send function will handle it
    return token;
  }

  // Unknown format
  return token;
}

/**
 * Expo Push is always "configured" - no credentials needed for Expo tokens!
 */
export function isAPNsConfigured(): boolean {
  return true; // Expo handles everything
}
