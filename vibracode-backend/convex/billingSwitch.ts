import { v } from 'convex/values';

import { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getMessagesForPlan, getCreditsForPlan, getPlanConfig } from '../lib/plans';
import { isYearlyProduct, getProductMultiplier } from '../lib/revenuecat/product-mapping';

/**
 * BILLING SWITCH - Unified billing logic for token vs credit consumption
 *
 * This file handles the switching between billing modes based on GLOBAL agent type:
 * - CURSOR agent → TOKEN mode (1 token = 1 message)
 * - CLAUDE/GEMINI agent → CREDIT mode (real cost tracking with 2x multiplier)
 *
 * IMPORTANT: Agent type is controlled GLOBALLY by admin, not per-user.
 * Use admin.setGlobalAgentType() to switch all users at once.
 */

// Credit system configuration (SECRET - never expose to frontend)
const CREDIT_CONFIG = {
  CREDIT_MULTIPLIER: 2, // User gets 2x credits (pay $20 → get $40)
  COST_RATIO: 0.25, // You spend 25% of credit value (4x markup)
  DEFAULT_CREDITS: 5, // New users get $5 credits
  MIN_CREDITS_FOR_MESSAGE: 0.01, // Minimum credits needed to send message
};

/**
 * Helper: Get billing mode based on agent type
 */
export function getBillingMode(agentType: string): 'tokens' | 'credits' {
  return agentType === 'cursor' ? 'tokens' : 'credits';
}

/**
 * Internal helper: Get global agent type from config
 */
async function getGlobalAgentTypeInternal(ctx: any): Promise<string> {
  const config = await ctx.db
    .query('globalConfig')
    .withIndex('by_key', (q: any) => q.eq('key', 'agentType'))
    .first();

  return config?.value || 'cursor';
}

/**
 * Check if user can send a message based on GLOBAL agent type and billing mode
 * Returns unified response with remaining balance info
 */
export const canSendMessage = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return {
        canSend: false,
        reason: 'User not found',
        billingMode: 'tokens' as const,
        remaining: 0,
      };
    }

    // Get GLOBAL agent type (not per-user)
    const agentType = await getGlobalAgentTypeInternal(ctx);
    const billingMode = getBillingMode(agentType);

    if (billingMode === 'tokens') {
      const messagesRemaining = user.messagesRemaining || 0;
      return {
        canSend: messagesRemaining > 0,
        reason: messagesRemaining > 0 ? null : 'No tokens remaining',
        billingMode: 'tokens' as const,
        remaining: messagesRemaining,
        agentType,
      };
    } else {
      const creditsUSD = user.creditsUSD || 0;
      const hasEnough = creditsUSD >= CREDIT_CONFIG.MIN_CREDITS_FOR_MESSAGE;
      return {
        canSend: hasEnough,
        reason: hasEnough ? null : 'Insufficient credits',
        billingMode: 'credits' as const,
        remaining: creditsUSD,
        agentType,
      };
    }
  },
});

/**
 * Consume resource based on GLOBAL agent type (called AFTER message processing)
 *
 * For TOKEN mode: Deducts 1 token per message
 * For CREDIT mode: Deducts credits based on actual Claude API cost
 */
export const consumeResource = mutation({
  args: {
    clerkId: v.string(),
    messageCostUSD: v.optional(v.number()), // Only required for credit mode
    messageId: v.optional(v.id('messages')), // For cost tracking
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Get GLOBAL agent type (not per-user)
    const agentType = await getGlobalAgentTypeInternal(ctx);
    const billingMode = getBillingMode(agentType);

    console.log(`💳 consumeResource: User ${user._id}, Mode: ${billingMode}, Agent: ${agentType}`);

    if (billingMode === 'tokens') {
      // TOKEN MODE: 1 message = 1 token
      const messagesRemaining = user.messagesRemaining || 0;

      if (messagesRemaining <= 0) {
        throw new Error('No tokens remaining');
      }

      await ctx.db.patch(user._id, {
        messagesRemaining: messagesRemaining - 1,
        messagesUsed: (user.messagesUsed || 0) + 1,
      });

      console.log(`✅ Token consumed. Remaining: ${messagesRemaining - 1}`);

      return {
        consumed: 1,
        type: 'token' as const,
        remaining: messagesRemaining - 1,
        billingMode: 'tokens' as const,
      };
    } else {
      // CREDIT MODE: Deduct based on actual Claude API cost
      if (!args.messageCostUSD || args.messageCostUSD <= 0) {
        console.log(`⚠️ No cost provided for credit mode, skipping deduction`);
        return {
          consumed: 0,
          type: 'credit' as const,
          remaining: user.creditsUSD || 0,
          billingMode: 'credits' as const,
          skipped: true,
        };
      }

      // Calculate credit cost (user pays 4x the real cost due to 25% margin)
      const creditCost = args.messageCostUSD / CREDIT_CONFIG.COST_RATIO;
      const currentCredits = user.creditsUSD || 0;

      if (currentCredits < creditCost) {
        throw new Error('Insufficient credits');
      }

      // Update user's credits and internal cost tracking
      const newCredits = currentCredits - creditCost;
      const newRealCost = (user.realCostUSD || 0) + args.messageCostUSD;
      const newProfit = (user.profitUSD || 0) - args.messageCostUSD;

      await ctx.db.patch(user._id, {
        creditsUSD: newCredits,
        creditsUsed: (user.creditsUsed || 0) + creditCost,
        realCostUSD: newRealCost,
        profitUSD: newProfit,
        lastCostUpdate: Date.now(),
      });

      console.log(
        `✅ Credits deducted. Cost: $${args.messageCostUSD.toFixed(4)}, Credit cost: $${creditCost.toFixed(4)}, Remaining: $${newCredits.toFixed(2)}`
      );

      return {
        consumed: creditCost,
        type: 'credit' as const,
        remaining: newCredits,
        actualCost: args.messageCostUSD,
        billingMode: 'credits' as const,
      };
    }
  },
});

/**
 * Get unified billing status for display
 * Returns appropriate balance info based on GLOBAL billing mode
 */
export const getBillingStatus = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return {
        billingMode: 'tokens' as const,
        agentType: 'cursor',
        canSend: false,
        displayBalance: '0 tokens',
        // Token fields
        tokensRemaining: 0,
        tokensUsed: 0,
        // Credit fields
        creditsRemaining: 0,
        creditsUsed: 0,
      };
    }

    // Get GLOBAL agent type (not per-user)
    const agentType = await getGlobalAgentTypeInternal(ctx);
    const billingMode = getBillingMode(agentType);

    const tokensRemaining = user.messagesRemaining || 0;
    const tokensUsed = user.messagesUsed || 0;
    const creditsRemaining = user.creditsUSD || 0;
    const creditsUsed = user.creditsUsed || 0;

    const canSend =
      billingMode === 'tokens'
        ? tokensRemaining > 0
        : creditsRemaining >= CREDIT_CONFIG.MIN_CREDITS_FOR_MESSAGE;

    const displayBalance =
      billingMode === 'tokens'
        ? `${tokensRemaining} token${tokensRemaining !== 1 ? 's' : ''}`
        : `$${creditsRemaining.toFixed(2)} credits`;

    return {
      billingMode,
      agentType,
      canSend,
      displayBalance,
      // Token fields
      tokensRemaining,
      tokensUsed,
      // Credit fields
      creditsRemaining,
      creditsUsed,
      // Plan info
      subscriptionPlan: user.subscriptionPlan || 'free',
    };
  },
});

/**
 * Allocate resources based on GLOBAL agent type when subscription is purchased/renewed
 *
 * For TOKEN mode: Allocate messages based on plan
 * For CREDIT mode: Allocate credits based on plan (with 2x multiplier)
 *
 * IMPORTANT: Yearly subscriptions get 12x the monthly allocation
 */
export const allocateResourcesForPlan = mutation({
  args: {
    clerkId: v.string(),
    planId: v.string(),
    transactionId: v.optional(v.string()),
    productId: v.optional(v.string()), // RevenueCat product ID to detect yearly
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Get GLOBAL agent type (not per-user)
    const agentType = await getGlobalAgentTypeInternal(ctx);
    const billingMode = getBillingMode(agentType);

    // Get plan config (static import at top of file)
    const plan = getPlanConfig(args.planId);

    if (!plan) {
      throw new Error(`Unknown plan: ${args.planId}`);
    }

    // Check if this is a yearly subscription (12x multiplier)
    const isYearly = isYearlyProduct(args.productId);
    const multiplier = getProductMultiplier(args.productId);

    console.log(
      `📦 Allocating resources for plan ${args.planId}, Mode: ${billingMode}, Product: ${args.productId}, Yearly: ${isYearly}, Multiplier: ${multiplier}x`
    );

    if (billingMode === 'tokens') {
      // TOKEN MODE: Allocate messages (with yearly multiplier)
      const tokensToAllocate = plan.messagesPerMonth * multiplier;

      await ctx.db.patch(user._id, {
        subscriptionPlan: args.planId,
        messagesRemaining: tokensToAllocate,
        messagesUsed: 0,
        lastMessageReset: Date.now(),
        lastGrantedTransactionId: args.transactionId,
      });

      console.log(
        `✅ Allocated ${tokensToAllocate} tokens for plan ${args.planId} (${multiplier}x multiplier)`
      );

      return {
        type: 'tokens' as const,
        allocated: tokensToAllocate,
        planId: args.planId,
        isYearly,
        multiplier,
      };
    } else {
      // CREDIT MODE: Replace credits with plan allocation (with yearly multiplier)
      // NOTE: We REPLACE credits, not add to them, to prevent accumulation bugs
      const creditsToAllocate = plan.creditsUSD * multiplier;

      await ctx.db.patch(user._id, {
        subscriptionPlan: args.planId,
        creditsUSD: creditsToAllocate, // REPLACE, don't add
        creditsUsed: 0, // Reset usage tracking
        totalPaidUSD: (user.totalPaidUSD || 0) + plan.price * multiplier,
        profitUSD: (user.profitUSD || 0) + plan.price * multiplier,
        lastPaymentDate: Date.now(),
        lastGrantedTransactionId: args.transactionId,
      });

      console.log(
        `✅ Allocated $${creditsToAllocate} credits for plan ${args.planId} (${multiplier}x multiplier). Balance reset to: $${creditsToAllocate}`
      );

      return {
        type: 'credits' as const,
        allocated: creditsToAllocate,
        newBalance: creditsToAllocate, // Same as allocated since we replace
        planId: args.planId,
        isYearly,
        multiplier,
      };
    }
  },
});
