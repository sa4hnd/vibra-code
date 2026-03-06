import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { E2BManager } from '@/lib/e2b/config';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, clerkId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Missing clerkId - authentication required' },
        { status: 401 }
      );
    }

    // Get session data by sessionId string
    // SECURITY: Pass createdBy for ownership verification
    const session = await fetchQuery(api.sessions.getBySessionId, {
      sessionId,
      createdBy: clerkId
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    console.log('🔄 Resuming session:', sessionId);

    // Create E2B manager and connect to existing sandbox
    // This will automatically resume the sandbox if it's paused
    // If it's already active, it will just connect normally
    const e2bManager = new E2BManager();
    await e2bManager.connectToSandbox(sessionId);

    console.log('✅ Session connected/resumed successfully:', sessionId);

    return NextResponse.json({ 
      success: true, 
      message: 'Session resumed successfully',
      sessionId 
    });

  } catch (error) {
    console.error('Error resuming session:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to resume session' 
      },
      { status: 500 }
    );
  }
}
