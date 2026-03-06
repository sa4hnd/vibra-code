import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { auth } from "@clerk/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

interface StealAppRequest {
  sessionId: string;
  input: string;
  inputType: "name" | "appstore" | "playstore" | "website";
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request
    const body: StealAppRequest = await req.json();

    if (!body.sessionId || !body.input || !body.inputType) {
      return NextResponse.json(
        { error: "sessionId, input, and inputType are required" },
        { status: 400 }
      );
    }

    // 3. Validate session exists and belongs to user
    // Use internal query since we verify ownership manually below
    const session = await fetchQuery(api.sessions.getByIdInternal, {
      id: body.sessionId as Id<"sessions">,
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.createdBy !== userId) {
      return NextResponse.json(
        { error: "You do not have access to this session" },
        { status: 403 }
      );
    }

    // 4. Validate input based on type
    let input = body.input.trim();

    if (!input) {
      return NextResponse.json({ error: "Input cannot be empty" }, { status: 400 });
    }

    // Normalize URLs - add https:// if missing for URL types
    if (body.inputType !== "name" && !input.startsWith("http://") && !input.startsWith("https://")) {
      input = `https://${input}`;
    }

    if (body.inputType === "appstore") {
      if (!input.includes("apps.apple.com") && !input.includes("itunes.apple.com")) {
        return NextResponse.json(
          { error: "Invalid App Store URL. Must be from apps.apple.com" },
          { status: 400 }
        );
      }
    }

    if (body.inputType === "playstore") {
      if (!input.includes("play.google.com")) {
        return NextResponse.json(
          { error: "Invalid Play Store URL. Must be from play.google.com" },
          { status: 400 }
        );
      }
    }

    if (body.inputType === "website") {
      try {
        new URL(input);
      } catch {
        return NextResponse.json(
          { error: "Invalid website URL" },
          { status: 400 }
        );
      }
    }

    if (body.inputType === "name" && input.length < 2) {
      return NextResponse.json(
        { error: "App name must be at least 2 characters" },
        { status: 400 }
      );
    }

    // 5. Check if Firecrawl API key is configured
    if (!process.env.FIRECRAWL_API_KEY) {
      console.error("[steal-app] FIRECRAWL_API_KEY not configured");
      return NextResponse.json(
        { error: "App Stealer is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // 6. Trigger Inngest function
    await inngest.send({
      name: "vibracode/steal.app",
      data: {
        sessionId: body.sessionId as Id<"sessions">,
        input,
        inputType: body.inputType,
        userId,
      },
    });

    console.log(`[steal-app] Started for user ${userId}: ${input} (${body.inputType})`);

    return NextResponse.json({
      success: true,
      message: "App research started. Watch the chat for updates.",
    });
  } catch (error) {
    console.error("[steal-app] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
