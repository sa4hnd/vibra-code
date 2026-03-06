import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    console.log('🗑️ Removing Supabase OAuth data for session:', sessionId);

    // Update session to remove Supabase OAuth data
    await convex.mutation(api.sessions.updateSupabaseOAuthData, {
      sessionId,
      supabaseOAuthData: null
    });

    console.log('✅ Supabase OAuth data removed successfully');

    return NextResponse.json({
      success: true,
      message: 'Supabase OAuth data removed successfully'
    });
  } catch (error) {
    console.error('❌ Error removing Supabase OAuth data:', error);
    return NextResponse.json(
      { error: 'Failed to remove Supabase OAuth data', details: error.message },
      { status: 500 }
    );
  }
}
