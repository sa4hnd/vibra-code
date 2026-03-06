import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * Store or update GitHub credentials for a user
 */
export const upsert = mutation({
  args: {
    clerkId: v.string(),
    accessToken: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubCredentials')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        username: args.username,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('githubCredentials', {
      clerkId: args.clerkId,
      accessToken: args.accessToken,
      username: args.username,
      connectedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Get GitHub credentials for a user
 */
export const getByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('githubCredentials')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();
  },
});

/**
 * Delete GitHub credentials for a user (disconnect)
 */
export const remove = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubCredentials')
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
 * Check if user has GitHub connected
 */
export const isConnected = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const creds = await ctx.db
      .query('githubCredentials')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .first();
    return creds !== null;
  },
});
