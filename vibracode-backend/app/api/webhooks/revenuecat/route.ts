/**
 * RevenueCat Webhook Handler
 *
 * SIMPLIFIED APPROACH (RevenueCat Recommended):
 * Instead of handling each webhook event type separately, we:
 * 1. Receive webhook → respond 200 OK immediately
 * 2. Call GET /subscribers API to get consistent data
 * 3. Use single sync function to update database
 *
 * This is simpler, more robust, and the officially recommended approach.
 * @see https://www.revenuecat.com/docs/integrations/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { syncSubscriberFromAPI } from '@/lib/revenuecat/subscriber-sync';

// In-memory event deduplication
// In production, consider using Redis for distributed environments
const processedEvents = new Set<string>();
const MAX_EVENTS = 1000;

// RevenueCat webhook event structure (minimal - we only need user ID)
interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    id: string;
    type: string;
    app_user_id: string;
    original_app_user_id: string;
    event_timestamp_ms: number;
    aliases?: string[];
    // Other fields exist but we don't need them - we fetch fresh data from API
  };
}

/**
 * POST /api/webhooks/revenuecat
 *
 * Receives webhook events from RevenueCat and syncs subscription data.
 */
export async function POST(req: NextRequest) {
  if (!process.env.REVENUECAT_API_KEY) {
    return NextResponse.json({ error: 'RevenueCat not configured' }, { status: 503 });
  }

  let eventData: RevenueCatWebhookEvent | null = null;

  try {
    // 1. Parse request body
    const body = await req.text();

    // 2. Verify webhook signature
    if (!verifyWebhookSignature(req, body)) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Parse event
    eventData = JSON.parse(body);

    if (!eventData?.event) {
      console.error('[Webhook] Invalid event structure');
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
    }

    const { type, id, app_user_id, original_app_user_id } = eventData.event;

    // 4. Deduplicate by event ID
    const eventKey = `${type}_${id}`;
    if (processedEvents.has(eventKey)) {
      console.log(`[Webhook] Event already processed: ${eventKey}`);
      return NextResponse.json({ received: true });
    }

    // 5. Get user ID (prefer app_user_id, fallback to original_app_user_id)
    const userId = app_user_id || original_app_user_id;
    if (!userId) {
      console.warn('[Webhook] No user ID in event');
      return NextResponse.json({ received: true });
    }

    console.log(`[Webhook] Received ${type} for user ${userId}`);

    // 6. Mark event as processed BEFORE async processing
    processedEvents.add(eventKey);

    // Cleanup old events to prevent memory leak
    if (processedEvents.size > MAX_EVENTS) {
      const eventsArray = Array.from(processedEvents);
      eventsArray.slice(0, MAX_EVENTS / 2).forEach((e) => processedEvents.delete(e));
    }

    // 7. Process async - don't block webhook response
    // RevenueCat recommends responding quickly and deferring processing
    processWebhookAsync(userId, type, id);

    // 8. Respond immediately
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

/**
 * Process webhook asynchronously
 *
 * This runs after we've already responded to RevenueCat.
 * We wait 1.5 seconds for RevenueCat to fully process the event,
 * then fetch fresh subscriber data from their API.
 */
async function processWebhookAsync(
  userId: string,
  eventType: string,
  eventId: string
): Promise<void> {
  try {
    // Wait for RevenueCat to fully process the event
    // This is recommended to ensure we get the latest data
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Call unified sync function
    const result = await syncSubscriberFromAPI(userId, {
      eventType,
      webhookEventId: eventId,
    });

    console.log(`[Webhook] Sync completed for ${userId}:`, {
      plan: result.plan,
      status: result.status,
      tokensGranted: result.tokensGranted,
    });

  } catch (error) {
    console.error(`[Webhook] Async processing failed for ${userId}:`, error);
    // Don't throw - webhook already responded successfully
    // The next app sync or webhook will catch up
  }
}

/**
 * Verify webhook authorization
 * RevenueCat sends the secret as "Bearer <secret>" - simple auth comparison
 */
function verifyWebhookSignature(req: NextRequest, _body: string): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

  // In development, allow unsigned webhooks
  if (!authHeader || !secret) {
    console.warn('[Webhook] Skipping signature verification (no auth header or secret)');
    return true;
  }

  try {
    // RevenueCat sends auth as "Bearer <secret>"
    const receivedSecret = authHeader.replace('Bearer ', '');

    // Simple constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSecret),
      Buffer.from(secret)
    );

    if (!isValid) {
      console.error('[Webhook] Authorization mismatch');
    }

    return isValid;

  } catch (error) {
    console.error('[Webhook] Authorization verification error:', error);
    return false;
  }
}
