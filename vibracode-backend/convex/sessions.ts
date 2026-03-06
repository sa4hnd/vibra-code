import { v } from 'convex/values';

import { query, mutation } from './_generated/server';

// Queries
export const list = query({
  args: {
    createdBy: v.optional(v.string()),
    limit: v.optional(v.number()), // Optional limit (default 100)
  },
  handler: async (ctx, args) => {
    // SECURITY: Only return sessions for a specific user
    // If no createdBy is provided, return empty array (don't return all sessions!)
    if (!args.createdBy) {
      console.warn('sessions.list called without createdBy - returning empty array for security');
      return [];
    }

    // Default limit of 100, max 500 to prevent expensive queries
    const limit = Math.min(args.limit || 100, 500);

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_createdBy', (q) => q.eq('createdBy', args.createdBy))
      .order('desc')
      .take(limit);

    // Return only essential fields for the list view (much faster & cheaper)
    // Full session data loaded via getById when viewing a specific session
    return sessions.map((session) => ({
      id: session._id,
      _id: session._id,
      _creationTime: session._creationTime,
      name: session.name,
      status: session.status,
      statusMessage: session.statusMessage,
      tunnelUrl: session.tunnelUrl,
      templateId: session.templateId,
      createdBy: session.createdBy,
      sessionId: session.sessionId,
      // GitHub info for display
      githubRepository: session.githubRepository,
      githubRepositoryUrl: session.githubRepositoryUrl,
      githubPushStatus: session.githubPushStatus,
      // Don't include: envs, convexProject, messages (loaded separately)
      messages: [], // Empty array - messages loaded via getById when needed
    }));
  },
});

export const getById = query({
  args: {
    id: v.id('sessions'),
    createdBy: v.string(), // SECURITY: REQUIRED - clerkId for ownership verification
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    // SECURITY: ALWAYS verify ownership - no exceptions
    // This prevents users from viewing other users' sessions
    if (session.createdBy !== args.createdBy) {
      console.warn(
        `SECURITY: BLOCKED - User ${args.createdBy} attempted to access session ${args.id} owned by ${session.createdBy}`
      );
      return null; // Return null instead of the session - access denied
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.id))
      .order('asc')
      .collect();

    return {
      ...session,
      id: session._id,
      messages: messages.map((msg) => ({
        ...msg,
        id: msg._id,
      })),
    };
  },
});

// INTERNAL: Backend-only query for trusted server-to-server calls (Inngest, push notifications, etc.)
// WARNING: This bypasses ownership verification - ONLY use from trusted backend code!
// Do NOT expose this to client-facing APIs
export const getByIdInternal = query({
  args: {
    id: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.id))
      .order('asc')
      .collect();

    return {
      ...session,
      id: session._id,
      messages: messages.map((msg) => ({
        ...msg,
        id: msg._id,
      })),
    };
  },
});

export const getBySessionId = query({
  args: {
    sessionId: v.string(),
    createdBy: v.string(), // SECURITY: REQUIRED - clerkId for ownership verification
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .first();

    if (!session) return null;

    // SECURITY: ALWAYS verify ownership - no exceptions
    // This prevents users from viewing other users' sessions
    if (session.createdBy !== args.createdBy) {
      console.warn(
        `SECURITY: BLOCKED - User ${args.createdBy} attempted to access session ${args.sessionId} owned by ${session.createdBy}`
      );
      return null; // Return null instead of the session - access denied
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', session._id))
      .order('asc')
      .collect();

    return {
      ...session,
      id: session._id,
      messages: messages.map((msg) => ({
        ...msg,
        id: msg._id,
      })),
    };
  },
});

// INTERNAL: Backend-only query for trusted server-to-server calls (stop-agent API, etc.)
// WARNING: This bypasses ownership verification - ONLY use from trusted backend code!
// Do NOT expose this to client-facing APIs
export const getBySessionIdInternal = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .first();

    if (!session) return null;

    return {
      ...session,
      id: session._id,
    };
  },
});

// Mutations
export const create = mutation({
  args: {
    sessionId: v.optional(v.string()),
    branch: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    repository: v.optional(v.string()),
    pullRequest: v.optional(v.any()),
    name: v.string(),
    tunnelUrl: v.optional(v.string()),
    templateId: v.string(),
    status: v.union(
      v.literal('IN_PROGRESS'),
      v.literal('CLONING_REPO'),
      v.literal('INSTALLING_DEPENDENCIES'),
      v.literal('STARTING_DEV_SERVER'),
      v.literal('CREATING_TUNNEL'),
      v.literal('CUSTOM'),
      v.literal('RUNNING')
    ),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('sessions', {
      ...args,
      // Initialize cost tracking
      totalCostUSD: 0,
      messageCount: 0,
      lastCostUpdate: Date.now(),
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id('sessions'),
    sessionId: v.optional(v.string()),
    name: v.optional(v.string()),
    tunnelUrl: v.optional(v.string()),
    repository: v.optional(v.string()),
    pullRequest: v.optional(v.any()),
    templateId: v.optional(v.string()),
    branch: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal('IN_PROGRESS'),
        v.literal('CLONING_REPO'),
        v.literal('INSTALLING_DEPENDENCIES'),
        v.literal('STARTING_DEV_SERVER'),
        v.literal('CREATING_TUNNEL'),
        v.literal('CUSTOM'),
        v.literal('RUNNING'),
        v.literal('CREATING_GITHUB_REPO'),
        v.literal('SETTING_UP_SANDBOX'),
        v.literal('INITIALIZING_GIT'),
        v.literal('ADDING_FILES'),
        v.literal('COMMITTING_CHANGES'),
        v.literal('PUSHING_TO_GITHUB'),
        v.literal('PUSH_COMPLETE'),
        v.literal('PUSH_FAILED'),
        v.literal('AUTO_PUSHING'),
        v.literal('USING_EXISTING_REPO')
      )
    ),
    statusMessage: v.optional(v.string()),
    agentStopped: v.optional(v.boolean()),
    // GitHub repository information
    githubRepository: v.optional(v.string()),
    githubRepositoryUrl: v.optional(v.string()),
    githubPushStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('failed')
      )
    ),
    githubPushDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Check if session exists before updating
    const session = await ctx.db.get(id);
    if (!session) {
      console.warn(`Session ${id} not found, skipping update`);
      return;
    }

    await ctx.db.patch(id, {
      ...updates,
    });
  },
});

export const updateEnvs = mutation({
  args: {
    sessionId: v.string(),
    envs: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    // Find session by sessionId string
    const session = await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Session with ID ${args.sessionId} not found`);
    }

    // Update the session with environment variables
    await ctx.db.patch(session._id, {
      envs: args.envs,
    });

    return { success: true };
  },
});

export const addEnv = mutation({
  args: {
    sessionId: v.string(),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    // Find session by sessionId string
    const session = await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Session with ID ${args.sessionId} not found`);
    }

    // Get existing envs or create new object
    const existingEnvs = session.envs || {};

    // Add new environment variable
    const updatedEnvs = {
      ...existingEnvs,
      [args.key]: args.value,
    };

    // Update the session
    await ctx.db.patch(session._id, {
      envs: updatedEnvs,
    });

    return { success: true };
  },
});

export const removeEnv = mutation({
  args: {
    sessionId: v.string(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    // Find session by sessionId string
    const session = await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Session with ID ${args.sessionId} not found`);
    }

    // Get existing envs
    const existingEnvs = session.envs || {};

    // Remove the environment variable
    const { [args.key]: removed, ...updatedEnvs } = existingEnvs;

    // Update the session
    await ctx.db.patch(session._id, {
      envs: updatedEnvs,
    });

    return { success: true };
  },
});

export const updateConvexProject = mutation({
  args: {
    sessionId: v.string(),
    convexProject: v.object({
      deploymentName: v.string(),
      deploymentUrl: v.string(),
      adminKey: v.string(),
      projectSlug: v.optional(v.string()),
      teamSlug: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Find session by sessionId string
    const session = await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Session with ID ${args.sessionId} not found`);
    }

    // Update the session with Convex project information
    await ctx.db.patch(session._id, {
      convexProject: args.convexProject,
    });

    return { success: true };
  },
});

export const storeConvexCredentials = mutation({
  args: {
    userId: v.string(),
    projectSlug: v.string(),
    teamSlug: v.string(),
    projectDeployKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if credentials already exist for this user
    const existing = await ctx.db
      .query('convexProjectCredentials')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    if (existing) {
      // Update existing credentials
      await ctx.db.patch(existing._id, {
        projectSlug: args.projectSlug,
        teamSlug: args.teamSlug,
        projectDeployKey: args.projectDeployKey,
      });
    } else {
      // Create new credentials
      await ctx.db.insert('convexProjectCredentials', {
        userId: args.userId,
        projectSlug: args.projectSlug,
        teamSlug: args.teamSlug,
        projectDeployKey: args.projectDeployKey,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const getConvexCredentials = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const credentials = await ctx.db
      .query('convexProjectCredentials')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    return credentials;
  },
});

export const remove = mutation({
  args: { id: v.id('sessions') },
  handler: async (ctx, args) => {
    // Delete all messages for this session first
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_session', (q) => q.eq('sessionId', args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const updateName = mutation({
  args: {
    id: v.id('sessions'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new Error('Session not found');
    }

    await ctx.db.patch(args.id, {
      name: args.name,
    });

    return { success: true };
  },
});
