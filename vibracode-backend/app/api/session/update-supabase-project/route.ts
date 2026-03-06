import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { sessionId, supabaseProject } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    console.log('💾 Updating Supabase project for session:', sessionId, supabaseProject ? 'setting project' : 'clearing project');

    // Update the session with Supabase project information
    await convex.mutation(api.sessions.updateSupabaseProject, {
      sessionId,
      supabaseProject,
    });

    console.log('✅ Supabase project updated successfully', supabaseProject ? 'project set' : 'project cleared');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating Supabase project:', error);
    return NextResponse.json(
      { error: 'Failed to update Supabase project', details: error.message },
      { status: 500 }
    );
  }
}
