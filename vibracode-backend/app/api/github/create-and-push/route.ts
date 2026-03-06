import { NextRequest, NextResponse } from "next/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Octokit } from "@octokit/rest";
import { inngest } from "@/lib/inngest";

/**
 * POST /api/github/create-and-push
 * Create a new GitHub repository and trigger initial push
 *
 * Body: { sessionId: string, convexId: string, repoName: string, isPrivate: boolean, clerkId: string }
 * Response: { success: boolean, repository?: string, repositoryUrl?: string, error?: string }
 */
export async function POST(request: NextRequest) {
  let convexId: Id<"sessions"> | null = null;

  try {
    const body = await request.json();
    const { sessionId, convexId: convexIdStr, repoName, isPrivate, clerkId } = body;

    if (!sessionId || !convexIdStr || !repoName || !clerkId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    convexId = convexIdStr as Id<"sessions">;

    // Get GitHub credentials from Convex
    const creds = await fetchQuery(api.github.getByClerkId, { clerkId });
    if (!creds?.accessToken) {
      return NextResponse.json({
        success: false,
        error: "GitHub not connected. Please connect your GitHub account.",
      });
    }

    // Update session status
    await fetchMutation(api.sessions.update, {
      id: convexId,
      status: "CREATING_GITHUB_REPO",
      githubPushStatus: "in_progress",
    });

    // Create the repository
    const octokit = new Octokit({ auth: creds.accessToken });

    let repo;
    try {
      const response = await octokit.rest.repos.createForAuthenticatedUser({
        name: repoName,
        private: isPrivate,
        auto_init: false,
        description: "Created with VibraCoder - AI Mobile App Builder",
      });
      repo = response.data;
    } catch (error: any) {
      console.error("Create repo error:", error);

      await fetchMutation(api.sessions.update, {
        id: convexId,
        status: "PUSH_FAILED",
        githubPushStatus: "failed",
      });

      if (error.status === 422) {
        return NextResponse.json({
          success: false,
          error: "Repository name already exists",
        });
      }
      if (error.status === 401) {
        return NextResponse.json({
          success: false,
          error: "GitHub token expired. Please reconnect.",
        });
      }

      return NextResponse.json({
        success: false,
        error: error.message || "Failed to create repository",
      });
    }

    // Update session with repo info
    await fetchMutation(api.sessions.update, {
      id: convexId,
      githubRepository: repo.full_name,
      githubRepositoryUrl: repo.html_url,
      status: "INITIALIZING_GIT",
    });

    // Trigger Inngest job for the push operation
    await inngest.send({
      name: "vibracode/push.github",
      data: {
        sessionId,
        convexId,
        repository: repo.full_name,
        isInitialPush: true,
      },
    });

    return NextResponse.json({
      success: true,
      repository: repo.full_name,
      repositoryUrl: repo.html_url,
    });
  } catch (error) {
    console.error("Create and push error:", error);

    // Update session with failure if we have convexId
    if (convexId) {
      try {
        await fetchMutation(api.sessions.update, {
          id: convexId,
          status: "PUSH_FAILED",
          githubPushStatus: "failed",
        });
      } catch (updateError) {
        console.error("Failed to update session status:", updateError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create repository",
      },
      { status: 500 }
    );
  }
}
