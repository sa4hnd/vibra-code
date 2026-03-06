import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Octokit } from "@octokit/rest";

// Mobile app OAuth credentials (separate from web)
const MOBILE_GITHUB_CLIENT_ID = "Ov23ctj6sbaNQgrLG2hV";
const MOBILE_GITHUB_CLIENT_SECRET = "b5bf578b8209b6b761e972bf6c30b20559a3018d";

/**
 * POST /api/github/exchange-token
 * Exchange OAuth authorization code for access token and save credentials
 *
 * Body: { code: string, clerkId: string, source?: "mobile" | "web" }
 * Response: { success: boolean, username?: string, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, clerkId, source } = body;

    if (!code || !clerkId) {
      return NextResponse.json(
        { success: false, error: "Missing code or clerkId" },
        { status: 400 }
      );
    }

    // Use mobile credentials if source is mobile, otherwise use web credentials from env
    const clientId = source === "mobile" ? MOBILE_GITHUB_CLIENT_ID : process.env.GITHUB_CLIENT_ID;
    const clientSecret = source === "mobile" ? MOBILE_GITHUB_CLIENT_SECRET : process.env.GITHUB_CLIENT_SECRET;

    // Exchange code for access token with GitHub
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("GitHub token exchange error:", tokenData);
      return NextResponse.json({
        success: false,
        error: tokenData.error_description || "Failed to exchange code",
      });
    }

    if (!tokenData.access_token) {
      return NextResponse.json({
        success: false,
        error: "No access token received from GitHub",
      });
    }

    // Get GitHub username
    const octokit = new Octokit({ auth: tokenData.access_token });
    const { data: user } = await octokit.rest.users.getAuthenticated();

    // Save to Convex
    await fetchMutation(api.github.upsert, {
      clerkId,
      accessToken: tokenData.access_token,
      username: user.login,
    });

    return NextResponse.json({
      success: true,
      username: user.login,
    });
  } catch (error) {
    console.error("Exchange token error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to exchange token",
      },
      { status: 500 }
    );
  }
}
