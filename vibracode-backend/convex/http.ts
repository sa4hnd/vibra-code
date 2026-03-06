import { httpRouter } from 'convex/server';

import { api } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

// Secret key for admin access (set this in your Convex dashboard environment variables)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-secret-key-here';

// Middleware to check admin secret
function checkAdminAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === ADMIN_SECRET;
}

// ============================================================================
// ADMIN HTTP ENDPOINTS
// ============================================================================

// GET /admin/users - Get all users
http.route({
  path: '/admin/users',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const result = await ctx.runQuery(api.admin.getAllUsers, { limit, offset });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// GET /admin/stats - Get user statistics
http.route({
  path: '/admin/stats',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runQuery(api.admin.getUserStats, {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// GET /admin/config - Get global config
http.route({
  path: '/admin/config',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runQuery(api.admin.getGlobalConfig, {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// GET /admin/sessions - Get all sessions
http.route({
  path: '/admin/sessions',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const result = await ctx.runQuery(api.admin.getAllSessions, { limit, offset });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// GET /admin/messages - Get all messages
http.route({
  path: '/admin/messages',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const sessionId = url.searchParams.get('sessionId') || undefined;

    const result = await ctx.runQuery(api.admin.getAllMessages, {
      limit,
      offset,
      sessionId: sessionId as any,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// GET /admin/transactions - Get all transactions
http.route({
  path: '/admin/transactions',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const userId = url.searchParams.get('userId') || undefined;

    const result = await ctx.runQuery(api.admin.getAllTransactions, { limit, offset, userId });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/users/:userId - Update user
http.route({
  path: '/admin/user/update',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { userId, updates } = body;

    if (!userId || !updates) {
      return new Response(JSON.stringify({ error: 'Missing userId or updates' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runMutation(api.admin.updateUser, { userId, updates });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/user/credits - Set user credits
http.route({
  path: '/admin/user/credits',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { userId, creditsUSD } = body;

    if (!userId || creditsUSD === undefined) {
      return new Response(JSON.stringify({ error: 'Missing userId or creditsUSD' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runMutation(api.admin.setUserCredits, { userId, creditsUSD });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/user/messages - Set user messages
http.route({
  path: '/admin/user/messages',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { userId, messagesRemaining } = body;

    if (!userId || messagesRemaining === undefined) {
      return new Response(JSON.stringify({ error: 'Missing userId or messagesRemaining' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runMutation(api.admin.setUserMessages, { userId, messagesRemaining });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/config/agent-type - Set global agent type
http.route({
  path: '/admin/config/agent-type',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { agentType } = body;

    if (!agentType || !['cursor', 'claude', 'gemini'].includes(agentType)) {
      return new Response(JSON.stringify({ error: 'Invalid agentType' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runMutation(api.admin.setGlobalAgentType, { agentType });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/fix-users - Fix missing user fields
http.route({
  path: '/admin/fix-users',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runMutation(api.admin.fixMissingUserFields, {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// DELETE /admin/user - Delete user
http.route({
  path: '/admin/user/delete',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runMutation(api.admin.deleteUser, { userId });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// ============================================================================
// SESSION MANAGEMENT ENDPOINTS
// ============================================================================

// POST /admin/session/update - Update session fields (including githubPushStatus)
http.route({
  path: '/admin/session/update',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { sessionId, updates } = body;

    if (!sessionId || !updates) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or updates' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const result = await ctx.runMutation(api.admin.updateSession, {
        sessionId,
        updates,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }),
});

// ============================================================================
// USER PROFILE SYNC ENDPOINTS
// ============================================================================

// POST /admin/sync-profiles - Backfill user profiles from Clerk
http.route({
  path: '/admin/sync-profiles',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runAction(api.migrations.backfillUserProfiles, {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/sync-profile - Sync a single user's profile from Clerk
http.route({
  path: '/admin/sync-profile',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { clerkId } = body;

    if (!clerkId) {
      return new Response(JSON.stringify({ error: 'Missing clerkId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runAction(api.migrations.syncUserProfileFromClerk, {
      clerkId,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// ============================================================================
// SANDBOX MANAGEMENT ENDPOINTS
// ============================================================================

// POST /admin/sandbox/resume - Resume a sandbox
http.route({
  path: '/admin/sandbox/resume',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { sandboxIdOrUrl, timeoutMs } = body;

    if (!sandboxIdOrUrl) {
      return new Response(JSON.stringify({ error: 'Missing sandboxIdOrUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runAction(api.sandbox.resumeSandbox, {
      sandboxIdOrUrl,
      timeoutMs,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// GET /admin/sandbox/list - List all running sandboxes
http.route({
  path: '/admin/sandbox/list',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runAction(api.sandbox.listSandboxes, {});

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/sandbox/kill - Kill a sandbox
http.route({
  path: '/admin/sandbox/kill',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { sandboxIdOrUrl } = body;

    if (!sandboxIdOrUrl) {
      return new Response(JSON.stringify({ error: 'Missing sandboxIdOrUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runAction(api.sandbox.killSandbox, {
      sandboxIdOrUrl,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// CORS preflight handler
http.route({
  path: '/admin/users',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/session/update',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/stats',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/config',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/user/update',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/user/credits',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/user/messages',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/messages',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/config/agent-type',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/fix-users',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/user/delete',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/sessions',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/transactions',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

// Sandbox CORS preflight handlers
http.route({
  path: '/admin/sandbox/resume',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/sandbox/list',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/sandbox/kill',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

// Profile sync CORS preflight handlers
http.route({
  path: '/admin/sync-profiles',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/sync-profile',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

// ============================================================================
// PUSH NOTIFICATION ENDPOINTS
// ============================================================================

// POST /admin/push/send - Send push notification to users
http.route({
  path: '/admin/push/send',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { title, body: notifBody, data, targetClerkIds } = body;

    if (!title || !notifBody) {
      return new Response(JSON.stringify({ error: 'Missing title or body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runAction(api.pushNotifications.sendNotification, {
      title,
      body: notifBody,
      data,
      targetClerkIds,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/push/broadcast - Broadcast to all users
http.route({
  path: '/admin/push/broadcast',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { title, body: notifBody, data } = body;

    if (!title || !notifBody) {
      return new Response(JSON.stringify({ error: 'Missing title or body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // No targetClerkIds = broadcast to all
    const result = await ctx.runAction(api.pushNotifications.sendNotification, {
      title,
      body: notifBody,
      data,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// POST /admin/push/user - Send to a single user
http.route({
  path: '/admin/push/user',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { clerkId, title, body: notifBody, data } = body;

    if (!clerkId || !title || !notifBody) {
      return new Response(JSON.stringify({ error: 'Missing clerkId, title, or body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ctx.runAction(api.pushNotifications.sendNotificationToUser, {
      clerkId,
      title,
      body: notifBody,
      data,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// GET /admin/push/tokens - Get all users with push tokens
http.route({
  path: '/admin/push/tokens',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tokens = await ctx.runQuery(api.pushNotifications.getAllPushTokens, {});

    return new Response(JSON.stringify({ tokens, count: tokens.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// Push notification CORS preflight handlers
http.route({
  path: '/admin/push/send',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/push/broadcast',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/push/user',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/push/tokens',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

// ============================================================================
// SUBSCRIPTION/PLAN MANAGEMENT ENDPOINTS
// ============================================================================

// POST /admin/user/plan - Set user subscription plan
http.route({
  path: '/admin/user/plan',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { userId, clerkId, subscriptionPlan, resetMessages } = body;

    if (!subscriptionPlan) {
      return new Response(JSON.stringify({ error: 'Missing subscriptionPlan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate plan
    const validPlans = ['free', 'weekly_plus', 'pro', 'business', 'enterprise'];
    if (!validPlans.includes(subscriptionPlan)) {
      return new Response(
        JSON.stringify({
          error: `Invalid plan. Must be one of: ${validPlans.join(', ')}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      let targetUserId = userId;

      // If clerkId provided, look up the user ID
      if (!targetUserId && clerkId) {
        const user = await ctx.runQuery(api.users.getByClerkId, { clerkId });
        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        targetUserId = user._id;
      }

      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'Missing userId or clerkId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await ctx.runMutation(api.admin.setUserPlan, {
        userId: targetUserId,
        subscriptionPlan,
        resetMessages: resetMessages ?? true,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }),
});

// GET /admin/plans - Get available plans info
http.route({
  path: '/admin/plans',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const plans = [
      { id: 'free', name: 'Free', price: 0, messagesPerMonth: 5, creditsUSD: 5 },
      { id: 'weekly_plus', name: 'Weekly Plus', price: 7.99, messagesPerMonth: 25, creditsUSD: 16 },
      { id: 'pro', name: 'Pro', price: 19.99, messagesPerMonth: 100, creditsUSD: 40 },
      { id: 'business', name: 'Business', price: 49.99, messagesPerMonth: 300, creditsUSD: 100 },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 199.99,
        messagesPerMonth: 1000,
        creditsUSD: 400,
      },
    ];

    return new Response(JSON.stringify({ plans }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }),
});

// Plan CORS preflight handlers
http.route({
  path: '/admin/user/plan',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/plans',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

// ============================================================================
// CREDENTIALS MANAGEMENT ENDPOINTS
// ============================================================================

// GET /admin/convex-credentials - Get Convex deployment info
http.route({
  path: '/admin/convex-credentials',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return Convex deployment info (public info only, no secrets)
    const convexUrl = process.env.CONVEX_URL || '';

    return new Response(
      JSON.stringify({
        deploymentUrl: convexUrl,
        configured: true,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }),
});

// GET /admin/github-credentials - Get GitHub integration status
http.route({
  path: '/admin/github-credentials',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if GitHub token is configured (don't return the actual token)
    const hasGithubToken = !!process.env.GITHUB_TOKEN;

    return new Response(
      JSON.stringify({
        configured: hasGithubToken,
        message: hasGithubToken
          ? 'GitHub integration is configured'
          : 'GitHub token not configured',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }),
});

// Credentials CORS preflight handlers
http.route({
  path: '/admin/convex-credentials',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

http.route({
  path: '/admin/github-credentials',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }),
});

export default http;
