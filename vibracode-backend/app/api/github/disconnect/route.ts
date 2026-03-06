import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/github/disconnect
 * Remove GitHub credentials (disconnect)
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

    await fetchMutation(api.github.remove, { clerkId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect GitHub error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to disconnect GitHub",
      },
      { status: 500 }
    );
  }
}
