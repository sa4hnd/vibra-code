'use node';

import { Sandbox } from '@e2b/code-interpreter';
import { v } from 'convex/values';

import { action } from './_generated/server';

const E2B_API_KEY = process.env.E2B_API_KEY || '';

function extractSandboxId(input: string): string {
  // If it's a URL like https://3000-iwbczkwgkhkflzmkikoze.e2b.app
  const urlMatch = input.match(/(\d+)-([a-z0-9]+)\.e2b\.app/);
  if (urlMatch) {
    return urlMatch[2];
  }
  // If it's just the sandbox ID
  return input.trim();
}

/**
 * Resume an E2B sandbox by ID or URL
 * Extends the sandbox timeout and returns the app URL
 */
export const resumeSandbox = action({
  args: {
    sandboxIdOrUrl: v.string(),
    timeoutMs: v.optional(v.number()), // Default: 15 minutes
  },
  handler: async (ctx, args) => {
    const sandboxId = extractSandboxId(args.sandboxIdOrUrl);
    const timeoutMs = args.timeoutMs || 900000; // 15 minutes default

    console.log(`🔄 Resuming sandbox: ${sandboxId}`);

    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: E2B_API_KEY,
      });

      // Set the timeout after connecting
      await sandbox.setTimeout(timeoutMs);

      console.log(`✅ Sandbox resumed: ${sandbox.sandboxId}`);

      const host = sandbox.getHost(3000);
      const appUrl = `https://${host}`;

      console.log(`🌐 App URL: ${appUrl}`);

      return {
        success: true,
        sandboxId: sandbox.sandboxId,
        appUrl,
        timeoutMs,
      };
    } catch (error: any) {
      console.error(`❌ Error resuming sandbox:`, error.message);
      return {
        success: false,
        error: error.message,
        sandboxId,
      };
    }
  },
});

/**
 * List all running E2B sandboxes
 */
export const listSandboxes = action({
  args: {},
  handler: async () => {
    try {
      const paginator = Sandbox.list({ apiKey: E2B_API_KEY });

      // Collect all sandboxes from paginator using nextItems()
      const sandboxes: {
        sandboxId: string;
        templateId: string;
        startedAt: Date;
      }[] = [];

      // Loop through all pages
      while (paginator.hasNext) {
        const items = await paginator.nextItems();
        for (const sandbox of items) {
          sandboxes.push({
            sandboxId: sandbox.sandboxId,
            templateId: sandbox.templateId,
            startedAt: sandbox.startedAt,
          });
        }
      }

      console.log(`📋 Found ${sandboxes.length} running sandboxes`);

      return {
        success: true,
        sandboxes,
        total: sandboxes.length,
      };
    } catch (error: any) {
      console.error(`❌ Error listing sandboxes:`, error.message);
      return {
        success: false,
        error: error.message,
        sandboxes: [],
        total: 0,
      };
    }
  },
});

/**
 * Kill/stop an E2B sandbox
 */
export const killSandbox = action({
  args: {
    sandboxIdOrUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const sandboxId = extractSandboxId(args.sandboxIdOrUrl);

    console.log(`🛑 Killing sandbox: ${sandboxId}`);

    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: E2B_API_KEY,
      });

      await sandbox.kill();

      console.log(`✅ Sandbox killed: ${sandboxId}`);

      return {
        success: true,
        sandboxId,
      };
    } catch (error: any) {
      console.error(`❌ Error killing sandbox:`, error.message);
      return {
        success: false,
        error: error.message,
        sandboxId,
      };
    }
  },
});
