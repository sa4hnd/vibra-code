/**
 * Shared Clerk Authentication Utilities
 * Centralized authentication helpers to avoid duplication
 */

import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * Get the current authenticated user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch (error) {
    console.error("Error getting user ID:", error);
    return null;
  }
}

/**
 * Get GitHub OAuth access token for the current user
 */
export async function getGitHubToken(userId?: string): Promise<string> {
  const currentUserId = userId || await getCurrentUserId();

  if (!currentUserId) {
    throw new Error("User not authenticated");
  }

  try {
    const client = await clerkClient();
    const oauthTokens = await client.users.getUserOauthAccessToken(currentUserId, "github");

    console.log("[GitHub OAuth] User ID:", currentUserId);
    console.log("[GitHub OAuth] Token response:", JSON.stringify({
      hasData: !!oauthTokens.data,
      dataLength: oauthTokens.data?.length || 0,
      hasToken: !!oauthTokens.data?.[0]?.token,
    }));

    if (!oauthTokens.data || oauthTokens.data.length === 0) {
      console.log("[GitHub OAuth] No connected GitHub account found. User needs to connect via Manage Account → Connected Accounts");
      return "";
    }

    return oauthTokens.data[0]?.token || "";
  } catch (error) {
    console.error("[GitHub OAuth] Error getting token:", error);
    return "";
  }
}

/**
 * Check if user has GitHub integration
 */
export async function hasGitHubIntegration(userId?: string): Promise<boolean> {
  try {
    const token = await getGitHubToken(userId);
    return token.length > 0;
  } catch (error) {
    return false;
  }
}

