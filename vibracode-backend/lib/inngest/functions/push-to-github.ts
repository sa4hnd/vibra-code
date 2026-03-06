import { inngest } from "../client";
import { updateSessionStatus, getSessionData } from "../middleware";
import { Id } from "@/convex/_generated/dataModel";
import { E2BManager } from "@/lib/e2b/config";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const pushToGitHub = inngest.createFunction(
  { id: "push-to-github", retries: 1, concurrency: 1 },
  { event: "vibracode/push.github" },
  async ({ event, step }) => {
    console.log("🚀 PUSH TO GITHUB FUNCTION STARTED");

    const {
      sessionId,
      convexId,
      repository,
      isInitialPush,
    }: {
      sessionId: string;
      convexId: Id<"sessions">;
      repository: string;
      isInitialPush?: boolean;
    } = event.data;

    const result = await step.run("push code to github", async () => {
      try {
        // Get session data to check current status
        const sessionData = await getSessionData(convexId);
        if (!sessionData?.createdBy) {
          throw new Error("Session has no creator");
        }

        // Note: githubPushStatus is set to "in_progress" by the caller before sending
        // the Inngest event, so we expect it to be "in_progress" here.
        // Inngest's built-in concurrency: 1 prevents duplicate runs.

        // Get GitHub token from Convex
        const githubCreds = await fetchQuery(api.github.getByClerkId, {
          clerkId: sessionData.createdBy,
        });

        if (!githubCreds?.accessToken) {
          throw new Error("GitHub not connected. Please connect your GitHub account.");
        }

        // Connect to existing sandbox
        const e2bManager = new E2BManager();
        await e2bManager.connectToSandbox(sessionId);

        // Update status
        await updateSessionStatus(convexId, "INITIALIZING_GIT");

        // Only initialize fresh git on first push, otherwise preserve history
        if (isInitialPush) {
          await e2bManager.initializeGit();
        }

        await updateSessionStatus(convexId, "ADDING_FILES");

        // Generate commit message
        const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
        const commitMessage = isInitialPush
          ? `🚀 Initial commit - Built with Vibra Code`
          : `✨ Update - Built with Vibra Code`;

        await updateSessionStatus(convexId, "COMMITTING_CHANGES");

        // Commit and push
        await updateSessionStatus(convexId, "PUSHING_TO_GITHUB");

        const pushResult = await e2bManager.commitAndPush(
          githubCreds.accessToken,
          repository,
          commitMessage,
          isInitialPush ?? false
        );

        if (!pushResult.success) {
          throw new Error(pushResult.error || "Push failed");
        }

        // Update session with success
        await fetchMutation(api.sessions.update, {
          id: convexId,
          status: "PUSH_COMPLETE",
          githubPushStatus: "completed",
          githubPushDate: Date.now(),
        });

        console.log("✅ PUSH TO GITHUB COMPLETED");
        return { success: true };
      } catch (error) {
        console.error("❌ PUSH TO GITHUB FAILED:", error);

        // Update session with failure
        await fetchMutation(api.sessions.update, {
          id: convexId,
          status: "PUSH_FAILED",
          githubPushStatus: "failed",
        });

        throw error;
      }
    });

    // Return to RUNNING status after push completes
    await step.run("restore session status", async () => {
      await updateSessionStatus(convexId, "RUNNING");
    });

    return result;
  }
);
