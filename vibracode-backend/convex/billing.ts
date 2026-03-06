import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * BILLING MANAGEMENT - Single responsibility: Subscription lifecycle and access control
 * This file handles grace periods, refunds, cancellations, and access management
 */

// Configuration for billing behavior
const BILLING_CONFIG = {
  DEFAULT_GRACE_PERIOD_DAYS: 7, // 7 days grace period for cancellations
  REFUND_ACCESS_REVOCATION_HOURS: 24, // Revoke access within 24 hours of refund
  MONTHLY_CREDIT_RENEWAL_DAYS: 30, // Renew credits every 30 days
};

/**
 * Check if user has active pro access (considering billing periods)
 */
export const hasActiveProAccess = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) return false;

    // If user has active pro subscription (not canceled)
    if (
      user.subscriptionPlan === 'pro' &&
      user.subscriptionStatus === 'active' &&
      !user.isCanceled
    ) {
      return true;
    }

    // If user canceled but still within their billing period
    if (user.isCanceled && user.billingPeriodEnd) {
      return Date.now() < user.billingPeriodEnd;
    }

    // If user has access expiration set (fallback)
    if (user.accessExpiresAt) {
      return Date.now() < user.accessExpiresAt;
    }

    return false;
  },
});

/**
 * Handle subscription cancellation - user keeps access until end of billing period
 */
export const handleSubscriptionCancellation = mutation({
  args: {
    clerkId: v.string(),
    subscriptionId: v.string(),
    billingPeriodEnd: v.optional(v.number()), // When current billing period ends
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate billing period end (if not provided, assume 30 days from last payment)
    const lastPayment = user.lastPaymentDate || Date.now();
    const billingPeriodEnd = args.billingPeriodEnd || lastPayment + 30 * 24 * 60 * 60 * 1000; // 30 days from last payment

    console.log(
      `🔄 Canceling subscription for user ${args.clerkId} - access until ${new Date(billingPeriodEnd).toISOString()}`
    );

    await ctx.db.patch(user._id, {
      // Keep subscription plan as 'pro' until billing period ends
      subscriptionStatus: 'canceled',
      subscriptionId: args.subscriptionId,

      // Billing period settings
      isCanceled: true,
      cancellationDate: Date.now(),
      billingPeriodEnd,
      accessExpiresAt: billingPeriodEnd, // Access expires at end of billing period
    });

    const daysRemaining = Math.ceil((billingPeriodEnd - Date.now()) / (24 * 60 * 60 * 1000));

    return {
      success: true,
      billingPeriodEnd,
      daysRemaining,
      message: `Subscription canceled - user has ${daysRemaining} days of pro access remaining`,
    };
  },
});

/**
 * Handle refund with immediate access revocation
 */
export const handleRefund = mutation({
  args: {
    clerkId: v.string(),
    refundAmount: v.number(),
    transactionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    console.log(`💸 Processing refund for user ${args.clerkId}: $${args.refundAmount}`);

    // Immediately revoke pro access
    await ctx.db.patch(user._id, {
      subscriptionPlan: 'free',
      subscriptionStatus: 'refunded',

      // Remove grace period
      isInGracePeriod: false,
      accessExpiresAt: null,

      // Adjust credits (remove credits equivalent to refund amount)
      creditsUSD: Math.max(0, (user.creditsUSD || 0) - args.refundAmount * 2), // Remove 2x credits for refund
    });

    return {
      success: true,
      message: 'Access revoked immediately due to refund',
      creditsRemoved: args.refundAmount * 2,
    };
  },
});

/**
 * Handle subscription renewal (monthly billing)
 */
export const handleSubscriptionRenewal = mutation({
  args: {
    clerkId: v.string(),
    subscriptionId: v.string(),
    plan: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    console.log(`🔄 Processing subscription renewal for user ${args.clerkId}: ${args.plan} plan`);

    const creditsToAdd = args.plan === 'pro' ? 40 : 5; // Pro gets $40, free gets $5

    await ctx.db.patch(user._id, {
      subscriptionPlan: args.plan,
      subscriptionStatus: 'active',
      subscriptionId: args.subscriptionId,

      // Add monthly credits
      creditsUSD: (user.creditsUSD || 0) + creditsToAdd,
      totalPaidUSD: (user.totalPaidUSD || 0) + args.amount,
      lastPaymentDate: Date.now(),

      // Clear grace period
      isInGracePeriod: false,
      accessExpiresAt: null,
    });

    return {
      success: true,
      creditsAdded: creditsToAdd,
      newBalance: (user.creditsUSD || 0) + creditsToAdd,
      message: `Renewed ${args.plan} subscription with ${creditsToAdd} credits`,
    };
  },
});

/**
 * Check and expire billing periods (run this as a scheduled job)
 */
export const expireBillingPeriods = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find users whose billing periods have ended
    const expiredUsers = await ctx.db
      .query('users')
      .filter((q) =>
        q.and(q.eq(q.field('isCanceled'), true), q.lt(q.field('billingPeriodEnd'), now))
      )
      .collect();

    console.log(`⏰ Expiring billing periods for ${expiredUsers.length} users`);

    for (const user of expiredUsers) {
      await ctx.db.patch(user._id, {
        subscriptionPlan: 'free', // Downgrade to free plan
        subscriptionStatus: 'expired',
        isCanceled: false, // Clear cancellation flag
        billingPeriodEnd: null,
        accessExpiresAt: null,
        // Reset credits when billing period ends
        creditsUSD: 0,
        totalPaidUSD: 0,
      });

      console.log(
        `✅ Expired billing period for user ${user.clerkId} - downgraded to free, credits reset`
      );
    }

    return {
      success: true,
      expiredCount: expiredUsers.length,
      message: `Expired billing periods for ${expiredUsers.length} users`,
    };
  },
});

/**
 * Get billing status for a user (including billing period info)
 */
export const getBillingStatus = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) return null;

    // Check if user has active pro access
    let hasProAccess = false;
    if (
      user.subscriptionPlan === 'pro' &&
      user.subscriptionStatus === 'active' &&
      !user.isCanceled
    ) {
      hasProAccess = true;
    } else if (user.isCanceled && user.billingPeriodEnd) {
      hasProAccess = Date.now() < user.billingPeriodEnd;
    } else if (user.accessExpiresAt) {
      hasProAccess = Date.now() < user.accessExpiresAt;
    }

    const daysRemaining = user.billingPeriodEnd
      ? Math.ceil((user.billingPeriodEnd - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      hasProAccess,
      isCanceled: user.isCanceled || false,
      cancellationDate: user.cancellationDate,
      billingPeriodEnd: user.billingPeriodEnd,
      accessExpiresAt: user.accessExpiresAt,
      daysRemaining,
      creditsUSD: user.creditsUSD || 0,
      totalPaidUSD: user.totalPaidUSD || 0,
      lastPaymentDate: user.lastPaymentDate,
    };
  },
});

/**
 * Manual access revocation (for admin use)
 */
export const revokeAccess = mutation({
  args: {
    clerkId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    console.log(`🚫 Manually revoking access for user ${args.clerkId}: ${args.reason}`);

    await ctx.db.patch(user._id, {
      subscriptionPlan: 'free',
      subscriptionStatus: 'revoked',

      // Remove grace period
      isInGracePeriod: false,
      accessExpiresAt: null,
    });

    return {
      success: true,
      message: `Access revoked: ${args.reason}`,
    };
  },
});

/**
 * Check for subscription renewals (scheduled job)
 * This runs hourly to catch any missed webhook events
 */
export const checkSubscriptionRenewals = mutation({
  args: {},
  handler: async (ctx) => {
    console.log('🔄 Checking for subscription renewals...');

    // This would typically query your payment provider's API
    // For now, we'll just log that the check ran
    // In a real implementation, you'd:
    // 1. Query Stripe/Clerk API for active subscriptions
    // 2. Compare with your database
    // 3. Handle any discrepancies

    return {
      success: true,
      message: 'Subscription renewal check completed',
      timestamp: Date.now(),
    };
  },
});

/**
 * Weekly cleanup tasks (scheduled job)
 */
export const weeklyCleanup = mutation({
  args: {},
  handler: async (ctx) => {
    console.log('🧹 Running weekly cleanup...');

    // Clean up old payment transactions (keep last 6 months)
    const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
    const oldTransactions = await ctx.db
      .query('paymentTransactions')
      .filter((q) => q.lt(q.field('createdAt'), sixMonthsAgo))
      .collect();

    console.log(`🗑️ Found ${oldTransactions.length} old transactions to clean up`);

    // Archive old transactions instead of deleting (for audit purposes)
    for (const transaction of oldTransactions) {
      await ctx.db.patch(transaction._id, {
        metadata: {
          ...transaction.metadata,
          archived: true,
          archivedAt: Date.now(),
        },
      });
    }

    return {
      success: true,
      message: `Weekly cleanup completed - archived ${oldTransactions.length} old transactions`,
    };
  },
});
