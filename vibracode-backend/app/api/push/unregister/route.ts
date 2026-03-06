import { NextRequest, NextResponse } from 'next/server';
import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export async function POST(request: NextRequest) {
  try {
    const { clerkId } = await request.json();

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Missing clerkId' },
        { status: 400 }
      );
    }

    // Clear the push token for the user
    const result = await fetchMutation(api.pushNotifications.clearPushToken, {
      clerkId,
    });

    console.log(`📱 Push token cleared for user ${clerkId}`);

    return NextResponse.json({
      success: result.success,
    });
  } catch (error) {
    console.error('Error clearing push token:', error);
    return NextResponse.json(
      { error: 'Failed to clear push token' },
      { status: 500 }
    );
  }
}
