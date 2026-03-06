import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { sendExpoPushNotification, isExpoPushToken } from '@/lib/apns';
import { Id } from '@/convex/_generated/dataModel';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sessionDocId, type, title, body, data } = await request.json();

    // Support both sessionId (sandbox ID) and sessionDocId (Convex document ID)
    if (!sessionId && !sessionDocId) {
      return NextResponse.json(
        { error: 'Missing sessionId or sessionDocId' },
        { status: 400 }
      );
    }

    let tokenInfo;
    let session;

    if (sessionDocId) {
      // Use Convex document ID directly - more reliable
      tokenInfo = await fetchQuery(api.pushNotifications.getPushTokenForSessionById, {
        sessionDocId: sessionDocId as Id<"sessions">,
      });
      // Use internal query - this is backend-only code, no ownership check needed
      session = await fetchQuery(api.sessions.getByIdInternal, { id: sessionDocId as Id<"sessions"> });
    } else {
      // Fallback to sessionId (sandbox ID) lookup
      tokenInfo = await fetchQuery(api.pushNotifications.getPushTokenForSession, {
        sessionId,
      });
      // Note: getBySessionId still needs createdBy - but this is a fallback path
      // that would need the user context to work properly
      session = null; // Skip session lookup for sandbox ID path
    }

    if (!tokenInfo || !tokenInfo.pushToken) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No push token registered for this session\'s user',
      });
    }

    const { pushToken } = tokenInfo;

    // Validate it's an Expo push token
    if (!isExpoPushToken(pushToken)) {
      console.warn(`⚠️ Invalid token format: ${pushToken.substring(0, 30)}...`);
      return NextResponse.json({
        success: false,
        error: 'Invalid push token format - expected Expo Push Token',
      });
    }

    const sessionName = session?.name || 'Your app';

    // Build notification
    let notification;
    if (type === 'app_ready') {
      notification = {
        to: pushToken,
        title: 'App Ready! 🚀',
        body: `Your app "${sessionName}" is ready to preview. Tap to open it.`,
        sound: 'default' as const,
        priority: 'high' as const,
        data: {
          type: 'app_ready',
          sessionId: sessionDocId || sessionId,
          sessionName,
        },
      };
    } else {
      notification = {
        to: pushToken,
        title: title || 'Vibracode',
        body: body || 'You have a new notification',
        sound: 'default' as const,
        data: data || {},
      };
    }

    // Send notification
    console.log(`📱 Sending Expo push notification for session ${sessionDocId || sessionId}`);
    const result = await sendExpoPushNotification(notification);

    if (result.success) {
      console.log(`✅ Push notification sent successfully`);
      return NextResponse.json({
        success: true,
        sent: 1,
      });
    } else {
      console.error(`❌ Push notification failed: ${result.error}`);
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details,
      });
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
}
