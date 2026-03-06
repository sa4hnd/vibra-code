"use server";

import { inngest } from "@/lib/inngest";
import { Template } from "@/config";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export interface RunAgentParams {
  sessionId: string;
  id: string;
  message: string;
  template?: Template;
  repository?: string;
}

const MIN_CREDITS_REQUIRED = 0.10; // Minimum credits required (before 4x multiplier)

/**
 * Run AI agent - Server Action (replaces run-agent API route)
 * Use Server Actions for internal app logic like this
 */
export async function runAgentAction({
  sessionId,
  id,
  message,
  template,
  repository,
}: RunAgentParams) {
  try {
    // Validate required parameters
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    if (!id) {
      throw new Error('Session database ID is required');
    }

    if (!message) {
      throw new Error('Message is required');
    }

    // PRE-FLIGHT BILLING CHECK: Check billing status before triggering agent
    // Get session data to find the creator's clerkId
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

    console.log('📤 SENDING INNGEST EVENT:', {
      name: "vibracode/run.agent",
      data: { sessionId, id, message: message.substring(0, 50) + '...', template: template?.name, repository }
    });

    // Send the Inngest event
    await inngest.send({
      name: "vibracode/run.agent",
      data: {
        sessionId,
        id,
        message,
        template,
        repository,
      },
    });

    console.log('✅ INNGEST EVENT SENT SUCCESSFULLY');
    return { success: true, sessionId, messageId: id };
  } catch (error) {
    console.error("Error running agent:", error);
    throw new Error("Failed to run agent");
  }
}