import { NextRequest, NextResponse } from "next/server";
import { E2BManager } from "@/lib/e2b/config";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID is required" },
        { status: 400 }
      );
    }

    console.log(`[restart-dev-server] Restarting dev server for session: ${sessionId}`);

    // First, pause the sandbox to reset its state
    console.log("[restart-dev-server] Pausing sandbox...");
    try {
      const pauseManager = new E2BManager();
      await pauseManager.connectToSandbox(sessionId);
      await pauseManager.pause();
      console.log("[restart-dev-server] Sandbox paused successfully");
    } catch (pauseError) {
      console.warn("[restart-dev-server] Pause failed (may already be paused):", pauseError);
    }

    // Wait for pause to complete fully
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Resume the sandbox with a FRESH manager (old connection is stale after pause)
    console.log("[restart-dev-server] Resuming sandbox with fresh connection...");
    const e2bManager = new E2BManager();
    try {
      await e2bManager.connectToSandbox(sessionId);
      console.log("[restart-dev-server] Sandbox resumed successfully");
    } catch (resumeError) {
      console.error("[restart-dev-server] Resume failed:", resumeError);
      throw resumeError;
    }

    // Kill existing dev server processes using a safer approach
    console.log("[restart-dev-server] Killing existing dev server processes...");
    try {
      // Kill processes by port (more reliable than pkill)
      await e2bManager.executeCommand(
        'kill $(lsof -t -i:3000) 2>/dev/null || kill $(lsof -t -i:8081) 2>/dev/null || echo "No processes to kill"',
        { background: false }
      );
    } catch {
      // Ignore errors from kill command - it's expected if processes don't exist
      console.log("[restart-dev-server] Kill command completed (may have no processes)");
    }

    // Wait a moment for processes to terminate
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Fix ALL permissions before doing anything else (use || true to ignore errors on system files)
    // Note: E2B runs as 'user' not root, so we use sudo for chown
    console.log("[restart-dev-server] Fixing permissions on /vibe0 and /tmp...");
    await e2bManager.executeCommand(
      "sudo chown -R user:user /vibe0 2>/dev/null || true; chmod -R 777 /vibe0 || true; chmod -R 777 /tmp 2>/dev/null || true; mkdir -p /tmp/metro-cache && chmod -R 777 /tmp/metro-cache || true",
      { background: false }
    );

    // Clean and reinstall node_modules to fix any corrupted packages
    console.log("[restart-dev-server] Reinstalling node_modules...");
    try {
      // Full reinstall - removes all node_modules and reinstalls fresh
      // IMPORTANT: Explicitly cd to /vibe0 to ensure correct directory after pause/resume
      await e2bManager.executeCommand(
        "cd /vibe0 && rm -rf node_modules && npm install --legacy-peer-deps",
        { background: false, cwd: "/vibe0" }
      );
      console.log("[restart-dev-server] npm install completed");
    } catch (npmError) {
      console.warn("[restart-dev-server] npm install failed, continuing anyway:", npmError);
    }

    // Fix permissions again after npm install (new files created)
    console.log("[restart-dev-server] Fixing permissions after npm install...");
    await e2bManager.executeCommand(
      "chmod -R 777 /vibe0 2>/dev/null || true; mkdir -p /vibe0/.expo && chmod -R 777 /vibe0/.expo 2>/dev/null || true; touch /vibe0/expo_logs.txt; chmod 777 /vibe0/expo_logs.txt 2>/dev/null || true",
      { background: false }
    );

    // Use increased memory limit (4GB) to prevent heap out of memory errors
    // Run as user (matching the startup.sh pattern) and source env vars
    console.log("[restart-dev-server] Starting Expo dev server with increased memory...");
    await e2bManager.executeCommand(
      "sudo bash -c \"cd /vibe0 && . /vibe0/.expo_env 2>/dev/null || true && NODE_OPTIONS='--max-old-space-size=4096' nohup su - user -c 'cd /vibe0 && . /vibe0/.expo_env 2>/dev/null || true && npm run dev' > /dev/null 2>&1 &\"",
      { background: true, cwd: "/vibe0" }
    );

    // Wait a bit for the server to start up
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(`[restart-dev-server] Dev server restarted successfully for session: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: "Dev server restarted successfully",
    });
  } catch (error) {
    console.error("[restart-dev-server] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to restart dev server",
      },
      { status: 500 }
    );
  }
}
