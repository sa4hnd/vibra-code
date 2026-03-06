import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

// Get all images for a user
export const getByUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query('generatedImages')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .order('desc')
      .collect();

    return images;
  },
});

// Get a single image by ID
export const getById = query({
  args: { id: v.id('generatedImages') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new image record (before generation starts)
export const create = mutation({
  args: {
    clerkId: v.string(),
    sessionId: v.optional(v.id('sessions')),
    name: v.string(),
    prompt: v.optional(v.string()),
    storageId: v.id('_storage'),
    url: v.string(),
    isUploaded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const imageId = await ctx.db.insert('generatedImages', {
      clerkId: args.clerkId,
      sessionId: args.sessionId,
      name: args.name,
      prompt: args.prompt,
      storageId: args.storageId,
      url: args.url,
      isUploaded: args.isUploaded,
      status: 'completed',
      createdAt: Date.now(),
    });

    return imageId;
  },
});

// Update image status
export const updateStatus = mutation({
  args: {
    id: v.id('generatedImages'),
    status: v.union(v.literal('generating'), v.literal('completed'), v.literal('error')),
    url: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    revisedPrompt: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Delete an image
export const deleteImage = mutation({
  args: { id: v.id('generatedImages') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Start a background generation
export const startGeneration = mutation({
  args: {
    clerkId: v.string(),
    sessionId: v.optional(v.id('sessions')),
    name: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    // Create placeholder with generating status
    const imageId = await ctx.db.insert('generatedImages', {
      clerkId: args.clerkId,
      sessionId: args.sessionId,
      name: args.name,
      prompt: args.prompt,
      status: 'generating',
      createdAt: Date.now(),
    });

    return imageId;
  },
});

// Update image after generation completes
export const updateAfterGeneration = mutation({
  args: {
    id: v.id('generatedImages'),
    storageId: v.optional(v.id('_storage')),
    url: v.optional(v.string()),
    revisedPrompt: v.optional(v.string()),
    status: v.union(v.literal('completed'), v.literal('error')),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if record still exists (might have been deleted while generating)
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      console.log(`Image record ${args.id} no longer exists, skipping update`);
      return;
    }

    await ctx.db.patch(args.id, {
      storageId: args.storageId,
      url: args.url,
      revisedPrompt: args.revisedPrompt,
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});
