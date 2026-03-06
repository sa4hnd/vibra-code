import { v } from 'convex/values';

import { query, mutation } from './_generated/server';

export const getBySession = query({
  args: {
    sessionId: v.id('sessions'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 1000; // Default to 1000 messages

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .order('asc')
      .take(limit);

    return messages.map((msg) => ({
      ...msg,
      id: msg._id,
    }));
  },
});

export const getById = query({
  args: { id: v.id('messages') },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    if (!message) return null;

    return {
      ...message,
      id: message._id,
    };
  },
});

export const add = mutation({
  args: {
    sessionId: v.id('sessions'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    createdAt: v.optional(v.number()), // Allow client to pass timestamp for ordering
    edits: v.optional(
      v.object({
        filePath: v.string(),
        oldString: v.string(),
        newString: v.string(),
      })
    ),
    read: v.optional(
      v.object({
        filePath: v.string(),
      })
    ),
    bash: v.optional(
      v.object({
        command: v.string(),
        output: v.optional(v.string()),
        exitCode: v.optional(v.number()),
      })
    ),
    webSearch: v.optional(
      v.object({
        query: v.string(),
        results: v.optional(v.string()),
      })
    ),
    mcpTool: v.optional(
      v.object({
        toolName: v.string(),
        input: v.optional(v.any()),
        output: v.optional(v.any()),
        status: v.optional(v.string()),
      })
    ),
    image: v.optional(
      v.object({
        fileName: v.string(),
        path: v.string(),
        storageId: v.optional(v.id('_storage')),
      })
    ),
    images: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    audios: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    videos: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    todos: v.optional(
      v.array(
        v.object({
          id: v.string(),
          content: v.string(),
          status: v.string(),
          priority: v.string(),
        })
      )
    ),
    checkpoint: v.optional(
      v.object({
        branch: v.string(),
        patch: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { createdAt, ...rest } = args;
    const messageId = await ctx.db.insert('messages', {
      ...rest,
      // Use client timestamp if provided, otherwise use server time
      createdAt: createdAt ?? Date.now(),
    });

    return messageId;
  },
});

export const update = mutation({
  args: {
    id: v.id('messages'),
    role: v.optional(v.union(v.literal('user'), v.literal('assistant'))),
    content: v.optional(v.string()),
    edits: v.optional(
      v.object({
        filePath: v.string(),
        oldString: v.string(),
        newString: v.string(),
      })
    ),
    read: v.optional(
      v.object({
        filePath: v.string(),
      })
    ),
    bash: v.optional(
      v.object({
        command: v.string(),
        output: v.optional(v.string()),
        exitCode: v.optional(v.number()),
      })
    ),
    webSearch: v.optional(
      v.object({
        query: v.string(),
        results: v.optional(v.string()),
      })
    ),
    mcpTool: v.optional(
      v.object({
        toolName: v.string(),
        input: v.optional(v.any()),
        output: v.optional(v.any()),
        status: v.optional(v.string()),
      })
    ),
    image: v.optional(
      v.object({
        fileName: v.string(),
        path: v.string(),
        storageId: v.optional(v.id('_storage')),
      })
    ),
    images: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    audios: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    videos: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          path: v.string(),
          storageId: v.optional(v.id('_storage')),
        })
      )
    ),
    todos: v.optional(
      v.array(
        v.object({
          id: v.string(),
          content: v.string(),
          status: v.string(),
          priority: v.string(),
        })
      )
    ),
    checkpoint: v.optional(
      v.object({
        branch: v.string(),
        patch: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Remove undefined values to avoid overwriting with undefined
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(id, cleanUpdates);
  },
});

export const remove = mutation({
  args: {
    id: v.id('messages'),
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const clearBySession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getStorageUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
