import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * Create a new stolen app record when user initiates app research
 */
export const create = mutation({
  args: {
    sessionId: v.id('sessions'),
    clerkId: v.string(),
    input: v.string(),
    inputType: v.union(
      v.literal('name'),
      v.literal('appstore'),
      v.literal('playstore'),
      v.literal('website')
    ),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('stolenApps', {
      sessionId: args.sessionId,
      clerkId: args.clerkId,
      input: args.input,
      inputType: args.inputType,
      status: 'researching',
      createdAt: Date.now(),
    });
    return id;
  },
});

/**
 * Update stolen app status (for failure handling)
 */
export const updateStatus = mutation({
  args: {
    sessionId: v.id('sessions'),
    status: v.union(v.literal('researching'), v.literal('completed'), v.literal('failed')),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find the record by sessionId
    const record = await ctx.db
      .query('stolenApps')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('desc')
      .first();

    if (!record) {
      // No record found, silently ignore
      return null;
    }

    await ctx.db.patch(record._id, {
      status: args.status,
      errorMessage: args.errorMessage,
    });

    return record._id;
  },
});

/**
 * Update stolen app with scraped data
 */
export const updateWithData = mutation({
  args: {
    sessionId: v.id('sessions'),
    appData: v.any(),
    status: v.union(v.literal('researching'), v.literal('completed'), v.literal('failed')),
  },
  handler: async (ctx, args) => {
    // Find the record by sessionId
    const record = await ctx.db
      .query('stolenApps')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('desc')
      .first();

    if (!record) {
      throw new Error('Stolen app record not found');
    }

    await ctx.db.patch(record._id, {
      appData: args.appData,
      status: args.status,
    });

    return record._id;
  },
});

/**
 * Get stolen app data by session ID
 */
export const getBySession = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query('stolenApps')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('desc')
      .first();

    return record;
  },
});

/**
 * Get all stolen apps for a user
 */
export const getByUser = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query('stolenApps')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .order('desc')
      .take(args.limit ?? 50);

    return records;
  },
});
