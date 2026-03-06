import { inngest } from "../client";
import { updateSessionStatus } from "../middleware";
import { Template } from "@/config";
import { Id } from "@/convex/_generated/dataModel";
import { generateSessionTitle } from "@/app/actions/session";
import { E2BManager } from "@/lib/e2b/config";

export const createSession = inngest.createFunction(
  { id: "create-session", retries: 0, concurrency: 25 },
  { event: "vibracode/create.session" },
  async ({ event, step }) => {
    const {
      sessionId: id,
      message,
      repository,
      token,
      template,
    }: {
      sessionId: Id<"sessions">;
      message: string;
      repository: string;
      token: string;
      template: Template;
    } = event.data;

    // Create E2B manager with template configuration
    const e2bManager = new E2BManager({
      templateId: template?.image || "YOUR_E2B_TEMPLATE_ID", // Use template ID
      envVars: template?.secrets || {}
    });

    // Step 1: Create sandbox and trigger Claude immediately
    const sandboxData = await step.run("create sandbox", async () => {
      const title = await generateSessionTitle(message);

      const { fetchMutation } = await import("convex/nextjs");
      const { api } = await import("@/convex/_generated/api");

      await fetchMutation(api.sessions.update, {
        id,
        status: "CLONING_REPO",
        name: title,
      });

      // Create the sandbox
      const sandbox = await e2bManager.createSandbox();

      return {
        sandboxId: sandbox.sandboxId,
        title,
      };
    });

    // Step 2: Trigger Claude agent IMMEDIATELY after sandbox creation (don't wait for dev server)
    if (message) {
      await step.run("run agent early", async () => {
        console.log("🚀 Triggering Claude agent immediately after sandbox creation");
        await inngest.send({
          name: "vibracode/run.agent",
          data: {
            sessionId: sandboxData.sandboxId,
            id,
            message,
            template,
            repository: repository || null,
            token,
          },
        });
      });
    }

    // Step 3: Start dev server in parallel (Claude is already working)
    const data = await step.run("start dev server", async () => {
      // Reconnect to sandbox for dev server setup
      await e2bManager.connectToSandbox(sandboxData.sandboxId);

      if (!repository && template) {
        // For custom templates, everything is pre-configured
        await updateSessionStatus(id, "STARTING_DEV_SERVER");

        // Start the dev server (dependencies are already installed)
        for await (const command of template.startCommands) {
          await updateSessionStatus(id, command.status, undefined, sandboxData.sandboxId);
          await e2bManager.executeCommand(command.command, {
            background: command.background,
          });
        }

        const host = await e2bManager.getHost(3000);

        return {
          sandboxId: sandboxData.sandboxId,
          tunnelUrl: host,
          repository: null,
        };
      } else {
        // Clone repo if provided
        if (repository) {
          await e2bManager.executeCommand(
            `git clone https://${token}@github.com/${repository}.git .`
          );
        }

        await updateSessionStatus(id, "STARTING_DEV_SERVER");

        // Start expo dev server (dependencies are pre-baked, skip npm i)
        await e2bManager.executeCommand("echo fs.inotify.max_user_watches=524288 >> /etc/sysctl.conf && sysctl -p && npx expo start --tunnel --port 3000", {
          background: true,
        });

        await updateSessionStatus(id, "CREATING_TUNNEL");

        const host = await e2bManager.getHost(3000);

        return {
          sandboxId: sandboxData.sandboxId,
          tunnelUrl: host,
          repository: repository,
        };
      }
    });

    // Step 4: Update session with tunnel URL (no more 2s wait needed)
    await step.run("update session", async () => {
      await updateSessionStatus(id, "RUNNING", undefined, data.tunnelUrl, data.sandboxId);
    });

    return data;
  }
);
