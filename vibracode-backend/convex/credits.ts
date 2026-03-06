import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * CREDIT SYSTEM - Single responsibility: Credit management and operations
 * This file ONLY handles credit-related operations (balance, deduction, payment)
 */

// SECRET: Credit system configuration (NEVER expose to frontend)
const CREDIT_CONFIG = {
  CREDIT_MULTIPLIER: 2, // User gets 2x credits (pay $20 → get $40)
  COST_RATIO: 0.25, // You spend 25% of credit value
  DEFAULT_CREDITS: 5, // New users get $5 credits
  MIN_CREDITS_FOR_MESSAGE: 0.01, // Minimum credits needed to send message
};

/**
 * PUBLIC: Get user's credit balance (what they can see)
 * SECRET: Never exposes actual costs or profit data
 */
export const getUserCredits = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return null;
    }

    const creditsUSD = user.creditsUSD || 0;
    const creditsUsed = user.creditsUsed || 0;
    const totalPaidUSD = user.totalPaidUSD || 0;

    return {
      creditsUSD,
      creditsUsed,
      totalPaidUSD,
      hasCredits: creditsUSD >= CREDIT_CONFIG.MIN_CREDITS_FOR_MESSAGE,
    };
  },
});

/**
 * SECRET: Check if user has enough credits for a message
 * This is used internally before processing messages
 */
export const checkCreditsForMessage = mutation({
  args: {
    clerkId: v.string(),
    messageCostUSD: v.number(), // Real cost of the message
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate credit cost (SECRET: User pays 4x the real cost)
    const creditCost = args.messageCostUSD / CREDIT_CONFIG.COST_RATIO;
    const currentCredits = user.creditsUSD || 0;

    return {
      hasEnoughCredits: currentCredits >= creditCost,
      creditCost,
      currentCredits,
    };
  },
});

/**
 * SECRET: Deduct credits when user sends a message
 * This updates both credit balance and internal cost tracking
 */
export const deductCreditsForMessage = mutation({
  args: {
    clerkId: v.string(),
    messageCostUSD: v.number(), // Real cost of the message
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      console.log('❌ User not found for clerk ID:', args.clerkId);
      throw new Error('User not found');
    }

    // Calculate credit cost (SECRET: User pays 4x the real cost)
    const creditCost = args.messageCostUSD / CREDIT_CONFIG.COST_RATIO;
    const currentCredits = user.creditsUSD || 0;

    // If insufficient credits, deduct whatever is remaining (allow partial deduction)
    const actualDeduction = Math.min(creditCost, currentCredits);

    if (actualDeduction <= 0) {
      console.log('⚠️ No credits to deduct');
      return {
        creditsDeducted: 0,
        newBalance: currentCredits,
        messageCost: args.messageCostUSD,
        insufficientCredits: true,
      };
    }

    // Update user's credits and internal tracking
    const newRealCost = (user.realCostUSD || 0) + args.messageCostUSD;
    const newProfit = (user.profitUSD || 0) - args.messageCostUSD;

    await ctx.db.patch(user._id, {
      creditsUSD: currentCredits - actualDeduction,
      creditsUsed: (user.creditsUsed || 0) + actualDeduction,
      realCostUSD: newRealCost,
      profitUSD: newProfit,
      lastCostUpdate: Date.now(),
    });

    const result = {
      creditsDeducted: actualDeduction,
      newBalance: currentCredits - actualDeduction,
      messageCost: args.messageCostUSD,
      insufficientCredits: actualDeduction < creditCost,
    };

    console.log('✅ Credit deduction:', result);
    return result;
  },
});

/**
 * SECRET: Deduct credits without message ID (fallback for edge cases)
 * Used when cost is known but message wasn't properly tracked
 */
export const deductCredits = mutation({
  args: {
    clerkId: v.string(),
    amountUSD: v.number(), // Real cost amount
    reason: v.string(), // Why credits are being deducted
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      console.log('❌ User not found for clerk ID:', args.clerkId);
      throw new Error('User not found');
    }

    // Calculate credit cost (SECRET: User pays 4x the real cost)
    const creditCost = args.amountUSD / CREDIT_CONFIG.COST_RATIO;
    const currentCredits = user.creditsUSD || 0;

    // If insufficient credits, deduct whatever is remaining (allow partial deduction)
    const actualDeduction = Math.min(creditCost, currentCredits);

    if (actualDeduction <= 0) {
      console.log('⚠️ No credits to deduct');
      return {
        creditsDeducted: 0,
        newBalance: currentCredits,
        realCost: args.amountUSD,
        reason: args.reason,
        insufficientCredits: true,
      };
    }

    // Update user's credits and internal tracking
    const newRealCost = (user.realCostUSD || 0) + args.amountUSD;
    const newProfit = (user.profitUSD || 0) - args.amountUSD;

    await ctx.db.patch(user._id, {
      creditsUSD: currentCredits - actualDeduction,
      creditsUsed: (user.creditsUsed || 0) + actualDeduction,
      realCostUSD: newRealCost,
      profitUSD: newProfit,
      lastCostUpdate: Date.now(),
    });

    const result = {
      creditsDeducted: actualDeduction,
      newBalance: currentCredits - actualDeduction,
      realCost: args.amountUSD,
      reason: args.reason,
      insufficientCredits: actualDeduction < creditCost,
    };

    console.log('✅ Credit deduction:', result);
    return result;
  },
});

/**
 * PUBLIC: Add credits when user makes payment
 */
export const addCreditsFromPayment = mutation({
  args: {
    clerkId: v.string(),
    paymentAmountUSD: v.number(), // What user paid
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate credits to add (SECRET: User gets 2x what they paid)
    const creditsToAdd = args.paymentAmountUSD * CREDIT_CONFIG.CREDIT_MULTIPLIER;
    const currentCredits = user.creditsUSD || 0;

    // Update user's credits
    await ctx.db.patch(user._id, {
      creditsUSD: currentCredits + creditsToAdd,
      totalPaidUSD: (user.totalPaidUSD || 0) + args.paymentAmountUSD,
      profitUSD: (user.profitUSD || 0) + args.paymentAmountUSD, // Add payment as profit
      lastPaymentDate: Date.now(),
    });

    return {
      creditsAdded: creditsToAdd,
      newBalance: currentCredits + creditsToAdd,
      paymentAmount: args.paymentAmountUSD,
    };
  },
});

/**
 * SECRET: Get internal cost analytics (admin only)
 */
export const getInternalCostAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();

    let totalCreditsUSD = 0;
    let totalCreditsUsed = 0;
    let totalPaidUSD = 0;
    let totalRealCostUSD = 0;
    let totalProfitUSD = 0;

    for (const user of users) {
      totalCreditsUSD += user.creditsUSD || 0;
      totalCreditsUsed += user.creditsUsed || 0;
      totalPaidUSD += user.totalPaidUSD || 0;
      totalRealCostUSD += user.realCostUSD || 0;
      totalProfitUSD += user.profitUSD || 0;
    }

    return {
      totalUsers: users.length,
      totalCreditsUSD,
      totalCreditsUsed,
      totalPaidUSD,
      totalRealCostUSD,
      totalProfitUSD,
      averageProfitPerUser: users.length > 0 ? totalProfitUSD / users.length : 0,
    };
  },
});
