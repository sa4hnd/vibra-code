import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Get session data by sessionId string
    const session = await fetchQuery(api.sessions.getBySessionId, { 
      sessionId 
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      envs: session.envs || {},
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error('Error getting environment variables:', error);
    return NextResponse.json(
      { error: 'Failed to get environment variables' },
      { status: 500 }
    );
  }
}




