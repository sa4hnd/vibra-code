import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

const REVENUECAT_CLIENT_ID = process.env.REVENUECAT_OAUTH_CLIENT_ID;
const REVENUECAT_OAUTH_REDIRECT_URI = process.env.REVENUECAT_OAUTH_REDIRECT_URI || 'https://vibracodeapp.com/api/oauth/revenuecat/callback';

// RevenueCat OAuth scopes for MCP integration (full read+write access)
const REVENUECAT_SCOPES = [
  'project_configuration:projects:read_write',
  'project_configuration:apps:read_write',
  'project_configuration:entitlements:read_write',
  'project_configuration:offerings:read_write',
  'project_configuration:packages:read_write',
  'project_configuration:products:read_write',
].join(' ');

// In-memory storage for PKCE code verifiers (keyed by state)
declare global {
  // eslint-disable-next-line no-var
  var revenuecatCodeVerifiers: Map<string, string> | undefined;
}

/**
 * POST /api/oauth/revenuecat
 * Initiate RevenueCat OAuth flow with PKCE
 *
 * Body: { clerkId: string, redirectUri?: string }
 * Response: { authUrl: string, state: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!REVENUECAT_CLIENT_ID) {
      console.warn('RevenueCat OAuth not configured - missing REVENUECAT_OAUTH_CLIENT_ID');
      return NextResponse.json({ error: 'RevenueCat OAuth not configured' }, { status: 503 });
    }

    const { clerkId, redirectUri } = await request.json();

    console.log('🔐 RevenueCat OAuth initiation:', { clerkId, redirectUri });

    if (!clerkId) {
      return NextResponse.json({ error: 'Missing clerkId' }, { status: 400 });
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Generate state that includes clerkId for the callback
    const stateData = {
      clerkId,
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Store code verifier for later use in callback
    global.revenuecatCodeVerifiers = global.revenuecatCodeVerifiers || new Map();
    global.revenuecatCodeVerifiers.set(state, codeVerifier);

    // Use provided redirect URI or default
    const finalRedirectUri = redirectUri || REVENUECAT_OAUTH_REDIRECT_URI;

    // Build RevenueCat OAuth authorization URL
    const authUrl = new URL('https://api.revenuecat.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', REVENUECAT_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', finalRedirectUri);
    authUrl.searchParams.set('scope', REVENUECAT_SCOPES);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('🔐 RevenueCat OAuth URL generated:', {
      authUrl: authUrl.toString(),
      redirectUri: finalRedirectUri,
      state: state.substring(0, 20) + '...',
    });

    return NextResponse.json({
      authUrl: authUrl.toString(),
      state,
      redirectUri: finalRedirectUri,
    });
  } catch (error) {
    console.error('Error generating RevenueCat OAuth URL:', error);
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 });
  }
}

/**
 * GET /api/oauth/revenuecat
 * Check RevenueCat connection status for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clerkId = searchParams.get('clerkId');

  if (!clerkId) {
    return NextResponse.json({ error: 'Missing clerkId parameter' }, { status: 400 });
  }

  try {
    const { ConvexHttpClient } = await import('convex/browser');
    const { api } = await import('@/convex/_generated/api');

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const credentials = await convex.query(api.revenuecat.getByClerkId, { clerkId });

    if (!credentials) {
      return NextResponse.json({ connected: false });
    }

    // Check if token is expired
    const isExpired = credentials.expiresAt < Date.now();

    return NextResponse.json({
      connected: true,
      isExpired,
      scope: credentials.scope,
      connectedAt: credentials.connectedAt,
    });
  } catch (error) {
    console.error('Error checking RevenueCat connection:', error);
    return NextResponse.json({ error: 'Failed to check connection status' }, { status: 500 });
  }
}
