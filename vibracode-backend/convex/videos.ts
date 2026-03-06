import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

// Get all videos for a user
export const getByUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const videos = await ctx.db
      .query('generatedVideos')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .order('desc')
      .collect();

    return videos;
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
    const videoId = await ctx.db.insert('generatedVideos', {
      clerkId: args.clerkId,
      sessionId: args.sessionId,
      name: args.name,
      prompt: args.prompt,
      status: 'generating',
      createdAt: Date.now(),
    });

    return videoId;
  },
});

// Update video after generation completes
export const updateAfterGeneration = mutation({
  args: {
    id: v.id('generatedVideos'),
    storageId: v.optional(v.id('_storage')),
    url: v.optional(v.string()),
    status: v.union(v.literal('completed'), v.literal('error')),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      storageId: args.storageId,
      url: args.url,
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

// Create a new video
export const create = mutation({
  args: {
    clerkId: v.string(),
    sessionId: v.optional(v.id('sessions')),
    name: v.string(),
    prompt: v.optional(v.string()),
    storageId: v.id('_storage'),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const videoId = await ctx.db.insert('generatedVideos', {
      clerkId: args.clerkId,
      sessionId: args.sessionId,
      name: args.name,
      prompt: args.prompt,
      storageId: args.storageId,
      url: args.url,
      status: 'completed',
      createdAt: Date.now(),
    });

    return videoId;
  },
});

// Delete a video
export const deleteVideo = mutation({
  args: { id: v.id('generatedVideos') },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.id);

    if (!video) {
      throw new Error('Video not found');
    }

    // Delete the video from storage
    if (video.storageId) {
      await ctx.storage.delete(video.storageId);
    }

    // Delete the video record
    await ctx.db.delete(args.id);

    return { success: true };
  },
});
