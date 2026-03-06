import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SUPABASE_OAUTH_CLIENT_ID = process.env.SUPABASE_OAUTH_CLIENT_ID;
const SUPABASE_OAUTH_CLIENT_SECRET = process.env.SUPABASE_OAUTH_CLIENT_SECRET;

export async function POST(request: NextRequest) {
  try {
    const { sessionId, redirectUri } = await request.json();

    console.log('🔍 Supabase OAuth API called with:', { sessionId, redirectUri });
    console.log('🔍 SessionId type:', typeof sessionId);
    console.log('🔍 SessionId length:', sessionId?.length);

    if (!SUPABASE_OAUTH_CLIENT_ID || !SUPABASE_OAUTH_CLIENT_SECRET) {
      console.error('Missing required environment variables (SUPABASE_OAUTH_CLIENT_ID, SUPABASE_OAUTH_CLIENT_SECRET)');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get the current origin for the redirect_uri
    const origin = request.nextUrl.origin;
    console.log('🔍 Request origin:', origin);
    
    // Determine the appropriate redirect URI based on environment
    let redirectUriParam;
    if (redirectUri) {
      // Use provided redirect URI (for mobile apps)
      redirectUriParam = redirectUri;
      console.log('🔍 Using provided redirect URI:', redirectUriParam);
    } else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      // Development environment
      redirectUriParam = `${origin}/supabase/callback`;
      console.log('🔍 Using localhost redirect URI:', redirectUriParam);
    } else {
      // Production environment
      redirectUriParam = `${origin}/supabase/callback`;
      console.log('🔍 Using production redirect URI:', redirectUriParam);
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Generate OAuth URL with PKCE
    const authUrl = new URL('https://api.supabase.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', SUPABASE_OAUTH_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUriParam);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    // Request necessary scopes for project management
    authUrl.searchParams.set('scope', 'projects:read projects:write secrets:read organizations:read');
    // Use sessionId directly as state (like Convex does)
    authUrl.searchParams.set('state', sessionId);
    
    // Store codeVerifier temporarily for PKCE verification
    // We'll store it in a simple in-memory cache with sessionId as key
    global.supabaseCodeVerifiers = global.supabaseCodeVerifiers || new Map();
    global.supabaseCodeVerifiers.set(sessionId, codeVerifier);

    const finalAuthUrl = authUrl.toString();
    console.log('🔍 Final Supabase OAuth URL:', finalAuthUrl);
    console.log('🔍 Client ID:', SUPABASE_OAUTH_CLIENT_ID);
    console.log('🔍 Redirect URI in URL:', redirectUriParam);

    return NextResponse.json({ 
      authUrl: finalAuthUrl,
      redirectUri: redirectUriParam,
      codeVerifier, // Return for client to store temporarily
    });
  } catch (error) {
    console.error('Error generating Supabase OAuth URL:', error);
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 });
  }
}
