import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

/**
 * POST /api/billing/check-limit
 *
 * Check if a user can send a message based on their billing status.
 * Used by iOS native code before allowing message sends.
 *
 * Request body:
 * { clerkId: string }
 *
 * Response:
 * { canSend: boolean, reason?: string, billingMode: 'tokens' | 'credits', remaining: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerkId } = body;

    if (!clerkId) {
      return NextResponse.json(
        {
          canSend: false,
          reason: 'Missing clerkId',
          billingMode: 'tokens',
          remaining: 0
        },
        { status: 400 }
      );
    }

    // Query Convex for billing status
    const result = await fetchQuery(api.billingSwitch.canSendMessage, {
      clerkId
    });

    return NextResponse.json({
      canSend: result.canSend,
      reason: result.reason,
      billingMode: result.billingMode,
      remaining: result.remaining,
      agentType: result.agentType,
    });
  } catch (error) {
    console.error('Error checking billing limit:', error);
    // On error, allow sending (fail-open to avoid blocking users)
    return NextResponse.json({
      canSend: true,
      reason: 'Error checking limit - allowing message',
      billingMode: 'tokens',
      remaining: -1, // Indicates unknown
      error: true,
    });
  }
}

// Also support GET for simple health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'billing/check-limit',
    method: 'POST',
    description: 'Check if user can send messages based on billing status',
  });
}
