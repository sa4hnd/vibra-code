import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * Store or update RevenueCat OAuth credentials for a user
 */
export const upsert = mutation({
  args: {
    clerkId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('revenuecatCredentials')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('revenuecatCredentials', {
      clerkId: args.clerkId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope,
      connectedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Get RevenueCat credentials for a user
 */
export const getByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('revenuecatCredentials')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();
  },
});

/**
 * Delete RevenueCat credentials for a user (disconnect)
 */
export const remove = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('revenuecatCredentials')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});

/**
 * Check if user has RevenueCat connected
 */
export const isConnected = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const creds = await ctx.db
      .query('revenuecatCredentials')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();
    return creds !== null;
  },
});

/**
 * Update tokens after refresh (internal use)
 */
export const updateTokens = mutation({
  args: {
    clerkId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('revenuecatCredentials')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    if (!existing) {
      throw new Error('RevenueCat credentials not found');
    }

    await ctx.db.patch(existing._id, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});
