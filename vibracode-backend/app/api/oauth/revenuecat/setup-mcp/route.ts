import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { E2BManager } from "@/lib/e2b/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/oauth/revenuecat/setup-mcp
 * Set up RevenueCat MCP in the sandbox for the AI agent to use
 *
 * Body: { clerkId: string, sessionId: string }
 * Response: { success: boolean, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { clerkId, sessionId } = await request.json();

    if (!clerkId || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing clerkId or sessionId" },
        { status: 400 }
      );
    }

    console.log("🔐 Setting up RevenueCat MCP for session:", sessionId);

    // Get RevenueCat credentials for the user
    const credentials = await convex.query(api.revenuecat.getByClerkId, { clerkId });

    if (!credentials) {
      return NextResponse.json(
        { success: false, error: "RevenueCat not connected. Please connect your account first." },
        { status: 404 }
      );
    }

    // Check if token is expired and refresh if needed
    if (credentials.expiresAt < Date.now()) {
      console.log("🔄 Token expired, attempting refresh...");

      const refreshResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "https://vibracodeapp.com"}/api/oauth/revenuecat/refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clerkId }),
        }
      );

      const refreshData = await refreshResponse.json();
      if (!refreshResponse.ok || !refreshData.success) {
        return NextResponse.json(
          {
            success: false,
            error: "RevenueCat session expired. Please reconnect your account.",
            needsReauth: true
          },
          { status: 401 }
        );
      }

      // Re-fetch the updated credentials
      const updatedCredentials = await convex.query(api.revenuecat.getByClerkId, { clerkId });
      if (!updatedCredentials) {
        return NextResponse.json(
          { success: false, error: "Failed to get updated credentials" },
          { status: 500 }
        );
      }
      credentials.accessToken = updatedCredentials.accessToken;
    }

    // Connect to the sandbox
    const e2bManager = new E2BManager({
      templateId: "YOUR_E2B_TEMPLATE_ID",
    });

    await e2bManager.connectToSandbox(sessionId);

    // Create MCP config directly in project's .claude directory
    // This is the correct location for Claude Code to find MCP servers
    const mcpConfig = {
      mcpServers: {
        revenuecat: {
          type: "http",
          url: "https://mcp.revenuecat.ai/mcp",
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`
          }
        }
      }
    };

    console.log("📦 Writing RevenueCat MCP config to project...");

    // Create .claude directory if it doesn't exist
    await e2bManager.executeCommand("mkdir -p /vibe0/.claude", { cwd: "/vibe0" });

    // Write MCP config to project's settings.local.json
    const configPath = "/vibe0/.claude/settings.local.json";

    // Check if settings.local.json already exists and merge configs
    const checkResult = await e2bManager.executeCommand(`cat ${configPath} 2>/dev/null || echo '{}'`, { cwd: "/vibe0" });
    let existingConfig: any = {};
    try {
      existingConfig = JSON.parse(checkResult.stdout.trim() || "{}");
    } catch {
      existingConfig = {};
    }

    // Merge MCP servers
    const mergedConfig = {
      ...existingConfig,
      mcpServers: {
        ...(existingConfig.mcpServers || {}),
        ...mcpConfig.mcpServers
      }
    };

    // Write the merged config
    const configJson = JSON.stringify(mergedConfig, null, 2);
    const writeResult = await e2bManager.executeCommand(
      `cat > ${configPath} << 'MCPEOF'
${configJson}
MCPEOF`,
      { cwd: "/vibe0" }
    );

    if (writeResult.exitCode !== 0) {
      console.error("❌ Failed to write MCP config:", writeResult.stderr);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to set up RevenueCat MCP: ${writeResult.stderr || writeResult.stdout}`
        },
        { status: 500 }
      );
    }

    console.log("✅ RevenueCat MCP config written to", configPath);
    console.log("📝 Config:", configJson);

    return NextResponse.json({
      success: true,
      message: "RevenueCat MCP configured! Send a new message to the AI to start using RevenueCat tools.",
      hint: "The AI will have access to RevenueCat tools in your next message.",
    });
  } catch (error) {
    console.error("Error setting up RevenueCat MCP:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to set up RevenueCat MCP",
      },
      { status: 500 }
    );
  }
}
