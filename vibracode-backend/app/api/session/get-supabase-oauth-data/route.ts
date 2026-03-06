import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

    console.log('🔍 Getting Supabase OAuth data for session:', sessionId);

    // Get session data from Convex
    const session = await convex.query(api.sessions.getBySessionId, { sessionId });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    console.log('📊 Session found, Supabase OAuth data present:', !!session.supabaseOAuthData);

    return NextResponse.json({
      supabaseOAuthData: session.supabaseOAuthData || null,
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error('❌ Error getting Supabase OAuth data:', error);
    return NextResponse.json(
      { error: 'Failed to get Supabase OAuth data', details: error.message },
      { status: 500 }
    );
  }
}
