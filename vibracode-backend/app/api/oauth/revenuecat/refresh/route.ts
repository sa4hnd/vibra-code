import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const REVENUECAT_CLIENT_ID = process.env.REVENUECAT_OAUTH_CLIENT_ID;

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/oauth/revenuecat/refresh
 * Refresh RevenueCat access token using refresh token
 *
 * NOTE: This is a PUBLIC client (PKCE), so we don't use client_secret
 *
 * Body: { clerkId: string }
 * Response: { success: boolean, expiresAt?: number, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerkId } = body;

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: "Missing clerkId" },
        { status: 400 }
      );
    }

    if (!REVENUECAT_CLIENT_ID) {
      console.error("Missing REVENUECAT_OAUTH_CLIENT_ID environment variable");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get existing credentials
    const credentials = await convex.query(api.revenuecat.getByClerkId, { clerkId });

    if (!credentials) {
      return NextResponse.json(
        { success: false, error: "No RevenueCat credentials found" },
        { status: 404 }
      );
    }

    console.log("🔐 Refreshing RevenueCat tokens for user:", clerkId);

    // Exchange refresh token for new tokens (public client - no client_secret)
    const tokenResponse = await fetch("https://api.revenuecat.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: REVENUECAT_CLIENT_ID,
        // No client_secret for public clients
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", {
        status: tokenResponse.status,
        error: errorText,
      });

      // If refresh token is invalid, the user needs to re-authenticate
      if (tokenResponse.status === 400 || tokenResponse.status === 401) {
        // Remove invalid credentials
        await convex.mutation(api.revenuecat.remove, { clerkId });
        return NextResponse.json(
          {
            success: false,
            error: "Session expired. Please reconnect your RevenueCat account.",
            needsReauth: true,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: "Failed to refresh token" },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("🔐 Token refresh successful:", {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });

    const { access_token, refresh_token, expires_in } = tokenData;

    // Calculate expiration time (expires_in is in seconds)
    const expiresAt = Date.now() + expires_in * 1000;

    // Update credentials in Convex
    await convex.mutation(api.revenuecat.updateTokens, {
      clerkId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
    });

    console.log("✅ RevenueCat tokens refreshed for user:", clerkId);

    return NextResponse.json({
      success: true,
      expiresAt,
    });
  } catch (error) {
    console.error("Refresh RevenueCat token error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh token",
      },
      { status: 500 }
    );
  }
}
