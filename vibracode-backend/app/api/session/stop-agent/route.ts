import { Sandbox } from "@e2b/code-interpreter";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { NextResponse } from "next/server";

/**
 * POST /api/session/stop-agent
 *
 * Terminates the running agent (Claude, Cursor, or Gemini) in an E2B sandbox.
 * This sends SIGINT to the agent processes (like Ctrl+C) while keeping the sandbox alive.
 * Also sets a flag in the session to prevent the Inngest function from resetting status.
 *
 * Body: { sessionId: string } - The E2B sandbox ID
 */
export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    console.log(`🛑 [stop-agent] Attempting to stop agent in sandbox: ${sessionId}`);

    // Find the session by sandbox ID FIRST and set the agentStopped flag
    // This prevents the running Inngest function from resetting the status
    // Use internal query (no ownership check needed for backend API)
    const session = await fetchQuery(api.sessions.getBySessionIdInternal, {
      sessionId: sessionId,
    });

    if (session) {
      // IMMEDIATELY set agentStopped flag and update status
      // This prevents any race condition with the Inngest function
      await fetchMutation(api.sessions.update, {
        id: session._id,
        status: "RUNNING",
        statusMessage: "Agent stopped by user",
        agentStopped: true,
      });

      console.log(`✅ [stop-agent] Session status updated to RUNNING with agentStopped=true`);
    } else {
      console.log(`⚠️ [stop-agent] Session not found in Convex for sandbox: ${sessionId}`);
    }

    // Now try to connect to sandbox and kill processes
    // This may fail if sandbox is unresponsive, but that's okay - the flag is already set
    try {
      const sandbox = await Sandbox.connect(sessionId, {
        timeoutMs: 10000 // Reduced timeout since we already set the flag
      });

      console.log(`✅ [stop-agent] Connected to sandbox: ${sessionId}`);

      // Kill all agent processes by sending SIGINT (graceful termination like Ctrl+C)
      // This covers: claude, cursor-agent, gemini
      // Using || true to prevent error if no matching process found
      const killResult = await sandbox.commands.run(
        'pkill -INT -f "claude|cursor-agent|gemini" 2>/dev/null || true',
        { timeoutMs: 5000 }
      );

      console.log(`🛑 [stop-agent] Kill command result:`, killResult);

      // Also try sending SIGTERM as a backup if SIGINT doesn't work immediately
      await sandbox.commands.run(
        'sleep 1 && pkill -TERM -f "claude|cursor-agent|gemini" 2>/dev/null || true',
        { timeoutMs: 5000, background: true }
      );
    } catch (sandboxError) {
      // Sandbox connection/command failed, but that's okay - the status flag is already set
      console.warn(`⚠️ [stop-agent] Sandbox operation failed (non-critical):`, sandboxError);
    }

    return NextResponse.json({
      success: true,
      message: "Agent stopped successfully",
    });
  } catch (error) {
    console.error("❌ [stop-agent] Error stopping agent:", error);

    // Return a more specific error message
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to stop agent",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
