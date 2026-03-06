import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔍 API key request body:', body);
    
    const { projectId, accessToken } = body;

    if (!projectId || !accessToken) {
      console.error('❌ Missing required fields:', { projectId: !!projectId, accessToken: !!accessToken });
      return NextResponse.json(
        { error: 'Missing projectId or accessToken', received: { projectId: !!projectId, accessToken: !!accessToken } },
        { status: 400 }
      );
    }

    console.log('🔑 Fetching API key for project:', projectId);

    // Fetch API keys from Supabase Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const keys = await response.json();
      console.log('📊 API Keys found:', keys.length);
      
      // Find the anon/public key
      const anonKey = keys.find((key: any) => key.name === 'anon' || key.name === 'public');
      const apiKey = anonKey?.api_key || keys[0]?.api_key || '';
      
      console.log('✅ API key retrieved successfully');
      
      return NextResponse.json({ apiKey });
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to fetch API keys:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        projectId
      });
      
      return NextResponse.json(
        { error: 'Failed to fetch API keys', details: errorText },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('❌ Error in fetch-api-key API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
