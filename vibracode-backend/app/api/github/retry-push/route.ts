import { NextRequest, NextResponse } from "next/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { inngest } from "@/lib/inngest";

/**
 * POST /api/github/retry-push
 * Retry pushing to GitHub (for failed pushes)
 *
 * Body: { sessionId: string, convexId: string, repository: string, clerkId: string }
 * Response: { success: boolean, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, convexId: convexIdStr, repository, clerkId } = body;

    if (!sessionId || !convexIdStr || !repository || !clerkId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const convexId = convexIdStr as Id<"sessions">;

    // Check GitHub is connected
    const creds = await fetchQuery(api.github.getByClerkId, { clerkId });
    if (!creds?.accessToken) {
      return NextResponse.json({
        success: false,
        error: "GitHub not connected. Please reconnect.",
      });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Retry push error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to retry push",
      },
      { status: 500 }
    );
  }
}
