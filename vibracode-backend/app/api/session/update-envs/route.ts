import { NextRequest, NextResponse } from 'next/server';
import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, envs } = await request.json();

    if (!sessionId || !envs) {
      return NextResponse.json(
        { error: 'Missing sessionId or envs' },
        { status: 400 }
      );
    }

    // Update the session with all environment variables
    await fetchMutation(api.sessions.updateEnvs, {
      sessionId,
      envs,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating environment variables:', error);
    return NextResponse.json(
      { error: 'Failed to update environment variables' },
      { status: 500 }
    );
  }
}




