/**
 * RevenueCat Sync Service (App Side)
 *
 * FALLBACK sync path for when app is opened/foregrounded.
 * Primary sync happens via webhook, but this ensures we catch up
 * if webhooks fail or are delayed.
 *
 * Uses the same parsing logic as the webhook sync for consistency.
 */

import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../convex/_generated/api';
import { getPlanConfig, getMessagesForPlan, getCreditsForPlan } from '../../lib/plans';
import { ENV } from '../config/env';
import { getPlanIdFromProductId, ENTITLEMENTS } from '../config/revenuecat';

const convex = new ConvexHttpClient(ENV.CONVEX_URL);

// Plan hierarchy for determining upgrades/downgrades
const PLAN_HIERARCHY = ['free', 'weekly_plus', 'pro', 'business', 'enterprise'];

interface ParsedEntitlement {
  plan: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due' | 'paused' | 'inactive';
  expiresAt: number | null;
  transactionId: string | null;
  willRenew: boolean;
  isTrialPeriod: boolean;
  productId: string | null;
}

/**
 * Sync RevenueCat CustomerInfo with Convex database
 *
 * This is a FALLBACK sync path. Primary sync happens via webhook.
 * Handles:
 * - App restarts when webhook may have failed
 * - Initial app load before any webhook fires
 * - Manual refresh by user
 */
export async function syncCustomerInfo(clerkId: string, customerInfo: any): Promise<void> {
  try {
    // Get current user state
    const user = await convex.query(api.usage.getUserByClerkId, { clerkId });
    const agentType = user?.agentType || 'cursor';
    const billingMode = agentType === 'cursor' ? 'tokens' : 'credits';
    const oldPlan = user?.subscriptionPlan || 'free';

    // Parse entitlement using consistent logic
    const premiumEntitlement = customerInfo.entitlements?.active?.[ENTITLEMENTS.PREMIUM];
    const syncData = parseEntitlement(premiumEntitlement);

    console.log(`[App Sync] Syncing for ${clerkId}:`, {
      oldPlan,
      newPlan: syncData.plan,
      status: syncData.status,
      billingMode,
    });

    // Sync to database (same mutation as webhook)
    const syncResult = await convex.mutation(api.usage.syncSubscriptionStatus, {
      clerkId,
      subscriptionPlan: syncData.plan,
      subscriptionId: syncData.transactionId || undefined,
      subscriptionStatus: syncData.status,
      accessExpiresAt: syncData.expiresAt || undefined,
      isTrialPeriod: syncData.isTrialPeriod,
      willRenew: syncData.willRenew,
      originalProductId: syncData.productId || undefined,
    });

    const tokensGranted = syncResult?.tokensGranted || false;

    // Handle credit allocation for credit mode
    if (tokensGranted && billingMode === 'credits' && syncData.plan !== 'free') {
      try {
        await convex.mutation(api.billingSwitch.allocateResourcesForPlan, {
          clerkId,
          planId: syncData.plan,
          transactionId: syncData.transactionId || `rc_${Date.now()}_${clerkId}`,
        });
        console.log(`[App Sync] Credits allocated for plan: ${syncData.plan}`);
      } catch (error) {
        console.error(`[App Sync] Failed to allocate credits:`, error);
      }
    }

    // Record transaction if resources were granted
    if (tokensGranted) {
      await recordTransaction(clerkId, syncData, oldPlan, billingMode, agentType);
    }

    console.log(`[App Sync] Completed for ${clerkId}:`, {
      tokensGranted,
      plan: syncData.plan,
    });
  } catch (error) {
    console.error('[App Sync] Error:', error);
    throw error;
  }
}

/**
 * Parse RevenueCat entitlement into our internal format
 * Same logic as webhook sync for consistency
 */
function parseEntitlement(entitlement: any): ParsedEntitlement {
  if (!entitlement) {
    return {
      plan: 'free',
      status: 'inactive',
      expiresAt: null,
      transactionId: null,
      willRenew: false,
      isTrialPeriod: false,
      productId: null,
    };
  }

  const productId = entitlement.productIdentifier;
  const plan = getPlanIdFromProductId(productId);

  const expirationDate = entitlement.expirationDate ? new Date(entitlement.expirationDate) : null;
  const gracePeriodExpires = entitlement.gracePeriodExpiresDate
    ? new Date(entitlement.gracePeriodExpiresDate)
    : null;
  const now = new Date();

  // Determine status (same logic as webhook)
  let status: ParsedEntitlement['status'] = 'active';

  if (gracePeriodExpires && gracePeriodExpires > now) {
    status = 'past_due';
  } else if (!entitlement.willRenew && expirationDate && expirationDate > now) {
    status = 'canceled';
  } else if (expirationDate && expirationDate < now) {
    status = 'expired';
  }

  return {
    plan,
    status,
    expiresAt: gracePeriodExpires?.getTime() || expirationDate?.getTime() || null,
    transactionId: entitlement.originalTransactionId || null,
    willRenew: entitlement.willRenew ?? true,
    isTrialPeriod: entitlement.isTrialPeriod ?? false,
    productId,
  };
}

/**
 * Record transaction for audit trail
 */
async function recordTransaction(
  userId: string,
  syncData: ParsedEntitlement,
  oldPlan: string,
  billingMode: 'tokens' | 'credits',
  agentType: string
): Promise<void> {
  const planConfig = getPlanConfig(syncData.plan);
  const messagesToAdd = getMessagesForPlan(syncData.plan);
  const creditsToAdd = getCreditsForPlan(syncData.plan);
  const amount = syncData.isTrialPeriod ? 0 : planConfig?.price || 0;

  // Determine transaction type
  const isNewPurchase = oldPlan === 'free' && syncData.plan !== 'free';
  const oldIndex = PLAN_HIERARCHY.indexOf(oldPlan);
  const newIndex = PLAN_HIERARCHY.indexOf(syncData.plan);
  const isUpgrade = newIndex > oldIndex && oldIndex !== -1;
  const isDowngrade = newIndex < oldIndex && oldIndex !== -1;

  const transactionType = isUpgrade || isDowngrade ? 'subscription_change' : 'payment';
  const description = isNewPurchase
    ? `Initial purchase: ${syncData.plan}`
    : isUpgrade
      ? `Plan upgrade: ${oldPlan} → ${syncData.plan}`
      : isDowngrade
        ? `Plan downgrade: ${oldPlan} → ${syncData.plan}`
        : `Subscription renewal: ${syncData.plan}`;

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
        source: 'revenuecat_app_sync',
      },
      messagesAdded: billingMode === 'tokens' ? messagesToAdd : 0,
      subscriptionPlan: syncData.plan,
      processedAt: Date.now(),
    });
    console.log(`[App Sync] Transaction recorded: ${description}`);
  } catch (error) {
    console.error(`[App Sync] Failed to record transaction:`, error);
  }
}
