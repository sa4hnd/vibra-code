import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, project } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    if (!project) {
      return NextResponse.json({ error: 'Project data is required' }, { status: 400 });
    }

    console.log('🔍 Creating Supabase project for session:', sessionId);
    console.log('📊 Project data:', project);

    // Initialize Convex client
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    // Update session with Supabase project information
    const result = await convex.mutation(api.sessions.updateSupabaseProject, {
      sessionId,
      supabaseProject: {
        projectId: project.projectId,
        projectUrl: project.projectUrl,
        apiKey: project.apiKey,
        organizationId: project.organizationId,
        projectName: project.projectName,
        region: project.region,
      },
    });

    console.log('✅ Supabase project created successfully:', result);

    return NextResponse.json({ 
      success: true, 
      message: 'Supabase project created successfully',
      project: {
        projectId: project.projectId,
        projectUrl: project.projectUrl,
        apiKey: project.apiKey,
        organizationId: project.organizationId,
        projectName: project.projectName,
        region: project.region,
      }
    });

  } catch (error) {
    console.error('❌ Error creating Supabase project:', error);
    return NextResponse.json(
      { error: 'Failed to create Supabase project' },
      { status: 500 }
    );
  }
}
