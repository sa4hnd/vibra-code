import { NextRequest, NextResponse } from "next/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Octokit } from "@octokit/rest";

/**
 * POST /api/github/check-connection
 * Check if user has GitHub connected and validate the token
 *
 * Body: { clerkId: string }
 * Response: { isConnected: boolean, username?: string, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerkId } = body;

    if (!clerkId) {
      return NextResponse.json(
        { isConnected: false, error: "Missing clerkId" },
        { status: 400 }
      );
    }

    // Check Convex for stored credentials
    const creds = await fetchQuery(api.github.getByClerkId, { clerkId });

    if (!creds) {
      return NextResponse.json({ isConnected: false });
    }

    // Verify token is still valid by fetching user info
    try {
      const octokit = new Octokit({ auth: creds.accessToken });
      const { data: user } = await octokit.rest.users.getAuthenticated();

      return NextResponse.json({
        isConnected: true,
        username: user.login,
      });
    } catch (error) {
      // Token expired or invalid - remove from Convex
      console.error("GitHub token validation failed:", error);
      await fetchMutation(api.github.remove, { clerkId });
      return NextResponse.json({
        isConnected: false,
        error: "GitHub token expired. Please reconnect.",
      });
    }
  } catch (error) {
    console.error("Check GitHub connection error:", error);
    return NextResponse.json(
      {
        isConnected: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check GitHub connection",
      },
      { status: 500 }
    );
  }
}
