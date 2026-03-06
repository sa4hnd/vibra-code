import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { clerkId, name, prompt, sessionId } = await req.json();

    if (!clerkId || !name || !prompt) {
      return NextResponse.json(
        { error: 'clerkId, name, and prompt are required' },
        { status: 400 }
      );
    }

    const videoId = await convex.mutation(api.videos.startGeneration, {
      clerkId,
      name,
      prompt,
      sessionId,
    });

    return NextResponse.json({ videoId, success: true });
  } catch (error) {
    console.error('Failed to start video generation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
