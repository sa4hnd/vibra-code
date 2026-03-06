import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * Generate an upload URL for file storage
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get download URL for a stored file
 */
export const getDownloadUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Delete a file from storage
 */
export const deleteFile = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});
