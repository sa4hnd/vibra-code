import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const { clerkId, name, text, storageId, url, sessionId } = await req.json();

    if (!clerkId || !name || !storageId || !url) {
      return NextResponse.json(
        { error: 'clerkId, name, storageId, and url are required' },
        { status: 400 }
      );
    }

    const audioId = await convex.mutation(api.audios.create, {
      clerkId,
      name,
      text,
      storageId: storageId as Id<"_storage">,
      url,
      sessionId,
    });

    return NextResponse.json({ audioId, success: true });
  } catch (error) {
    console.error('Failed to create audio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
