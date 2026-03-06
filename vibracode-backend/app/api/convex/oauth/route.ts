import { NextRequest, NextResponse } from 'next/server';

const CONVEX_OAUTH_CLIENT_ID = process.env.CONVEX_OAUTH_CLIENT_ID;
const CONVEX_OAUTH_CLIENT_SECRET = process.env.CONVEX_OAUTH_CLIENT_SECRET;

export async function POST(request: NextRequest) {
  try {
    const { sessionId, redirectUri } = await request.json();

    console.log('🔍 OAuth API called with:', { sessionId, redirectUri });

    if (!CONVEX_OAUTH_CLIENT_ID || !CONVEX_OAUTH_CLIENT_SECRET) {
      console.error('Missing required environment variables (CONVEX_OAUTH_CLIENT_ID, CONVEX_OAUTH_CLIENT_SECRET)');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get the current origin for the redirect_uri
    const origin = request.nextUrl.origin;
    console.log('🔍 Request origin:', origin);
    
    // Determine the appropriate redirect URI based on environment
    let redirectUriParam;
    if (redirectUri) {
      // Use provided redirect URI (for Expo Go)
      redirectUriParam = redirectUri;
      console.log('🔍 Using provided redirect URI:', redirectUriParam);
    } else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      // Development environment
      redirectUriParam = `${origin}/convex/callback`;
      console.log('🔍 Using localhost redirect URI:', redirectUriParam);
    } else {
      // Production environment
      redirectUriParam = `${origin}/convex/callback`;
      console.log('🔍 Using production redirect URI:', redirectUriParam);
    }

    // Generate OAuth URL - use project-scoped OAuth (same as web version)
    const authUrl = new URL('https://dashboard.convex.dev/oauth/authorize/project');
    authUrl.searchParams.set('client_id', CONVEX_OAUTH_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUriParam);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'projects:read projects:write deployments:manage');
    authUrl.searchParams.set('state', sessionId || 'default'); // Use sessionId as state

    const finalAuthUrl = authUrl.toString();
    console.log('🔍 Final OAuth URL:', finalAuthUrl);
    console.log('🔍 Client ID:', CONVEX_OAUTH_CLIENT_ID);
    console.log('🔍 Redirect URI in URL:', redirectUriParam);

    return NextResponse.json({ 
      authUrl: finalAuthUrl,
      redirectUri: redirectUriParam
    });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 });
  }
}
