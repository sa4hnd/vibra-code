import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Valid session name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Session name must be 100 characters or less' },
        { status: 400 }
      );
    }

    const sessionId = params.id as Id<'sessions'>;

    // Update session name in Convex
    await convex.mutation(api.sessions.updateName, {
      id: sessionId,
      name: name.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating session name:', error);
    return NextResponse.json(
      { error: 'Failed to update session name' },
      { status: 500 }
    );
  }
}
