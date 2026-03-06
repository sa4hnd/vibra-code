import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/oauth/revenuecat/disconnect
 * Remove RevenueCat credentials (disconnect)
 *
 * Body: { clerkId: string }
 * Response: { success: boolean, error?: string }
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

    await fetchMutation(api.revenuecat.remove, { clerkId });

    console.log("🔐 RevenueCat disconnected for user:", clerkId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect RevenueCat error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to disconnect RevenueCat",
      },
      { status: 500 }
    );
  }
}
