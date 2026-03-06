"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Octokit } from "@octokit/rest";
import { inngest } from "@/lib/inngest";
import { auth } from "@clerk/nextjs/server";

/**
 * Check if user has GitHub connected (checks Convex)
 */
export async function checkGitHubConnection(): Promise<{
  isConnected: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { isConnected: false, error: "Not authenticated" };
    }

    // Check Convex for stored credentials
    const creds = await fetchQuery(api.github.getByClerkId, { clerkId: userId });

    if (!creds) {
      return { isConnected: false };
    }

    // Verify token is still valid by fetching user info
    try {
      const octokit = new Octokit({ auth: creds.accessToken });
      const { data: user } = await octokit.rest.users.getAuthenticated();

      return {
        isConnected: true,
        username: user.login,
      };
    } catch (error) {
      // Token expired or invalid - remove from Convex
      await fetchMutation(api.github.remove, { clerkId: userId });
      return { isConnected: false, error: "GitHub token expired. Please reconnect." };
    }
  } catch (error) {
    console.error("GitHub connection check error:", error);
    return {
      isConnected: false,
      error: error instanceof Error ? error.message : "Failed to check GitHub connection",
    };
  }
}

/**
 * Save GitHub credentials after OAuth callback
 */
export async function saveGitHubCredentials(): Promise<{
  success: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated with Clerk" };
    }

    const session = await getServerSession(authOptions);
    if (!session?.accessToken || session?.provider !== "github") {
      return { success: false, error: "GitHub not connected via OAuth" };
    }

    // Get GitHub username
    const octokit = new Octokit({ auth: session.accessToken });
    const { data: user } = await octokit.rest.users.getAuthenticated();

    // Save to Convex
    await fetchMutation(api.github.upsert, {
      clerkId: userId,
      accessToken: session.accessToken,
      username: user.login,
    });

    return {
      success: true,
      username: user.login,
    };
  } catch (error) {
    console.error("Save GitHub credentials error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save credentials",
    };
  }
}

/**
 * Disconnect GitHub (remove credentials from Convex)
 */
export async function disconnectGitHub(): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    await fetchMutation(api.github.remove, { clerkId: userId });
    return { success: true };
  } catch (error) {
    console.error("Disconnect GitHub error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disconnect",
    };
  }
}

/**
 * Create a new GitHub repository
 */
export async function createGitHubRepo({
  repoName,
  isPrivate,
}: {
  repoName: string;
  isPrivate: boolean;
}): Promise<{
  success: boolean;
  repository?: string;
  repositoryUrl?: string;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Get token from Convex
    const creds = await fetchQuery(api.github.getByClerkId, { clerkId: userId });
    if (!creds?.accessToken) {
      return { success: false, error: "GitHub not connected" };
    }

    const octokit = new Octokit({ auth: creds.accessToken });

    // Create the repository
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
      auto_init: false,
      description: "Created with vibe0 - AI Mobile App Builder",
    });

    return {
      success: true,
      repository: repo.full_name,
      repositoryUrl: repo.html_url,
    };
  } catch (error: any) {
    console.error("Create repo error:", error);

    if (error.status === 422) {
      return { success: false, error: "Repository name already exists" };
    }
    if (error.status === 401) {
      return { success: false, error: "GitHub token expired. Please reconnect." };
    }

    return {
      success: false,
      error: error.message || "Failed to create repository",
    };
  }
}

/**
 * Create a new GitHub repository and trigger initial push
 */
export async function createAndPushToGitHub({
  sessionId,
  convexId,
  repoName,
  isPrivate,
}: {
  sessionId: string;
  convexId: Id<"sessions">;
  repoName: string;
  isPrivate: boolean;
}): Promise<{
  success: boolean;
  repository?: string;
  repositoryUrl?: string;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Check GitHub is connected
    const creds = await fetchQuery(api.github.getByClerkId, { clerkId: userId });
    if (!creds?.accessToken) {
      return { success: false, error: "GitHub not connected. Please connect your GitHub account." };
    }

    // Update session status
    await fetchMutation(api.sessions.update, {
      id: convexId,
      status: "CREATING_GITHUB_REPO",
      githubPushStatus: "in_progress",
    });

    // Create the repository
    const repoResult = await createGitHubRepo({ repoName, isPrivate });

    if (!repoResult.success || !repoResult.repository) {
      await fetchMutation(api.sessions.update, {
        id: convexId,
        status: "PUSH_FAILED",
        githubPushStatus: "failed",
      });
      return repoResult;
    }

    // Update session with repo info
    await fetchMutation(api.sessions.update, {
      id: convexId,
      githubRepository: repoResult.repository,
      githubRepositoryUrl: repoResult.repositoryUrl,
      status: "INITIALIZING_GIT",
    });

    // Trigger Inngest job for the push operation
    // Token will be fetched from Convex in the Inngest function
    await inngest.send({
      name: "vibracode/push.github",
      data: {
        sessionId,
        convexId,
        repository: repoResult.repository,
        isInitialPush: true,
      },
    });

    return {
      success: true,
      repository: repoResult.repository,
      repositoryUrl: repoResult.repositoryUrl,
    };
  } catch (error) {
    console.error("Create and push error:", error);

    await fetchMutation(api.sessions.update, {
      id: convexId,
      status: "PUSH_FAILED",
      githubPushStatus: "failed",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create repository",
    };
  }
}

/**
 * Generate a repository name from session name
 */
export async function generateRepoName(sessionName: string): Promise<string> {
  return sessionName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100) || "vibe0-app";
}

/**
 * Retry pushing to GitHub (for failed pushes)
 */
export async function retryGitHubPush({
  sessionId,
  convexId,
  repository,
}: {
  sessionId: string;
  convexId: Id<"sessions">;
  repository: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Check GitHub is connected
    const creds = await fetchQuery(api.github.getByClerkId, { clerkId: userId });
    if (!creds?.accessToken) {
      return { success: false, error: "GitHub not connected. Please reconnect." };
    }

    // Update session status
    await fetchMutation(api.sessions.update, {
      id: convexId,
      status: "PUSHING_TO_GITHUB",
      githubPushStatus: "in_progress",
    });

    // Trigger Inngest job for the push operation
    await inngest.send({
      name: "vibracode/push.github",
      data: {
        sessionId,
        convexId,
        repository,
        isInitialPush: false,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Retry push error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retry push",
    };
  }
}

/**
 * Clear session's GitHub repository (allows pushing to a new repo)
 */
export async function clearSessionGitHub({
  convexId,
}: {
  convexId: Id<"sessions">;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Clear GitHub fields from session (empty strings clear the values)
    await fetchMutation(api.sessions.update, {
      id: convexId,
      githubRepository: "",
      githubRepositoryUrl: "",
      githubPushStatus: "pending",
    });

    return { success: true };
  } catch (error) {
    console.error("Clear session GitHub error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear GitHub",
    };
  }
}
