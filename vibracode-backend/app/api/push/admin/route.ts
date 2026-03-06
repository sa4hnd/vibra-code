import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { sendExpoPushNotifications, isExpoPushToken } from '@/lib/apns';

/**
 * Admin endpoint for sending custom push notifications
 *
 * POST /api/push/admin
 * Body:
 *   - title: string (required) - Notification title
 *   - body: string (required) - Notification body
 *   - data?: object - Additional data payload
 *   - targetUserIds?: string[] - Specific user clerkIds to send to (if omitted, broadcasts to all)
 *   - adminSecret: string (required) - Admin secret for authentication
 */
export async function POST(request: NextRequest) {
  try {
    const { title, body, data, targetUserIds, adminSecret } = await request.json();

    // Validate admin secret
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: title and body' },
        { status: 400 }
      );
    }

    // Get push tokens
    let tokens: Array<{ clerkId: string; pushToken: string }> = [];

    if (targetUserIds && targetUserIds.length > 0) {
      // Get tokens for specific users
      for (const clerkId of targetUserIds) {
        const tokenInfo = await fetchQuery(api.pushNotifications.getPushTokenForUser, {
          clerkId,
        });
        if (tokenInfo?.pushToken && tokenInfo.notificationsEnabled) {
          tokens.push({ clerkId, pushToken: tokenInfo.pushToken });
        }
      }
    } else {
      // Broadcast to all users with push tokens
      tokens = await fetchQuery(api.pushNotifications.getAllPushTokens, {});
    }

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No users with push tokens found',
      });
    }

    // Filter to valid Expo push tokens
    const validTokens = tokens.filter((t) => isExpoPushToken(t.pushToken));

    if (validTokens.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No valid Expo push tokens found',
      });
    }

    // Build notifications
    const notifications = validTokens.map((t) => ({
      to: t.pushToken,
      title,
      body,
      sound: 'default' as const,
      priority: 'high' as const,
      data: {
        type: 'admin_notification',
        ...data,
      },
    }));

    // Send notifications
    console.log(`📱 Admin sending ${notifications.length} push notifications`);
    const results = await sendExpoPushNotifications(notifications);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    console.log(`✅ Sent ${successful}/${notifications.length} notifications successfully`);

    if (failed.length > 0) {
      console.warn(`⚠️ ${failed.length} notifications failed:`, failed.map((f) => f.error));
    }

    return NextResponse.json({
      success: true,
      sent: successful,
      failed: failed.length,
      total: notifications.length,
      errors: failed.length > 0 ? failed.map((f) => ({ token: f.token.substring(0, 30) + '...', error: f.error })) : undefined,
    });
  } catch (error) {
    console.error('Error sending admin push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
}
