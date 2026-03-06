import { v } from 'convex/values';

import { api } from './_generated/api';
import { query, mutation, action } from './_generated/server';

/**
 * Push Notification Management
 * Handles Expo Push Token storage and retrieval for real push notifications
 */

// Register a user's Expo Push Token
export const registerPushToken = mutation({
  args: {
    clerkId: v.string(),
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by clerkId
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      console.error(`User with clerkId ${args.clerkId} not found`);
      return { success: false, error: 'User not found' };
    }

    // Update the user's push token
    await ctx.db.patch(user._id, {
      pushToken: args.pushToken,
      notificationsEnabled: true,
    });

    console.log(`📱 Push token registered for user ${args.clerkId}`);
    return { success: true };
  },
});

// Unregister a user's push token (clear it)
export const unregisterPushToken = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by clerkId
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Clear the push token
    await ctx.db.patch(user._id, {
      pushToken: undefined,
    });

    console.log(`📱 Push token cleared for user ${args.clerkId}`);
    return { success: true };
  },
});

// Alias for backward compatibility with existing API route
export const clearPushToken = unregisterPushToken;

// Get push token for a session's creator using Convex document ID
export const getPushTokenForSessionById = query({
  args: {
    sessionDocId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    // Get session directly by document ID
    const session = await ctx.db.get(args.sessionDocId);

    if (!session) {
      console.error(`Session ${args.sessionDocId} not found`);
      return null;
    }

    if (!session.createdBy) {
      console.error(`Session ${args.sessionDocId} has no creator`);
      return null;
    }

    // Find the user who created this session
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', session.createdBy))
      .first();

    if (!user) {
      console.error(`User ${session.createdBy} not found`);
      return null;
    }

    if (!user.pushToken) {
      console.log(`User ${session.createdBy} has no push token registered`);
      return null;
    }

    if (user.notificationsEnabled === false) {
      console.log(`User ${session.createdBy} has notifications disabled`);
      return null;
    }

    return {
      pushToken: user.pushToken,
      clerkId: user.clerkId,
      notificationsEnabled: user.notificationsEnabled,
    };
  },
});

// Get push token for a session's creator
export const getPushTokenForSession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the session by sessionId
    const session = await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .first();

    if (!session) {
      console.error(`Session ${args.sessionId} not found`);
      return null;
    }

    if (!session.createdBy) {
      console.error(`Session ${args.sessionId} has no creator`);
      return null;
    }

    // Find the user who created this session
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', session.createdBy))
      .first();

    if (!user) {
      console.error(`User ${session.createdBy} not found`);
      return null;
    }

    if (!user.pushToken) {
      console.log(`User ${session.createdBy} has no push token registered`);
      return null;
    }

    if (user.notificationsEnabled === false) {
      console.log(`User ${session.createdBy} has notifications disabled`);
      return null;
    }

    return {
      pushToken: user.pushToken,
      clerkId: user.clerkId,
      notificationsEnabled: user.notificationsEnabled,
    };
  },
});

// Get push token for a specific user
export const getPushTokenForUser = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return null;
    }

    return {
      pushToken: user.pushToken || null,
      notificationsEnabled: user.notificationsEnabled ?? true,
    };
  },
});

// Get all users with push tokens (for admin broadcasts)
export const getAllPushTokens = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();

    // Filter to users with push tokens and notifications enabled
    const usersWithTokens = users.filter(
      (user) => user.pushToken && user.notificationsEnabled !== false
    );

    return usersWithTokens.map((user) => ({
      clerkId: user.clerkId,
      pushToken: user.pushToken!,
    }));
  },
});

// Update notification preferences
export const updateNotificationPreferences = mutation({
  args: {
    clerkId: v.string(),
    notificationsEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    await ctx.db.patch(user._id, {
      notificationsEnabled: args.notificationsEnabled,
    });

    return { success: true };
  },
});

// ============================================================================
// PUSH NOTIFICATION ACTIONS (for HTTP endpoints)
// ============================================================================

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Send push notification to specific users
export const sendNotification = action({
  args: {
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    targetClerkIds: v.optional(v.array(v.string())), // If empty/undefined, sends to all
  },
  handler: async (ctx, args) => {
    let tokens: { clerkId: string; pushToken: string }[] = [];

    if (args.targetClerkIds && args.targetClerkIds.length > 0) {
      // Get tokens for specific users
      for (const clerkId of args.targetClerkIds) {
        const tokenInfo = await ctx.runQuery(api.pushNotifications.getPushTokenForUser, {
          clerkId,
        });
        if (tokenInfo?.pushToken && tokenInfo.notificationsEnabled) {
          tokens.push({ clerkId, pushToken: tokenInfo.pushToken });
        }
      }
    } else {
      // Broadcast to all users with push tokens
      tokens = await ctx.runQuery(api.pushNotifications.getAllPushTokens, {});
    }

    if (tokens.length === 0) {
      return {
        success: true,
        sent: 0,
        message: 'No users with push tokens found',
      };
    }

    // Send notifications
    const results = [];
    for (const token of tokens) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: token.pushToken,
            title: args.title,
            body: args.body,
            sound: 'default',
            priority: 'high',
            data: args.data || {},
          }),
        });

        const result = await response.json();
        // Expo Push API returns data as an array
        const ticket = result.data?.[0];
        results.push({
          clerkId: token.clerkId,
          success: ticket?.status === 'ok',
          error: ticket?.status === 'error' ? ticket?.message : undefined,
        });
      } catch (error: any) {
        results.push({
          clerkId: token.clerkId,
          success: false,
          error: error.message,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    console.log(`📱 Sent ${successful}/${results.length} push notifications`);

    return {
      success: true,
      sent: successful,
      failed: failed.length,
      total: results.length,
      errors: failed.length > 0 ? failed : undefined,
    };
  },
});

// Send notification to a single user by clerkId
export const sendNotificationToUser = action({
  args: {
    clerkId: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const tokenInfo = await ctx.runQuery(api.pushNotifications.getPushTokenForUser, {
      clerkId: args.clerkId,
    });

    if (!tokenInfo?.pushToken) {
      return { success: false, error: 'User has no push token registered' };
    }

    if (!tokenInfo.notificationsEnabled) {
      return { success: false, error: 'User has notifications disabled' };
    }

    try {
      const pushToken = tokenInfo.pushToken;
      console.log(`📱 Sending push to ${args.clerkId}`);
      console.log(`📱 Full push token: "${pushToken}"`);
      console.log(`📱 Token length: ${pushToken?.length}`);
      console.log(
        `📱 Token starts with ExponentPushToken: ${pushToken?.startsWith('ExponentPushToken[')}`
      );

      const requestBody = {
        to: pushToken,
        title: args.title,
        body: args.body,
        sound: 'default',
        priority: 'high',
        data: args.data || {},
      };
      console.log(`📱 Request body:`, JSON.stringify(requestBody));

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      // Log full Expo response for debugging
      console.log(`📱 Expo Push API response (status ${response.status}):`, JSON.stringify(result));

      // Check for top-level errors first (e.g., invalid request)
      if (result.errors && result.errors.length > 0) {
        console.error(`📱 Expo API returned errors:`, JSON.stringify(result.errors));
        return {
          success: false,
          error: result.errors[0]?.message || 'Expo API error',
          details: result.errors,
        };
      }

      // Expo Push API returns data as object for single notification, array for batch
      const ticket = Array.isArray(result.data) ? result.data[0] : result.data;

      if (!ticket) {
        console.error(`📱 No ticket in Expo response`);
        return {
          success: false,
          error: 'No ticket returned from Expo',
          rawResponse: result,
        };
      }

      if (ticket.status === 'ok') {
        console.log(
          `📱 Push notification sent successfully to ${args.clerkId}, ticket: ${ticket.id}`
        );
        return { success: true, ticketId: ticket.id };
      } else {
        console.error(`📱 Push notification failed for ${args.clerkId}:`, JSON.stringify(ticket));
        return {
          success: false,
          error: ticket.message || ticket.details?.error || 'Unknown error',
          details: ticket.details,
        };
      }
    } catch (error: any) {
      console.error(`📱 Failed to send notification to ${args.clerkId}:`, error);
      return { success: false, error: error.message };
    }
  },
});
