"use server";

import { getGitHubToken } from "@/lib/auth/clerk";
import { inngest } from "@/lib/inngest";
import { Template } from "@/config";

export interface CreateSessionParams {
  sessionId: string;
  message?: string;
  repository?: string;
  template?: Template;
}

/**
 * Create a new session - Server Action (replaces create-session API route)
 * Use Server Actions for internal app logic like this
 */
export async function createSessionAction({
  sessionId,
  message,
  repository,
  template,
}: CreateSessionParams) {
  try {
    // Get GitHub OAuth access token from Clerk
    let githubToken = "";
    try {
      githubToken = await getGitHubToken();
    } catch (error) {
      console.error("Error getting GitHub OAuth token:", error);
      // Continue without token - will be handled in the Inngest function
    }

    // Send the Inngest event
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

    return { success: true, sessionId };
  } catch (error) {
    console.error("Error creating session:", error);
    throw new Error("Failed to create session");
  }
}

