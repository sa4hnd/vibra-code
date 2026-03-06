import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

// Get all audios for a user
export const getByUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const audios = await ctx.db
      .query('generatedAudios')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .order('desc')
      .collect();

    return audios;
  },
});

// Create a new audio
export const create = mutation({
  args: {
    clerkId: v.string(),
    sessionId: v.optional(v.id('sessions')),
    name: v.string(),
    text: v.optional(v.string()),
    storageId: v.id('_storage'),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const audioId = await ctx.db.insert('generatedAudios', {
      clerkId: args.clerkId,
      sessionId: args.sessionId,
      name: args.name,
      text: args.text,
      storageId: args.storageId,
      url: args.url,
      status: 'completed',
      createdAt: Date.now(),
    });

    return audioId;
  },
});

// Delete an audio
export const deleteAudio = mutation({
  args: { id: v.id('generatedAudios') },
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.id);

    if (!audio) {
      throw new Error('Audio not found');
    }

    // Delete the audio from storage
    if (audio.storageId) {
      await ctx.storage.delete(audio.storageId);
    }

    // Delete the audio record
    await ctx.db.delete(args.id);

    return { success: true };
  },
});
