import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
      console.log('🔍 Store Supabase credentials request body:', body);
    } catch (jsonError) {
      console.error('❌ Error parsing JSON:', jsonError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: jsonError.message },
        { status: 400 }
      );
    }
    
    const { sessionId, accessToken, refreshToken, organizations, projects, expiresAt } = body;

    if (!sessionId || !accessToken || !refreshToken) {
      console.error('❌ Missing required fields:', { sessionId: !!sessionId, accessToken: !!accessToken, refreshToken: !!refreshToken });
      return NextResponse.json(
        { error: 'Missing required fields', received: { sessionId: !!sessionId, accessToken: !!accessToken, refreshToken: !!refreshToken } },
        { status: 400 }
      );
    }

    console.log('💾 Storing Supabase credentials for session:', sessionId);

    // Store Supabase OAuth data in the session
    await convex.mutation(api.sessions.updateSupabaseOAuthData, {
      sessionId,
      supabaseOAuthData: {
        accessToken,
        refreshToken,
        organizations: organizations || [],
        projects: projects || [],
        expiresAt: expiresAt || (Date.now() + (24 * 60 * 60 * 1000)), // 24 hours from now
      }
    });

    console.log('✅ Supabase OAuth data stored successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error storing Supabase credentials:', error);
    return NextResponse.json(
      { error: 'Failed to store Supabase credentials', details: error.message },
      { status: 500 }
    );
  }
}
