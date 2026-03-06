import { NextRequest, NextResponse } from 'next/server';
import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { isExpoPushToken } from '@/lib/apns';

export async function POST(request: NextRequest) {
  try {
    const { pushToken, clerkId } = await request.json();

    if (!pushToken || !clerkId) {
      return NextResponse.json(
        { error: 'Missing pushToken or clerkId' },
        { status: 400 }
      );
    }

    // Validate it's an Expo push token
    if (!isExpoPushToken(pushToken)) {
      console.warn(`⚠️ Invalid token format received: ${pushToken.substring(0, 30)}...`);
      return NextResponse.json(
        { error: 'Invalid token format - expected Expo Push Token (ExponentPushToken[...])' },
        { status: 400 }
      );
    }

    // Register the push token for the user
    const result = await fetchMutation(api.pushNotifications.registerPushToken, {
      clerkId,
      pushToken,
    });

    if (!result.success) {
      console.error(`❌ Failed to register push token: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    console.log(`📱 Push token registered for user ${clerkId}:`, {
      tokenPrefix: pushToken.substring(0, 30) + '...',
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    return NextResponse.json(
      { error: 'Failed to register push token' },
      { status: 500 }
    );
  }
}
