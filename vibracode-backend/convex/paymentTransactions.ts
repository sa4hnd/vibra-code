import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * PAYMENT TRANSACTIONS - Single responsibility: Payment transaction tracking
 * This file ONLY handles payment transaction records and queries
 */

// Create a new payment transaction
export const createTransaction = mutation({
  args: {
    userId: v.string(),
    transactionId: v.string(),
    type: v.union(
      v.literal('payment'),
      v.literal('refund'),
      v.literal('chargeback'),
      v.literal('adjustment'),
      v.literal('subscription_change'),
      v.literal('failed_payment')
    ),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('refunded'),
      v.literal('disputed')
    ),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    messagesAdded: v.optional(v.number()),
    subscriptionPlan: v.optional(v.string()),
    processedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const transactionId = await ctx.db.insert('paymentTransactions', {
      ...args,
      createdAt: Date.now(),
    });

    return transactionId;
  },
});

// Get transactions for a user
export const getUserTransactions = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query('paymentTransactions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(args.limit || 50);

    return transactions.map((tx) => ({
      ...tx,
      id: tx._id,
    }));
  },
});

// Get transaction by ID
export const getTransactionById = query({
  args: { transactionId: v.string() },
  handler: async (ctx, args) => {
    const transaction = await ctx.db
      .query('paymentTransactions')
      .withIndex('by_transactionId', (q) => q.eq('transactionId', args.transactionId))
      .first();

    if (!transaction) return null;

    return {
      ...transaction,
      id: transaction._id,
    };
  },
});

// Get transactions by type
export const getTransactionsByType = query({
  args: {
    type: v.union(
      v.literal('payment'),
      v.literal('refund'),
      v.literal('chargeback'),
      v.literal('adjustment'),
      v.literal('subscription_change'),
      v.literal('failed_payment')
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query('paymentTransactions')
      .withIndex('by_type', (q) => q.eq('type', args.type))
      .order('desc')
      .take(args.limit || 100);

    return transactions.map((tx) => ({
      ...tx,
      id: tx._id,
    }));
  },
});

// Get transactions by status
export const getTransactionsByStatus = query({
  args: {
    status: v.union(
      v.literal('pending'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('refunded'),
      v.literal('disputed')
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query('paymentTransactions')
      .withIndex('by_status', (q) => q.eq('status', args.status))
      .order('desc')
      .take(args.limit || 100);

    return transactions.map((tx) => ({
      ...tx,
      id: tx._id,
    }));
  },
});

// Update transaction status
export const updateTransactionStatus = mutation({
  args: {
    transactionId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('refunded'),
      v.literal('disputed')
    ),
    processedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db
      .query('paymentTransactions')
      .withIndex('by_transactionId', (q) => q.eq('transactionId', args.transactionId))
      .first();

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    await ctx.db.patch(transaction._id, {
      status: args.status,
      processedAt: args.processedAt || Date.now(),
    });

    return transaction._id;
  },
});

// Get revenue analytics
export const getRevenueAnalytics = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startDate = args.startDate || 0;
    const endDate = args.endDate || Date.now();

    const transactions = await ctx.db
      .query('paymentTransactions')
      .withIndex('by_processedAt', (q) =>
        q.gte('processedAt', startDate).lte('processedAt', endDate)
      )
      .collect();

    const analytics = {
      totalRevenue: 0,
      totalTransactions: 0,
      successfulPayments: 0,
      failedPayments: 0,
      refunds: 0,
      chargebacks: 0,
      byPlan: {} as Record<string, { count: number; revenue: number }>,
      byType: {} as Record<string, { count: number; revenue: number }>,
    };

    for (const tx of transactions) {
      if (tx.status === 'succeeded' && tx.type === 'payment') {
        analytics.totalRevenue += tx.amount;
        analytics.successfulPayments++;
      } else if (tx.status === 'failed') {
        analytics.failedPayments++;
      } else if (tx.type === 'refund') {
        analytics.refunds++;
        analytics.totalRevenue -= Math.abs(tx.amount);
      } else if (tx.type === 'chargeback') {
        analytics.chargebacks++;
        analytics.totalRevenue -= Math.abs(tx.amount);
      }

      analytics.totalTransactions++;

      // By plan
      if (tx.subscriptionPlan) {
        if (!analytics.byPlan[tx.subscriptionPlan]) {
          analytics.byPlan[tx.subscriptionPlan] = { count: 0, revenue: 0 };
        }
        analytics.byPlan[tx.subscriptionPlan].count++;
        if (tx.status === 'succeeded') {
          analytics.byPlan[tx.subscriptionPlan].revenue += tx.amount;
        }
      }

      // By type
      if (!analytics.byType[tx.type]) {
        analytics.byType[tx.type] = { count: 0, revenue: 0 };
      }
      analytics.byType[tx.type].count++;
      if (tx.status === 'succeeded') {
        analytics.byType[tx.type].revenue += tx.amount;
      }
    }

    return analytics;
  },
});

// Get all transactions (admin only)
export const getAllTransactions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query('paymentTransactions')
      .order('desc')
      .take(args.limit || 1000);

    return transactions.map((tx) => ({
      ...tx,
      id: tx._id,
    }));
  },
});

// Create a test payment transaction (for debugging)
export const createTestTransaction = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    type: v.optional(
      v.union(
        v.literal('payment'),
        v.literal('refund'),
        v.literal('chargeback'),
        v.literal('adjustment'),
        v.literal('subscription_change'),
        v.literal('failed_payment')
      )
    ),
  },
  handler: async (ctx, args) => {
    const transactionId = await ctx.db.insert('paymentTransactions', {
      userId: args.userId,
      transactionId: `test_${Date.now()}`,
      type: args.type || 'payment',
      amount: args.amount,
      currency: 'usd',
      status: 'succeeded',
      description: `Test ${args.type || 'payment'} transaction`,
      messagesAdded: args.amount > 0 ? 25 : 5, // Messages for test
      subscriptionPlan: args.amount > 0 ? 'pro' : 'free',
      processedAt: Date.now(),
      createdAt: Date.now(),
      metadata: {
        test: true,
        createdBy: 'admin',
      },
    });

    return transactionId;
  },
});
