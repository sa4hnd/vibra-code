import { inngest } from "../client";
import { updateSessionStatus, addMessage, getSessionData } from "../middleware";
import { Id } from "@/convex/_generated/dataModel";
import { AppDataSchema, getAppDataJsonSchema, type AppData } from "@/lib/firecrawl/schema";
import { getAppStealerSystemPrompt, getAppStealerSummary, getFirecrawlPrompt } from "@/lib/prompts/app-stealer";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;
const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v2/agent";

// Polling configuration
const POLL_INTERVAL_SECONDS = 10; // 10 seconds between polls
const MAX_POLL_ATTEMPTS = 30; // 5 minutes max wait (30 * 10s)
const MAX_FIRECRAWL_RETRIES = 3; // Retry Firecrawl agent on sandbox failures

// URL normalization helper
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  // Add https:// if no protocol specified
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

// Helper to start a single Firecrawl job
async function startFirecrawlJob(
  prompt: string,
  urls: string[] | undefined,
  schema: object
): Promise<{ jobId: string } | { data: AppData; creditsUsed: number }> {
  const requestBody = {
    prompt,
    urls,
    model: "spark-1-pro",
    schema,
  };

  console.log(`[steal-app] Calling Firecrawl API with urls: ${JSON.stringify(urls)}`);

  const response = await fetch(FIRECRAWL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log(`[steal-app] Firecrawl response status: ${response.status}`);
  console.log(`[steal-app] Firecrawl response: ${responseText.slice(0, 1000)}`);

  if (!response.ok) {
    throw new Error(`Firecrawl API error (${response.status}): ${responseText}`);
  }

  const result = JSON.parse(responseText);

  // Check if synchronous completion
  if (result.status === "completed" && result.data) {
    console.log(`[steal-app] Firecrawl completed synchronously`);
    return { data: result.data as AppData, creditsUsed: result.creditsUsed };
  }

  // Check if job started successfully
  if (result.success && result.id) {
    console.log(`[steal-app] Firecrawl job started, id: ${result.id}`);
    return { jobId: result.id };
  }

  throw new Error(result.error || "Failed to start Firecrawl agent");
}

interface StealAppEventData {
  sessionId: Id<"sessions">;
  input: string;
  inputType: "name" | "appstore" | "playstore" | "website";
  userId: string;
}

// Type for Firecrawl agent job result
type FirecrawlJobResult =
  | { completed: true; data: AppData; creditsUsed: number }
  | { completed: false; jobId: string };

export const stealApp = inngest.createFunction(
  {
    id: "steal-app",
    retries: 2,
    concurrency: 10,
    onFailure: async ({ error, event }) => {
      const eventData = event.data as unknown as StealAppEventData;
      const sessionId = eventData?.sessionId;

      if (!sessionId) {
        console.error("[steal-app] No sessionId in failure handler");
        return;
      }

      try {
        await updateSessionStatus(sessionId, "RUNNING");

        // Sanitize error message
        let sanitizedError = error?.message || "Unknown error";
        const secretPatterns = [
          /fc-[a-zA-Z0-9]+/g, // Firecrawl API key
          /sk-[a-zA-Z0-9-]+/g,
          /Bearer\s+[a-zA-Z0-9._-]+/gi,
        ];
        for (const pattern of secretPatterns) {
          sanitizedError = sanitizedError.replace(pattern, "[REDACTED]");
        }

        await addMessage(
          sessionId,
          `## App Stealer Failed\n\nSomething went wrong while researching the app.\n\n\`\`\`\n${sanitizedError}\n\`\`\`\n\nPlease try again with a different app or URL.`,
          "assistant"
        );

        // Update stolen app record if exists
        try {
          await fetchMutation(api.stolenApps.updateStatus, {
            sessionId,
            status: "failed",
            errorMessage: sanitizedError,
          });
        } catch {
          // Ignore if no record exists
        }
      } catch (e) {
        console.error("Failed to handle steal-app failure:", e);
      }
    },
  },
  { event: "vibracode/steal.app" },
  async ({ event, step }) => {
    const { sessionId, input, inputType, userId } = event.data as StealAppEventData;

    console.log(`[steal-app] Starting for: ${input} (${inputType})`);

    // Step 1: Create stolen app record and send initial message
    await step.run("initialize", async () => {
      await updateSessionStatus(sessionId, "CUSTOM", "Researching app...");

      // Create record in Convex
      await fetchMutation(api.stolenApps.create, {
        sessionId,
        clerkId: userId,
        input,
        inputType,
      });

      const inputDescription =
        inputType === "name"
          ? `the app "${input}"`
          : `the app at \`${input}\``;

      await addMessage(
        sessionId,
        `## App Stealer Started\n\nResearching ${inputDescription}...\n\nThis may take 30-60 seconds. I'll analyze:\n- App description & features\n- Screenshots & UI patterns\n- Color scheme & design style\n- Navigation structure\n- Pricing model`,
        "assistant"
      );
    });

    // Step 2: Build Firecrawl prompt
    const firecrawlConfig = await step.run("prepare-firecrawl", async () => {
      const prompt = getFirecrawlPrompt(input, inputType);
      // Normalize URLs - add https:// if missing
      const urls = inputType !== "name" ? [normalizeUrl(input)] : undefined;

      console.log(`[steal-app] Firecrawl config - prompt length: ${prompt.length}, urls: ${JSON.stringify(urls)}`);
      return { prompt, urls };
    });

    // Step 3: Start Firecrawl Agent job
    const agentJobResult: FirecrawlJobResult = await step.run("start-firecrawl-agent", async () => {
      await addMessage(sessionId, "Searching and analyzing the web...", "assistant");

      const result = await startFirecrawlJob(
        firecrawlConfig.prompt,
        firecrawlConfig.urls,
        getAppDataJsonSchema()
      );

      if ("data" in result) {
        return { completed: true as const, data: result.data, creditsUsed: result.creditsUsed };
      }
      return { completed: false as const, jobId: result.jobId };
    });

    // Step 4: Poll for completion using step.sleep for proper Inngest handling
    let appData: AppData;

    if (agentJobResult.completed) {
      appData = agentJobResult.data;
    } else {
      let currentJobId = agentJobResult.jobId;
      let pollResult: { status: "completed"; data: AppData } | { status: "pending" } | { status: "failed"; error: string } = { status: "pending" };

      for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
        // Use step.sleep so Inngest handles the wait properly (survives serverless timeouts)
        await step.sleep(`poll-wait-${attempt}`, `${POLL_INTERVAL_SECONDS}s`);

        // Each poll is its own step so it's memoized
        pollResult = await step.run(`poll-attempt-${attempt}`, async () => {
          console.log(`[steal-app] Poll attempt ${attempt}/${MAX_POLL_ATTEMPTS} for job ${currentJobId}`);

          const statusResponse = await fetch(`https://api.firecrawl.dev/v2/agent/${currentJobId}`, {
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            },
          });

          const statusText = await statusResponse.text();
          console.log(`[steal-app] Poll response: ${statusText.slice(0, 1000)}`);

          if (!statusResponse.ok) {
            console.warn(`[steal-app] Status check failed: ${statusResponse.status}`);
            return { status: "pending" as const };
          }

          const status = JSON.parse(statusText);

          if (status.status === "completed") {
            console.log(`[steal-app] Agent completed! Credits used: ${status.creditsUsed}`);
            return { status: "completed" as const, data: status.data as AppData };
          }

          if (status.status === "failed") {
            return { status: "failed" as const, error: status.error || "Firecrawl agent failed" };
          }

          return { status: "pending" as const };
        });

        if (pollResult.status === "completed") {
          break;
        }

        if (pollResult.status === "failed") {
          // Check for sandbox failure - retry with new job
          if (pollResult.error.includes("Sandbox") || pollResult.error.includes("sandbox")) {
            const retryResult = await step.run(`retry-firecrawl-${attempt}`, async () => {
              console.log(`[steal-app] Sandbox failure, starting new job...`);
              await addMessage(sessionId, "Research hit a snag, retrying...", "assistant");

              const result = await startFirecrawlJob(
                firecrawlConfig.prompt,
                firecrawlConfig.urls,
                getAppDataJsonSchema()
              );

              if ("data" in result) {
                return { completed: true as const, data: result.data };
              }
              return { completed: false as const, jobId: result.jobId };
            });

            if (retryResult.completed) {
              pollResult = { status: "completed", data: retryResult.data };
              break;
            }
            currentJobId = retryResult.jobId;
            pollResult = { status: "pending" };
            continue;
          }

          throw new Error(pollResult.error);
        }

        // Send progress update every 3 polls (30 seconds)
        if (attempt % 3 === 0) {
          await step.run(`progress-${attempt}`, async () => {
            await addMessage(sessionId, `Still researching... (${attempt * POLL_INTERVAL_SECONDS}s)`, "assistant");
          });
        }
      }

      if (pollResult.status !== "completed") {
        throw new Error(`Firecrawl agent timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_SECONDS} seconds`);
      }

      appData = pollResult.data;
    }

    // Step 5: Validate and enrich data
    const validatedAppData = await step.run("validate-app-data", async () => {
      // Try to validate with Zod
      const parsed = AppDataSchema.safeParse(appData);

      if (!parsed.success) {
        console.warn("[steal-app] Zod validation warnings:", parsed.error.issues);
        // Use raw data with defaults for missing required fields
        const defaultData: AppData = {
          name: appData?.name || input,
          category: appData?.category || "Unknown",
          description: appData?.description || "No description available",
          features: appData?.features || [],
          mainFunctionality: appData?.mainFunctionality || appData?.description?.slice(0, 100) || "App functionality",
          // Spread remaining data
          developer: appData?.developer,
          shortDescription: appData?.shortDescription,
          rating: appData?.rating,
          iconUrl: appData?.iconUrl,
          screenshots: appData?.screenshots,
          colorScheme: appData?.colorScheme,
          navigationStyle: appData?.navigationStyle,
          pricingModel: appData?.pricingModel,
          requiresSubscription: appData?.requiresSubscription,
          hasInAppPurchases: appData?.hasInAppPurchases,
          targetAudience: appData?.targetAudience,
        };
        return defaultData;
      }

      return parsed.data;
    });

    // Step 6: Update Convex record with app data
    await step.run("save-app-data", async () => {
      await fetchMutation(api.stolenApps.updateWithData, {
        sessionId,
        appData: validatedAppData,
        status: "completed",
      });
    });

    // Step 7: Send research summary to chat
    await step.run("send-research-summary", async () => {
      const summary = getAppStealerSummary(validatedAppData);
      await addMessage(sessionId, `${summary}\n\n**Starting app recreation...**`, "assistant");
    });

    // Step 8: Get session and trigger run-agent
    await step.run("trigger-run-agent", async () => {
      const session = await getSessionData(sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      // Build the comprehensive prompt for run-agent
      const systemPrompt = getAppStealerSystemPrompt(validatedAppData);

      const message = `Recreate the app "${validatedAppData.name}" based on the research I just completed.

${systemPrompt}`;

      // Get template if available
      let template = null;
      if (session.templateId) {
        try {
          const { templates } = await import("@/config");
          template = templates.find((t) => t.id === session.templateId) || templates[0];
        } catch {
          // Use default template
        }
      }

      // Trigger run-agent with the app recreation prompt
      await inngest.send({
        name: "vibracode/run.agent",
        data: {
          sessionId: session.sessionId,
          id: sessionId,
          message,
          template,
        },
      });

      console.log(`[steal-app] Triggered run-agent for session ${sessionId}`);
    });

    return {
      success: true,
      appName: validatedAppData.name,
      sessionId,
      features: validatedAppData.features?.length || 0,
      screenshots: validatedAppData.screenshots?.length || 0,
    };
  }
);
