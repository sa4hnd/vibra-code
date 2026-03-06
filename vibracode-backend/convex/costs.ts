import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { query, mutation } from './_generated/server';

// Cost data structure from Claude Code output
interface CostData {
  totalCostUSD: number;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  durationMs: number;
}

/**
 * Extract cost data from Claude Code stdout result
 */
function extractCostData(stdout: string): CostData | null {
  try {
    // Parse the stdout to find the result object with cost information
    const lines = stdout.split('\n');

    for (const line of lines) {
      if (line.includes('"type":"result"') && line.includes('"total_cost_usd"')) {
        const result = JSON.parse(line);

        if (result.type === 'result' && result.total_cost_usd !== undefined) {
          const usage = result.usage || {};
          const modelUsage = result.modelUsage || {};

          // Get the first model's usage data
          const firstModel = Object.keys(modelUsage)[0];
          const modelData = modelUsage[firstModel] || {};

          const costData = {
            totalCostUSD: result.total_cost_usd,
            modelUsed: firstModel || 'unknown',
            inputTokens: modelData.inputTokens || usage.input_tokens || 0,
            outputTokens: modelData.outputTokens || usage.output_tokens || 0,
            cacheReadTokens: modelData.cacheReadInputTokens || usage.cache_read_input_tokens || 0,
            cacheCreationTokens:
              modelData.cacheCreationInputTokens || usage.cache_creation_input_tokens || 0,
            durationMs: result.duration_ms || 0,
          };

          console.log('💰 Extracted cost:', costData.totalCostUSD);
          return costData;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('💥 Error extracting cost data:', error);
    return null;
  }
}

/**
 * Update message with cost data
 */
export const updateMessageCost = mutation({
  args: {
    messageId: v.id('messages'),
    stdout: v.string(),
  },
  handler: async (ctx, args) => {
    const costData = extractCostData(args.stdout);

    if (!costData) {
      return null;
    }

    // Update the message with cost data
    await ctx.db.patch(args.messageId, {
      costUSD: costData.totalCostUSD,
      modelUsed: costData.modelUsed,
      inputTokens: costData.inputTokens,
      outputTokens: costData.outputTokens,
      cacheReadTokens: costData.cacheReadTokens,
      cacheCreationTokens: costData.cacheCreationTokens,
      durationMs: costData.durationMs,
      createdAt: Date.now(),
    });

    // Get the message to find its session
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;

    // Update session cost totals
    await updateSessionCost(ctx, message.sessionId, costData.totalCostUSD);

    return costData;
  },
});

/**
 * Update session cost totals
 * NOTE: This only updates session-level costs for analytics.
 * User-level realCostUSD is updated by credits.deductCreditsForMessage to avoid double-counting.
 */
async function updateSessionCost(ctx: any, sessionId: Id<'sessions'>, messageCost: number) {
  const session = await ctx.db.get(sessionId);
  if (!session) return;

  const newTotalCost = (session.totalCostUSD || 0) + messageCost;
  const newMessageCount = (session.messageCount || 0) + 1;

  await ctx.db.patch(sessionId, {
    totalCostUSD: newTotalCost,
    messageCount: newMessageCount,
    lastCostUpdate: Date.now(),
  });

  // NOTE: Removed call to updateUserCost to prevent double-counting of realCostUSD
  // The credits.deductCreditsForMessage mutation now handles user-level cost tracking
}

// NOTE: updateUserCost function REMOVED to prevent double-counting
// User-level realCostUSD is now ONLY updated by credits.deductCreditsForMessage

/**
 * Get cost summary for a user
 */
export const getUserCostSummary = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return {
        totalCostUSD: 0,
        sessionCount: 0,
        messageCount: 0,
        lastCostUpdate: null,
      };
    }

    // Get user's sessions
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_createdBy', (q) => q.eq('createdBy', args.clerkId))
      .collect();

    const totalSessionCost = sessions.reduce(
      (sum, session) => sum + (session.totalCostUSD || 0),
      0
    );
    const totalMessages = sessions.reduce((sum, session) => sum + (session.messageCount || 0), 0);

    return {
      totalCostUSD: user.realCostUSD || 0, // Fixed: was incorrectly using user.totalCostUSD which doesn't exist
      sessionCount: sessions.length,
      messageCount: totalMessages,
      lastCostUpdate: user.lastCostUpdate,
      sessions: sessions.map((session) => ({
        id: session._id,
        name: session.name,
        totalCostUSD: session.totalCostUSD || 0,
        messageCount: session.messageCount || 0,
        lastCostUpdate: session.lastCostUpdate,
      })),
    };
  },
});

/**
 * Get cost summary for a session
 */
export const getSessionCostSummary = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return {
        totalCostUSD: 0,
        messageCount: 0,
        lastCostUpdate: null,
        messages: [],
      };
    }

    // Get all messages for this session with cost data
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .order('asc')
      .collect();

    const messagesWithCost = messages.filter((msg) => msg.costUSD !== undefined);

    return {
      totalCostUSD: session.totalCostUSD || 0,
      messageCount: session.messageCount || 0,
      lastCostUpdate: session.lastCostUpdate,
      messages: messagesWithCost.map((msg) => ({
        id: msg._id,
        role: msg.role,
        costUSD: msg.costUSD,
        modelUsed: msg.modelUsed,
        inputTokens: msg.inputTokens,
        outputTokens: msg.outputTokens,
        durationMs: msg.durationMs,
        createdAt: msg.createdAt,
      })),
    };
  },
});

/**
 * Get cost summary for a specific message
 */
export const getMessageCostSummary = query({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.costUSD === undefined) {
      return null;
    }

    return {
      id: message._id,
      role: message.role,
      costUSD: message.costUSD,
      modelUsed: message.modelUsed,
      inputTokens: message.inputTokens,
      outputTokens: message.outputTokens,
      cacheReadTokens: message.cacheReadTokens,
      cacheCreationTokens: message.cacheCreationTokens,
      durationMs: message.durationMs,
      createdAt: message.createdAt,
    };
  },
});

/**
 * Get global cost statistics (admin only)
 */
export const getGlobalCostStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    const sessions = await ctx.db.query('sessions').collect();
    const messages = await ctx.db.query('messages').collect();

    // Fixed: was using user.totalCostUSD which doesn't exist, now using realCostUSD
    const totalUserCost = users.reduce((sum, user) => sum + (user.realCostUSD || 0), 0);
    const totalSessionCost = sessions.reduce(
      (sum, session) => sum + (session.totalCostUSD || 0),
      0
    );
    const totalMessageCost = messages.reduce((sum, message) => sum + (message.costUSD || 0), 0);

    return {
      totalUsers: users.length,
      totalSessions: sessions.length,
      totalMessages: messages.length,
      totalUserCostUSD: totalUserCost,
      totalSessionCostUSD: totalSessionCost,
      totalMessageCostUSD: totalMessageCost,
      averageCostPerUser: users.length > 0 ? totalUserCost / users.length : 0,
      averageCostPerSession: sessions.length > 0 ? totalSessionCost / sessions.length : 0,
      averageCostPerMessage: messages.length > 0 ? totalMessageCost / messages.length : 0,
    };
  },
});

/**
 * @deprecated DO NOT USE - This function is legacy and creates broken user records
 * Use usage.createUser or the standardized createUserWithDefaults helper instead.
 *
 * This function is kept ONLY for backwards compatibility with existing API calls.
 * It now just returns the existing user or throws an error if user doesn't exist.
 */
export const initializeUserCost = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    console.warn(
      `⚠️ DEPRECATED: initializeUserCost called for ${args.clerkId}. Use usage.createUser instead.`
    );

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (existingUser) {
      // Just return existing user - don't create broken records
      return existingUser._id;
    }

    // Instead of creating a broken user, throw an error
    throw new Error(
      `User ${args.clerkId} not found. Use usage.createUser to create new users with proper defaults.`
    );
  },
});

/**
 * Initialize cost tracking for new sessions
 */
export const initializeSessionCost = mutation({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    await ctx.db.patch(args.sessionId, {
      totalCostUSD: session.totalCostUSD || 0,
      messageCount: session.messageCount || 0,
      lastCostUpdate: session.lastCostUpdate || Date.now(),
    });

    return args.sessionId;
  },
});
