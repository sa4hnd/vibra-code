import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * GET /api/github/status?convexId=xxx
 * Get GitHub push status for a session
 *
 * Response: { githubRepository, githubRepositoryUrl, githubPushStatus, githubPushDate }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const convexId = searchParams.get("convexId");

    if (!convexId) {
      return NextResponse.json(
        { error: "Missing convexId" },
        { status: 400 }
      );
    }

    // Use internal query - this is backend-only code, no ownership check needed
    const session = await fetchQuery(api.sessions.getByIdInternal, {
      id: convexId as Id<"sessions">,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      githubRepository: session.githubRepository || null,
      githubRepositoryUrl: session.githubRepositoryUrl || null,
      githubPushStatus: session.githubPushStatus || null,
      githubPushDate: session.githubPushDate || null,
    });
  } catch (error) {
    console.error("Get GitHub status error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get GitHub status",
      },
      { status: 500 }
    );
  }
}
