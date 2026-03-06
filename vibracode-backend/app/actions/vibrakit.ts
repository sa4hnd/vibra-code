"use server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { inngest } from "@/lib/inngest";
import { auth } from "@clerk/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";
import { Template } from "@/config";
import { getGitHubToken } from "@/lib/auth/clerk";
import { createConvexProjectForSession } from "./sessions/create-convex-project";
import { E2BManager, createGitHubPullRequest } from "@/lib/e2b/config";

const MIN_CREDITS_REQUIRED = 0.10; // Minimum credits required (before 4x multiplier)

export async function runAgentAction({
  sessionId,
  id,
  message,
  template,
  repository,
  token,
  model,
}: {
  sessionId: string;
  id: string;
  message: string;
  template?: Template;
  token: string;
  repository?: string;
  model?: string;
}) {
  // PRE-FLIGHT BILLING CHECK: Check billing status before triggering agent
  // Use internal query - this is backend-only code, no ownership check needed
  const sessionData = await fetchQuery(api.sessions.getByIdInternal, { id: id as Id<"sessions"> });
  const clerkId = sessionData?.createdBy;

  if (clerkId) {
    const billingStatus = await fetchQuery(api.billingSwitch.getBillingStatus, { clerkId });

    if (billingStatus?.billingMode === 'credits') {
      const creditsRemaining = billingStatus?.creditsRemaining || 0;
      if (creditsRemaining < MIN_CREDITS_REQUIRED * 4) {
        console.error(`❌ Pre-flight check failed: Insufficient credits: $${creditsRemaining.toFixed(2)}`);

        // Add error message to chat
        await fetchMutation(api.messages.add, {
          sessionId: id as Id<"sessions">,
          content: `⚠️ **Insufficient Credits**\n\nYou have $${creditsRemaining.toFixed(2)} credits remaining, but you need at least $${(MIN_CREDITS_REQUIRED * 4).toFixed(2)} to continue.\n\n**Upgrade to unlock:**\n• Submit apps directly to the App Store\n• Integrate real payments with one click (RevenueCat)\n• Push to GitHub automatically\n• Unlimited AI-powered app building\n\n**Go to your Profile to upgrade and start making money with your apps!**`,
          role: "assistant",
        });

        return {
          success: false,
          error: 'insufficient_credits',
          message: `Insufficient credits. You have $${creditsRemaining.toFixed(2)} but need at least $${(MIN_CREDITS_REQUIRED * 4).toFixed(2)}.`
        };
      }
    } else {
      // Token mode check
      const tokensRemaining = billingStatus?.tokensRemaining || 0;
      if (tokensRemaining <= 0) {
        console.error(`❌ Pre-flight check failed: No tokens remaining`);

        // Add error message to chat
        await fetchMutation(api.messages.add, {
          sessionId: id as Id<"sessions">,
          content: `⚠️ **No Messages Remaining**\n\nYou've used all your messages for this billing period.\n\n**Upgrade to unlock:**\n• Submit apps directly to the App Store\n• Integrate real payments with one click (RevenueCat)\n• Push to GitHub automatically\n• Unlimited AI-powered app building\n\n**Go to your Profile to upgrade and start making money with your apps!**`,
          role: "assistant",
        });

        return {
          success: false,
          error: 'no_tokens',
          message: 'No messages remaining in your plan.'
        };
      }
    }
  }

  await inngest.send({
    name: "vibracode/run.agent",
    data: {
      sessionId,
      id,
      message,
      template,
      repository,
      token,
      model,
    },
  });

  return { success: true };
}

export async function createSessionAction({
  sessionId,
  message,
  repository,
  template,
}: {
  sessionId: string;
  message?: string;
  repository?: string;
  template?: Template;
}) {
  // Get GitHub OAuth access token from Clerk using shared utility
  let githubToken = "";
  try {
    githubToken = await getGitHubToken();
  } catch (error) {
    console.error("Error getting GitHub OAuth token:", error);
    // Continue without token - will be handled in the Inngest function
  }
  
  // Convex project creation is always manual via OAuth
  // Users connect when they need a database
  console.log('⏭️ Convex project creation is manual - user connects via OAuth when needed');
  
  await inngest.send({
    name: "vibracode/create.session",
    data: {
      sessionId,
      message,
      repository,
      token: githubToken,
      template,
    },
  });
}

export async function deleteSessionAction(sessionId: string) {
  // Use E2B manager for session deletion
  const e2bManager = new E2BManager();

  try {
    // Create sandbox to get access to the session
    const sandbox = await e2bManager.createSandbox();
    await e2bManager.kill();
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}

export const createPullRequestAction = async ({
  id,
  sessionId,
  repository,
}: {
  id: Id<"sessions">;
  sessionId: string;
  repository: string;
}) => {
  // Get GitHub token using shared utility
  const githubToken = await getGitHubToken();
  if (!githubToken) {
    throw new Error("No GitHub token found. Please connect your GitHub account in your profile settings.");
  }

  // Use E2B manager for PR creation
  const e2bManager = new E2BManager();

  try {
    // Create sandbox to get access to the session
    const sandbox = await e2bManager.createSandbox();

    // Create pull request using direct GitHub API
    const pr = await createGitHubPullRequest({
      token: githubToken,
      repository: repository
    });

    await fetchMutation(api.sessions.update, {
      id,
      pullRequest: pr,
    });
  } catch (error) {
    console.error('Error creating pull request:', error);
    throw error;
  }
};
