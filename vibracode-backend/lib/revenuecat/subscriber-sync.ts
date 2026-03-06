/**
 * Unified Subscriber Sync Function
 *
 * This is the SINGLE source of truth for syncing RevenueCat subscription data.
 * Called by both webhook handler and app sync service.
 *
 * Flow:
 * 1. Fetch subscriber from RevenueCat API (consistent format)
 * 2. Parse entitlements to determine plan, status, expiration
 * 3. Update Convex database via syncSubscriptionStatus mutation
 * 4. Handle credit allocation for credit mode
 * 5. Record transaction if resources were granted
 *
 * @see https://www.revenuecat.com/docs/integrations/webhooks
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { getSubscriber } from './api';
import { getPlanIdFromProductId, ENTITLEMENT_ID, isUpgrade, isDowngrade } from './product-mapping';
import {
  SyncResult,
  ParsedSubscriberData,
  RevenueCatSubscriber,
} from './types';
import { getPlanConfig, getMessagesForPlan, getCreditsForPlan } from '../plans';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface SyncOptions {
  eventType?: string; // For logging (e.g., "INITIAL_PURCHASE", "RENEWAL")
  webhookEventId?: string; // For deduplication logging
  skipApiCall?: boolean; // If true, use provided customerInfo instead of fetching
  customerInfo?: RevenueCatSubscriber; // Pre-fetched customer info (for app sync)
}

/**
 * UNIFIED SYNC FUNCTION
 *
 * Called by:
 * - Webhook handler (after receiving any event)
 * - App sync service (on app open/foreground)
 *
 * This ensures consistent behavior regardless of sync source.
 */
export async function syncSubscriberFromAPI(
  appUserId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { eventType, webhookEventId, skipApiCall, customerInfo } = options;

  console.log(`[Subscriber Sync] Starting sync for user: ${appUserId}`, {
    eventType,
    webhookEventId,
    skipApiCall,
  });

  // Step 1: Get subscriber data
  let subscriber: RevenueCatSubscriber;

  if (skipApiCall && customerInfo) {
    // Use provided customer info (from SDK on app side)
    subscriber = customerInfo;
    console.log(`[Subscriber Sync] Using provided customer info`);
  } else {
    // Fetch from RevenueCat API (recommended approach)
    const response = await getSubscriber(appUserId);
    subscriber = response.subscriber;
    console.log(`[Subscriber Sync] Fetched from API`);
  }

  // Step 2: Parse subscriber data into our format
  const syncData = parseSubscriberData(subscriber, appUserId);

  console.log(`[Subscriber Sync] Parsed data:`, {
    plan: syncData.plan,
    status: syncData.status,
    transactionId: syncData.transactionId?.slice(0, 10) + '...',
    expiresAt: syncData.expiresAt ? new Date(syncData.expiresAt).toISOString() : null,
    willRenew: syncData.willRenew,
  });

  // Step 3: Get user's current state and billing mode from Convex
  // Use getBillingStatus which reads from globalConfig for consistency
  const user = await convex.query(api.usage.getUserByClerkId, { clerkId: appUserId });
  const billingStatus = await convex.query(api.billingSwitch.getBillingStatus, { clerkId: appUserId });
  const agentType = billingStatus?.agentType || 'cursor';
  const billingMode = billingStatus?.billingMode || 'tokens';
  const oldPlan = user?.subscriptionPlan || 'free';

  console.log(`[Subscriber Sync] User state:`, {
    billingMode,
    agentType,
    oldPlan,
    newPlan: syncData.plan,
  });

  // Step 4: Sync to database
  const syncResult = await convex.mutation(api.usage.syncSubscriptionStatus, {
    clerkId: appUserId,
    subscriptionPlan: syncData.plan,
    subscriptionId: syncData.transactionId || undefined,
    subscriptionStatus: syncData.status,
    accessExpiresAt: syncData.expiresAt || undefined,
    isTrialPeriod: syncData.isTrialPeriod,
    willRenew: syncData.willRenew,
    originalProductId: syncData.productId || undefined,
  });

  const tokensGranted = syncResult?.tokensGranted || false;

  console.log(`[Subscriber Sync] Database synced:`, {
    tokensGranted,
    subscriptionIdChanged: syncResult?.subscriptionIdChanged,
  });

  // Step 5: Credits are now handled by syncSubscriptionStatus
  // No need for separate allocateResourcesForPlan call - removed to prevent double allocation

  // Step 6: Record transaction if resources were granted
  if (tokensGranted) {
    await recordTransaction(appUserId, syncData, oldPlan, billingMode, agentType, eventType);
  }

  return {
    ...syncData,
    tokensGranted,
    oldPlan,
  };
}

/**
 * Parse RevenueCat subscriber data into our internal format
 */
function parseSubscriberData(
  subscriber: RevenueCatSubscriber,
  appUserId: string
): ParsedSubscriberData {
  const entitlement = subscriber.entitlements[ENTITLEMENT_ID];

  // No active entitlement = free plan
  if (!entitlement) {
    return {
      userId: appUserId,
      plan: 'free',
      status: 'inactive',
      expiresAt: null,
      transactionId: null,
      willRenew: false,
      isTrialPeriod: false,
      productId: null,
    };
  }

  // Get product and subscription details
  const productId = entitlement.product_identifier;
  const subscription = subscriber.subscriptions[productId];
  const plan = getPlanIdFromProductId(productId);

  // Parse dates
  const now = Date.now();
  const expiresAt = entitlement.expires_date
    ? new Date(entitlement.expires_date).getTime()
    : null;
  const gracePeriodExpiresAt = entitlement.grace_period_expires_date
    ? new Date(entitlement.grace_period_expires_date).getTime()
    : null;

  // Determine subscription status
  let status: ParsedSubscriberData['status'] = 'active';

  if (subscription?.billing_issues_detected_at) {
    // Payment failed, in grace period
    status = 'past_due';
  } else if (subscription?.auto_resume_date) {
    // Subscription is paused (Android feature)
    status = 'paused';
  } else if (subscription?.unsubscribe_detected_at && expiresAt && expiresAt > now) {
    // User canceled but still has access until expiration
    status = 'canceled';
  } else if (expiresAt && expiresAt < now) {
    // Subscription has expired
    if (gracePeriodExpiresAt && gracePeriodExpiresAt > now) {
      // In grace period after expiration
      status = 'past_due';
    } else {
      status = 'expired';
    }
  }

  // Determine will renew
  const willRenew =
    !subscription?.unsubscribe_detected_at &&
    !subscription?.billing_issues_detected_at &&
    status === 'active';

  return {
    userId: appUserId,
    plan,
    status,
    expiresAt: gracePeriodExpiresAt || expiresAt,
    transactionId: subscription?.original_transaction_id || null,
    willRenew,
    isTrialPeriod: subscription?.period_type === 'trial',
    productId,
  };
}

/**
 * Record payment transaction for audit trail
 */
async function recordTransaction(
  userId: string,
  syncData: ParsedSubscriberData,
  oldPlan: string,
  billingMode: 'tokens' | 'credits',
  agentType: string,
  eventType?: string
): Promise<void> {
  const planConfig = getPlanConfig(syncData.plan);
  const messagesToAdd = getMessagesForPlan(syncData.plan);
  const creditsToAdd = getCreditsForPlan(syncData.plan);
  const amount = syncData.isTrialPeriod ? 0 : (planConfig?.price || 0);

  // Determine transaction type and description
  const isNewPurchase = oldPlan === 'free' && syncData.plan !== 'free';
  const isPlanUpgrade = isUpgrade(oldPlan, syncData.plan);
  const isPlanDowngrade = isDowngrade(oldPlan, syncData.plan);

  let transactionType: 'payment' | 'subscription_change' = 'payment';
  let description: string;

  if (isNewPurchase) {
    description = `Initial purchase: ${syncData.plan}`;
  } else if (isPlanUpgrade) {
    transactionType = 'subscription_change';
    description = `Plan upgrade: ${oldPlan} → ${syncData.plan}`;
  } else if (isPlanDowngrade) {
    transactionType = 'subscription_change';
    description = `Plan downgrade: ${oldPlan} → ${syncData.plan}`;
  } else {
    description = `Subscription renewal: ${syncData.plan}`;
  }

  const transactionId = syncData.transactionId || `rc_${Date.now()}_${userId}`;

  try {
    await convex.mutation(api.paymentTransactions.createTransaction, {
      userId,
      transactionId,
      type: transactionType,
      amount,
      currency: 'usd',
      status: 'succeeded',
      description,
      metadata: {
        productId: syncData.productId,
        oldPlan,
        newPlan: syncData.plan,
        isTrialPeriod: syncData.isTrialPeriod,
        billingMode,
        agentType,
        creditsAllocated: billingMode === 'credits' ? creditsToAdd : 0,
        source: 'revenuecat_api_sync',
        eventType,
      },
      messagesAdded: billingMode === 'tokens' ? messagesToAdd : 0,
      subscriptionPlan: syncData.plan,
      processedAt: Date.now(),
    });
    console.log(`[Subscriber Sync] Transaction recorded: ${description}`);
  } catch (error) {
    console.error(`[Subscriber Sync] Failed to record transaction:`, error);
    // Don't throw - transaction recording is secondary to subscription update
  }
}

/**
 * Export for app sync service to use the same parsing logic
 */
export { parseSubscriberData };
