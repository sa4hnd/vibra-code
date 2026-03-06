import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clerkId = searchParams.get('clerkId');

    if (!clerkId) {
      return NextResponse.json(
        { error: 'clerkId is required' },
        { status: 400 }
      );
    }

    const audios = await convex.query(api.audios.getByUser, { clerkId });

    return NextResponse.json({ audios, success: true });
  } catch (error) {
    console.error('Failed to list audios:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
