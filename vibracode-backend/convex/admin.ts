import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * ADMIN FUNCTIONS - For managing users and data from admin dashboard
 * These functions provide full CRUD access to user data
 */

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Get all users with full details
 */
export const getAllUsers = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const users = await ctx.db.query('users').collect();

    // Sort by creation time (newest first)
    const sortedUsers = users.sort((a, b) => b._creationTime - a._creationTime);

    // Apply pagination
    const offset = args.offset || 0;
    const paginatedUsers = sortedUsers.slice(offset, offset + limit);

    return {
      users: paginatedUsers,
      total: users.length,
      hasMore: offset + limit < users.length,
    };
  },
});

/**
 * Get user by ID
 */
export const getUserById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get user by Clerk ID
 */
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();
  },
});

/**
 * Search users by Clerk ID (partial match)
 */
export const searchUsers = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query('users').collect();
    const searchLower = args.searchTerm.toLowerCase();

    return users.filter(
      (user) =>
        user.clerkId.toLowerCase().includes(searchLower) ||
        (user.subscriptionPlan && user.subscriptionPlan.toLowerCase().includes(searchLower))
    );
  },
});

/**
 * Get users by subscription plan
 */
export const getUsersByPlan = query({
  args: { plan: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_subscriptionPlan', (q) => q.eq('subscriptionPlan', args.plan))
      .collect();
  },
});

/**
 * Get user statistics
 */
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();

    const stats = {
      total: users.length,
      byPlan: {} as Record<string, number>,
      byAgentType: {} as Record<string, number>,
      byBillingMode: {} as Record<string, number>,
      totalCreditsUSD: 0,
      totalCreditsUsed: 0,
      totalMessagesRemaining: 0,
      totalMessagesUsed: 0,
      usersWithMissingFields: 0,
    };

    for (const user of users) {
      // Count by plan
      const plan = user.subscriptionPlan || 'free';
      stats.byPlan[plan] = (stats.byPlan[plan] || 0) + 1;

      // Count by agent type
      const agentType = user.agentType || 'unset';
      stats.byAgentType[agentType] = (stats.byAgentType[agentType] || 0) + 1;

      // Count by billing mode
      const billingMode = user.billingMode || 'unset';
      stats.byBillingMode[billingMode] = (stats.byBillingMode[billingMode] || 0) + 1;

      // Sum credits and messages
      stats.totalCreditsUSD += user.creditsUSD || 0;
      stats.totalCreditsUsed += user.creditsUsed || 0;
      stats.totalMessagesRemaining += user.messagesRemaining || 0;
      stats.totalMessagesUsed += user.messagesUsed || 0;

      // Count users missing fields
      if (!user.agentType || !user.billingMode) {
        stats.usersWithMissingFields++;
      }
    }

    return stats;
  },
});

// ============================================================================
// USER MUTATIONS
// ============================================================================

/**
 * Update any user field
 */
export const updateUser = mutation({
  args: {
    userId: v.id('users'),
    updates: v.object({
      subscriptionPlan: v.optional(v.string()),
      subscriptionId: v.optional(v.string()),
      subscriptionStatus: v.optional(v.string()),
      messagesRemaining: v.optional(v.number()),
      messagesUsed: v.optional(v.number()),
      creditsUSD: v.optional(v.number()),
      creditsUsed: v.optional(v.number()),
      agentType: v.optional(v.union(v.literal('cursor'), v.literal('claude'), v.literal('gemini'))),
      billingMode: v.optional(v.union(v.literal('tokens'), v.literal('credits'))),
      isCanceled: v.optional(v.boolean()),
      willRenew: v.optional(v.boolean()),
      isTrialPeriod: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Filter out undefined values
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args.updates)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(args.userId, updates);

    console.log(`✅ Admin updated user ${user.clerkId}:`, updates);

    return { success: true, userId: args.userId, updates };
  },
});

/**
 * Set user credits
 */
export const setUserCredits = mutation({
  args: {
    userId: v.id('users'),
    creditsUSD: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(args.userId, {
      creditsUSD: args.creditsUSD,
    });

    console.log(`✅ Admin set credits for ${user.clerkId}: $${args.creditsUSD}`);

    return { success: true, clerkId: user.clerkId, creditsUSD: args.creditsUSD };
  },
});

/**
 * Set user messages
 */
export const setUserMessages = mutation({
  args: {
    userId: v.id('users'),
    messagesRemaining: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.patch(args.userId, {
      messagesRemaining: args.messagesRemaining,
    });

    console.log(`✅ Admin set messages for ${user.clerkId}: ${args.messagesRemaining}`);

    return { success: true, clerkId: user.clerkId, messagesRemaining: args.messagesRemaining };
  },
});

/**
 * Set user subscription plan
 */
export const setUserPlan = mutation({
  args: {
    userId: v.id('users'),
    subscriptionPlan: v.string(),
    resetMessages: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updates: Record<string, unknown> = {
      subscriptionPlan: args.subscriptionPlan,
    };

    // Optionally reset messages based on new plan
    if (args.resetMessages) {
      // Plan configurations (from lib/plans.ts)
      const planConfig: Record<string, { messages: number; credits: number }> = {
        free: { messages: 5, credits: 5 },
        weekly_plus: { messages: 25, credits: 16 },
        pro: { messages: 100, credits: 40 },
        business: { messages: 300, credits: 100 },
        enterprise: { messages: 1000, credits: 400 },
      };

      const config = planConfig[args.subscriptionPlan] || planConfig.free;
      updates.messagesRemaining = config.messages;
      updates.messagesUsed = 0;
      updates.creditsUSD = config.credits;
      updates.creditsUsed = 0;
      updates.lastMessageReset = Date.now();
    }

    await ctx.db.patch(args.userId, updates);

    console.log(`✅ Admin set plan for ${user.clerkId}: ${args.subscriptionPlan}`);

    return { success: true, clerkId: user.clerkId, ...updates };
  },
});

/**
 * Delete user
 */
export const deleteUser = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    await ctx.db.delete(args.userId);

    console.log(`🗑️ Admin deleted user ${user.clerkId}`);

    return { success: true, clerkId: user.clerkId };
  },
});

// ============================================================================
// GLOBAL CONFIG
// ============================================================================

/**
 * Get global agent type config
 */
export const getGlobalConfig = query({
  args: {},
  handler: async (ctx) => {
    const agentTypeConfig = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'agentType'))
      .first();

    return {
      agentType: agentTypeConfig?.value || 'cursor',
      updatedAt: agentTypeConfig?.updatedAt,
      updatedBy: agentTypeConfig?.updatedBy,
    };
  },
});

/**
 * Set global agent type (affects all new users and billing mode)
 */
export const setGlobalAgentType = mutation({
  args: {
    agentType: v.union(v.literal('cursor'), v.literal('claude'), v.literal('gemini')),
    adminId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'agentType'))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.agentType,
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    } else {
      await ctx.db.insert('globalConfig', {
        key: 'agentType',
        value: args.agentType,
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    }

    console.log(`🌐 Admin set global agent type: ${args.agentType}`);

    return { success: true, agentType: args.agentType };
  },
});

// ============================================================================
// SESSIONS & MESSAGES
// ============================================================================

/**
 * Get all sessions with stats
 */
export const getAllSessions = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const sessions = await ctx.db.query('sessions').collect();

    // Sort by creation time (newest first)
    const sortedSessions = sessions.sort((a, b) => b._creationTime - a._creationTime);

    // Apply pagination
    const offset = args.offset || 0;
    const paginatedSessions = sortedSessions.slice(offset, offset + limit);

    return {
      sessions: paginatedSessions,
      total: sessions.length,
      hasMore: offset + limit < sessions.length,
    };
  },
});

/**
 * Get session stats
 */
export const getSessionStats = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query('sessions').collect();
    const messages = await ctx.db.query('messages').collect();

    const stats = {
      totalSessions: sessions.length,
      byStatus: {} as Record<string, number>,
      totalMessages: messages.length,
      totalCostUSD: 0,
      avgMessagesPerSession: 0,
    };

    for (const session of sessions) {
      const status = session.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      stats.totalCostUSD += session.totalCostUSD || 0;
    }

    stats.avgMessagesPerSession =
      sessions.length > 0 ? Math.round((messages.length / sessions.length) * 10) / 10 : 0;

    return stats;
  },
});

/**
 * Get session analytics with aggregations by status, template, and cost
 * Includes total sessions, average cost, message statistics, and cost breakdown
 * Supports time-based filtering and grouping
 */
export const getSessionAnalytics = query({
  args: {
    startDate: v.optional(v.number()), // Unix timestamp in milliseconds
    endDate: v.optional(v.number()), // Unix timestamp in milliseconds
    groupBy: v.optional(v.union(v.literal('day'), v.literal('week'), v.literal('month'))),
  },
  handler: async (ctx, args) => {
    let allSessions = await ctx.db.query('sessions').collect();
    const messages = await ctx.db.query('messages').collect();

    // Filter sessions by date range if provided
    if (args.startDate !== undefined || args.endDate !== undefined) {
      allSessions = allSessions.filter((session) => {
        const sessionTime = session._creationTime;
        if (args.startDate !== undefined && sessionTime < args.startDate) {
          return false;
        }
        if (args.endDate !== undefined && sessionTime > args.endDate) {
          return false;
        }
        return true;
      });
    }

    const sessions = allSessions;

    // Initialize analytics structure
    const analytics = {
      totalSessions: sessions.length,
      totalMessages: messages.length,
      totalCostUSD: 0,
      avgCostPerSession: 0,
      avgMessagesPerSession: 0,

      // Breakdown by status
      byStatus: {} as Record<
        string,
        {
          count: number;
          totalCost: number;
          avgCost: number;
          messageCount: number;
        }
      >,

      // Breakdown by template
      byTemplate: {} as Record<
        string,
        {
          count: number;
          totalCost: number;
          avgCost: number;
          messageCount: number;
          avgMessagesPerSession: number;
        }
      >,

      // Message statistics
      messageStats: {
        totalMessages: messages.length,
        messagesWithCost: 0,
        avgCostPerMessage: 0,
        totalMessageCost: 0,
      },

      // Cost statistics
      costStats: {
        totalCost: 0,
        minSessionCost: 0,
        maxSessionCost: 0,
        medianSessionCost: 0,
        sessionsWithCost: 0,
      },
    };

    // Calculate session-level aggregations
    const sessionCosts: number[] = [];
    const templateMessageCounts: Record<string, number> = {};

    for (const session of sessions) {
      const sessionCost = session.totalCostUSD || 0;
      const sessionMessageCount = session.messageCount || 0;
      const status = session.status || 'unknown';
      const templateId = session.templateId || 'unknown';

      // Add to total cost
      analytics.totalCostUSD += sessionCost;

      // Track costs for statistics
      if (sessionCost > 0) {
        sessionCosts.push(sessionCost);
        analytics.costStats.sessionsWithCost++;
      }

      // Aggregate by status
      if (!analytics.byStatus[status]) {
        analytics.byStatus[status] = {
          count: 0,
          totalCost: 0,
          avgCost: 0,
          messageCount: 0,
        };
      }
      analytics.byStatus[status].count++;
      analytics.byStatus[status].totalCost += sessionCost;
      analytics.byStatus[status].messageCount += sessionMessageCount;

      // Aggregate by template
      if (!analytics.byTemplate[templateId]) {
        analytics.byTemplate[templateId] = {
          count: 0,
          totalCost: 0,
          avgCost: 0,
          messageCount: 0,
          avgMessagesPerSession: 0,
        };
      }
      analytics.byTemplate[templateId].count++;
      analytics.byTemplate[templateId].totalCost += sessionCost;
      analytics.byTemplate[templateId].messageCount += sessionMessageCount;

      // Track message count per template for average calculation
      if (!templateMessageCounts[templateId]) {
        templateMessageCounts[templateId] = 0;
      }
      templateMessageCounts[templateId] += sessionMessageCount;
    }

    // Calculate averages for status breakdown
    for (const status in analytics.byStatus) {
      const statusData = analytics.byStatus[status];
      statusData.avgCost =
        statusData.count > 0
          ? Math.round((statusData.totalCost / statusData.count) * 100) / 100
          : 0;
    }

    // Calculate averages for template breakdown
    for (const templateId in analytics.byTemplate) {
      const templateData = analytics.byTemplate[templateId];
      templateData.avgCost =
        templateData.count > 0
          ? Math.round((templateData.totalCost / templateData.count) * 100) / 100
          : 0;
      templateData.avgMessagesPerSession =
        templateData.count > 0
          ? Math.round((templateData.messageCount / templateData.count) * 10) / 10
          : 0;
    }

    // Calculate message statistics
    const messagesWithCost = messages.filter((msg) => msg.costUSD !== undefined && msg.costUSD > 0);
    analytics.messageStats.messagesWithCost = messagesWithCost.length;
    analytics.messageStats.totalMessageCost = messagesWithCost.reduce(
      (sum, msg) => sum + (msg.costUSD || 0),
      0
    );
    analytics.messageStats.avgCostPerMessage =
      messagesWithCost.length > 0
        ? Math.round((analytics.messageStats.totalMessageCost / messagesWithCost.length) * 100) /
          100
        : 0;

    // Calculate overall averages
    analytics.avgCostPerSession =
      sessions.length > 0 ? Math.round((analytics.totalCostUSD / sessions.length) * 100) / 100 : 0;
    analytics.avgMessagesPerSession =
      sessions.length > 0 ? Math.round((messages.length / sessions.length) * 10) / 10 : 0;

    // Calculate cost statistics
    analytics.costStats.totalCost = analytics.totalCostUSD;
    if (sessionCosts.length > 0) {
      analytics.costStats.minSessionCost = Math.min(...sessionCosts);
      analytics.costStats.maxSessionCost = Math.max(...sessionCosts);

      // Calculate median
      const sortedCosts = sessionCosts.sort((a, b) => a - b);
      const mid = Math.floor(sortedCosts.length / 2);
      analytics.costStats.medianSessionCost =
        sortedCosts.length % 2 === 0
          ? (sortedCosts[mid - 1] + sortedCosts[mid]) / 2
          : sortedCosts[mid];
      analytics.costStats.medianSessionCost =
        Math.round(analytics.costStats.medianSessionCost * 100) / 100;
    }

    // Add time period grouping if groupBy is specified
    const timeSeriesData: Record<
      string,
      {
        period: string;
        count: number;
        totalCost: number;
        avgCost: number;
        messageCount: number;
        avgMessagesPerSession: number;
      }
    > = {};

    if (args.groupBy) {
      // Helper function to get time period key
      const getTimePeriodKey = (timestamp: number, groupBy: 'day' | 'week' | 'month'): string => {
        const date = new Date(timestamp);

        if (groupBy === 'day') {
          // Format: YYYY-MM-DD
          return date.toISOString().split('T')[0];
        } else if (groupBy === 'week') {
          // Format: YYYY-Www (ISO week number)
          const year = date.getFullYear();
          const startOfYear = new Date(year, 0, 1);
          const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
          const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
          return `${year}-W${weekNum.toString().padStart(2, '0')}`;
        } else {
          // month: Format YYYY-MM
          return date.toISOString().substring(0, 7);
        }
      };

      // Group sessions by time period
      for (const session of sessions) {
        const periodKey = getTimePeriodKey(session._creationTime, args.groupBy);
        const sessionCost = session.totalCostUSD || 0;
        const sessionMessageCount = session.messageCount || 0;

        if (!timeSeriesData[periodKey]) {
          timeSeriesData[periodKey] = {
            period: periodKey,
            count: 0,
            totalCost: 0,
            avgCost: 0,
            messageCount: 0,
            avgMessagesPerSession: 0,
          };
        }

        timeSeriesData[periodKey].count++;
        timeSeriesData[periodKey].totalCost += sessionCost;
        timeSeriesData[periodKey].messageCount += sessionMessageCount;
      }

      // Calculate averages for each time period
      for (const periodKey in timeSeriesData) {
        const periodData = timeSeriesData[periodKey];
        periodData.avgCost =
          periodData.count > 0
            ? Math.round((periodData.totalCost / periodData.count) * 100) / 100
            : 0;
        periodData.avgMessagesPerSession =
          periodData.count > 0
            ? Math.round((periodData.messageCount / periodData.count) * 10) / 10
            : 0;
        periodData.totalCost = Math.round(periodData.totalCost * 100) / 100;
      }
    }

    return {
      ...analytics,
      byTimePeriod: args.groupBy ? timeSeriesData : undefined,
    };
  },
});

/**
 * Get all messages (chat messages from sessions) - content only
 */
export const getAllMessages = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sessionId: v.optional(v.id('sessions')),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;

    let messages;
    if (args.sessionId) {
      messages = await ctx.db
        .query('messages')
        .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId!))
        .collect();
    } else {
      messages = await ctx.db.query('messages').collect();
    }

    // Sort by creation time (newest first)
    const sortedMessages = messages.sort(
      (a, b) => (b.createdAt || b._creationTime) - (a.createdAt || a._creationTime)
    );

    // Apply pagination
    const offset = args.offset || 0;
    const paginatedMessages = sortedMessages.slice(offset, offset + limit);

    // Calculate total cost
    const totalCostUSD = messages.reduce((sum, msg) => sum + (msg.costUSD || 0), 0);

    // Filter out messages with empty content
    const messagesWithContent = paginatedMessages.filter(
      (msg) => msg.content && msg.content.trim().length > 0
    );

    // Return only essential fields (content, role, cost, timestamps)
    const simplifiedMessages = messagesWithContent.map((msg) => ({
      _id: msg._id,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      costUSD: msg.costUSD,
      modelUsed: msg.modelUsed,
      createdAt: msg.createdAt || msg._creationTime,
    }));

    return {
      messages: simplifiedMessages,
      total: messagesWithContent.length,
      hasMore: offset + limit < messages.length,
      totalCostUSD,
    };
  },
});

/**
 * Get messages for a specific session - content only
 */
export const getSessionMessages = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();

    // Sort by creation time (oldest first for chat order)
    const sortedMessages = messages.sort(
      (a, b) => (a.createdAt || a._creationTime) - (b.createdAt || b._creationTime)
    );

    const totalCostUSD = messages.reduce((sum, msg) => sum + (msg.costUSD || 0), 0);

    // Filter out messages with empty content
    const messagesWithContent = sortedMessages.filter(
      (msg) => msg.content && msg.content.trim().length > 0
    );

    // Return only essential fields (content, role, cost, timestamps)
    const simplifiedMessages = messagesWithContent.map((msg) => ({
      _id: msg._id,
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      costUSD: msg.costUSD,
      modelUsed: msg.modelUsed,
      createdAt: msg.createdAt || msg._creationTime,
    }));

    return {
      messages: simplifiedMessages,
      total: messagesWithContent.length,
      totalCostUSD,
    };
  },
});

// ============================================================================
// PAYMENT TRANSACTIONS
// ============================================================================

/**
 * Get all payment transactions
 */
export const getAllTransactions = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    let transactions;
    if (args.userId) {
      transactions = await ctx.db
        .query('paymentTransactions')
        .withIndex('by_userId', (q) => q.eq('userId', args.userId))
        .collect();
    } else {
      transactions = await ctx.db.query('paymentTransactions').collect();
    }

    // Sort by processed date (newest first)
    const sortedTransactions = transactions.sort((a, b) => b.processedAt - a.processedAt);

    // Apply pagination
    const offset = args.offset || 0;
    const paginatedTransactions = sortedTransactions.slice(offset, offset + limit);

    return {
      transactions: paginatedTransactions,
      total: transactions.length,
      hasMore: offset + limit < transactions.length,
    };
  },
});

/**
 * Get transaction stats
 */
export const getTransactionStats = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db.query('paymentTransactions').collect();

    const stats = {
      total: transactions.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      totalRevenue: 0,
      totalRefunds: 0,
    };

    for (const tx of transactions) {
      stats.byType[tx.type] = (stats.byType[tx.type] || 0) + 1;
      stats.byStatus[tx.status] = (stats.byStatus[tx.status] || 0) + 1;

      if (tx.status === 'succeeded' && tx.type === 'payment') {
        stats.totalRevenue += tx.amount;
      } else if (tx.type === 'refund') {
        stats.totalRefunds += Math.abs(tx.amount);
      }
    }

    return stats;
  },
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Fix all users missing agentType or billingMode
 */
export const fixMissingUserFields = mutation({
  args: {},
  handler: async (ctx) => {
    // Get global config
    const config = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'agentType'))
      .first();
    const globalAgentType = (config?.value as 'cursor' | 'claude' | 'gemini') || 'cursor';
    const globalBillingMode = globalAgentType === 'cursor' ? 'tokens' : 'credits';

    const users = await ctx.db.query('users').collect();
    let fixedCount = 0;

    for (const user of users) {
      if (!user.agentType || !user.billingMode) {
        await ctx.db.patch(user._id, {
          agentType: user.agentType || globalAgentType,
          billingMode: user.billingMode || globalBillingMode,
        });
        fixedCount++;
      }
    }

    console.log(`✅ Fixed ${fixedCount} users missing agentType/billingMode`);

    return { fixedCount, totalUsers: users.length, globalAgentType, globalBillingMode };
  },
});

/**
 * Reset all user messages (monthly reset)
 */
export const resetAllUserMessages = mutation({
  args: {},
  handler: async (ctx) => {
    // Plan configurations (from lib/plans.ts)
    const planConfig: Record<string, number> = {
      free: 5,
      weekly_plus: 25,
      pro: 100,
      business: 300,
      enterprise: 1000,
    };

    const users = await ctx.db.query('users').collect();
    let resetCount = 0;

    for (const user of users) {
      const messagesForPlan = planConfig[user.subscriptionPlan || 'free'] || 5;
      await ctx.db.patch(user._id, {
        messagesRemaining: messagesForPlan,
        messagesUsed: 0,
        lastMessageReset: Date.now(),
      });
      resetCount++;
    }

    console.log(`✅ Reset messages for ${resetCount} users`);

    return { resetCount, totalUsers: users.length };
  },
});

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Update session fields (including githubPushStatus)
 */
export const updateSession = mutation({
  args: {
    sessionId: v.id('sessions'),
    updates: v.object({
      status: v.optional(
        v.union(
          v.literal('IN_PROGRESS'),
          v.literal('CLONING_REPO'),
          v.literal('INSTALLING_DEPENDENCIES'),
          v.literal('STARTING_DEV_SERVER'),
          v.literal('CREATING_TUNNEL'),
          v.literal('CUSTOM'),
          v.literal('RUNNING'),
          v.literal('CREATING_GITHUB_REPO'),
          v.literal('SETTING_UP_SANDBOX'),
          v.literal('INITIALIZING_GIT'),
          v.literal('ADDING_FILES'),
          v.literal('COMMITTING_CHANGES'),
          v.literal('PUSHING_TO_GITHUB'),
          v.literal('PUSH_COMPLETE'),
          v.literal('PUSH_FAILED')
        )
      ),
      githubPushStatus: v.optional(
        v.union(
          v.literal('pending'),
          v.literal('in_progress'),
          v.literal('completed'),
          v.literal('failed')
        )
      ),
      githubRepository: v.optional(v.string()),
      githubRepositoryUrl: v.optional(v.string()),
      name: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Filter out undefined values
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args.updates)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(args.sessionId, updates);

    console.log(`✅ Admin updated session ${args.sessionId}:`, updates);

    return { success: true, sessionId: args.sessionId, updates };
  },
});

// ============================================================================
// APP VERSION MANAGEMENT (Force Update)
// ============================================================================

/**
 * Get app version config (for force update check)
 * Returns minimum required version and App Store URL
 */
export const getAppVersionConfig = query({
  args: {},
  handler: async (ctx) => {
    const minVersionConfig = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'minAppVersion'))
      .first();

    const appStoreUrlConfig = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'appStoreUrl'))
      .first();

    return {
      minAppVersion: minVersionConfig?.value || '1.0.0', // Default to 1.0.0 (no force update)
      appStoreUrl:
        appStoreUrlConfig?.value ||
        'https://apps.apple.com/app/vibra-code-ai-app-builder/id6752743077',
      updatedAt: minVersionConfig?.updatedAt,
    };
  },
});

/**
 * Set minimum required app version (admin only)
 * Call this AFTER pushing a new version to App Store
 */
export const setMinAppVersion = mutation({
  args: {
    minAppVersion: v.string(), // e.g., "1.2.0"
    adminId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate version format (x.y.z)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(args.minAppVersion)) {
      throw new Error('Invalid version format. Use x.y.z (e.g., 1.2.0)');
    }

    const existing = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'minAppVersion'))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.minAppVersion,
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    } else {
      await ctx.db.insert('globalConfig', {
        key: 'minAppVersion',
        value: args.minAppVersion,
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    }

    console.log(`📱 Admin set minimum app version: ${args.minAppVersion}`);

    return { success: true, minAppVersion: args.minAppVersion };
  },
});

/**
 * Set App Store URL (admin only)
 */
export const setAppStoreUrl = mutation({
  args: {
    appStoreUrl: v.string(),
    adminId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('globalConfig')
      .withIndex('by_key', (q) => q.eq('key', 'appStoreUrl'))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.appStoreUrl,
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    } else {
      await ctx.db.insert('globalConfig', {
        key: 'appStoreUrl',
        value: args.appStoreUrl,
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    }

    console.log(`🔗 Admin set App Store URL: ${args.appStoreUrl}`);

    return { success: true, appStoreUrl: args.appStoreUrl };
  },
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT (Manual Fixes)
// ============================================================================

/**
 * Grant subscription tokens manually (for fixing sync issues)
 * This properly applies yearly multiplier and resets the transaction tracking
 */
export const grantSubscriptionTokens = mutation({
  args: {
    clerkId: v.string(),
    subscriptionPlan: v.string(),
    productId: v.optional(v.string()), // e.g., "yearly_pro" for 12x multiplier
    transactionId: v.optional(v.string()), // New transaction ID to set
    reason: v.optional(v.string()), // Audit reason
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      throw new Error(`User not found: ${args.clerkId}`);
    }

    // Plan configurations
    const planConfig: Record<string, { messages: number; credits: number }> = {
      free: { messages: 5, credits: 5 },
      weekly_plus: { messages: 25, credits: 16 },
      pro: { messages: 100, credits: 40 },
      business: { messages: 300, credits: 100 },
      enterprise: { messages: 1000, credits: 400 },
    };

    const config = planConfig[args.subscriptionPlan] || planConfig.free;

    // Apply yearly multiplier (12x for yearly products)
    const yearlyProducts = new Set(['yearly_pro', 'com.yourcompany.vibracode.yearly']); // Replace with your RevenueCat product ID
    const multiplier = args.productId && yearlyProducts.has(args.productId) ? 12 : 1;

    const messagesToGrant = config.messages * multiplier;
    const creditsToGrant = config.credits * multiplier;
    const newTransactionId = args.transactionId || `admin_grant_${Date.now()}`;

    const oldMessages = user.messagesRemaining || 0;
    const oldCredits = user.creditsUSD || 0;
    const oldPlan = user.subscriptionPlan || 'free';

    await ctx.db.patch(user._id, {
      subscriptionPlan: args.subscriptionPlan,
      subscriptionStatus: 'active',
      messagesRemaining: messagesToGrant,
      messagesUsed: 0,
      creditsUSD: creditsToGrant,
      creditsUsed: 0,
      lastMessageReset: Date.now(),
      lastGrantedTransactionId: newTransactionId,
      originalProductId: args.productId,
    });

    console.log(`✅ Admin granted subscription tokens for ${args.clerkId}:`, {
      plan: args.subscriptionPlan,
      productId: args.productId,
      multiplier,
      messagesToGrant,
      creditsToGrant,
      oldMessages,
      oldCredits,
      oldPlan,
      reason: args.reason,
    });

    return {
      success: true,
      clerkId: args.clerkId,
      plan: args.subscriptionPlan,
      productId: args.productId,
      multiplier,
      messagesToGrant,
      creditsToGrant,
      oldMessages,
      oldCredits,
      oldPlan,
      newTransactionId,
    };
  },
});

/**
 * Debug user subscription state (for troubleshooting sync issues)
 */
export const debugUserSubscription = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return { error: `User not found: ${args.clerkId}` };
    }

    // Get recent transactions for this user
    const transactions = await ctx.db
      .query('paymentTransactions')
      .withIndex('by_userId', (q) => q.eq('userId', args.clerkId))
      .collect();

    const recentTransactions = transactions
      .sort((a, b) => b.processedAt - a.processedAt)
      .slice(0, 5)
      .map((tx) => ({
        transactionId: tx.transactionId,
        type: tx.type,
        status: tx.status,
        amount: tx.amount,
        description: tx.description,
        subscriptionPlan: tx.subscriptionPlan,
        processedAt: new Date(tx.processedAt).toISOString(),
      }));

    return {
      user: {
        _id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionId: user.subscriptionId,
        subscriptionStatus: user.subscriptionStatus,
        messagesRemaining: user.messagesRemaining,
        messagesUsed: user.messagesUsed,
        creditsUSD: user.creditsUSD,
        creditsUsed: user.creditsUsed,
        lastGrantedTransactionId: user.lastGrantedTransactionId,
        originalProductId: user.originalProductId,
        accessExpiresAt: user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString() : null,
        isTrialPeriod: user.isTrialPeriod,
        willRenew: user.willRenew,
        lastMessageReset: user.lastMessageReset
          ? new Date(user.lastMessageReset).toISOString()
          : null,
        _creationTime: new Date(user._creationTime).toISOString(),
      },
      recentTransactions,
    };
  },
});
