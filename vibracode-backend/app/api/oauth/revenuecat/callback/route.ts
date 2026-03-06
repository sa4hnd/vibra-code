import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const REVENUECAT_CLIENT_ID = process.env.REVENUECAT_OAUTH_CLIENT_ID;
const REVENUECAT_CLIENT_SECRET = process.env.REVENUECAT_OAUTH_CLIENT_SECRET;
const REVENUECAT_OAUTH_REDIRECT_URI = process.env.REVENUECAT_OAUTH_REDIRECT_URI || 'https://vibracodeapp.com/api/oauth/revenuecat/callback';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/oauth/revenuecat/callback
 * Handle RevenueCat OAuth callback - exchange code for tokens and store credentials
 *
 * NOTE: Using both client_secret AND code_verifier (PKCE) for confidential client with PKCE
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  console.log('🔐 RevenueCat OAuth callback received:', {
    hasCode: !!code,
    hasState: !!state,
    error,
    errorDescription,
  });

  if (!REVENUECAT_CLIENT_ID || !REVENUECAT_CLIENT_SECRET) {
    return renderErrorPage('not_configured', 'RevenueCat OAuth not configured');
  }

  // Handle OAuth errors
  if (error) {
    console.error('RevenueCat OAuth error:', error, errorDescription);
    return renderErrorPage(error, errorDescription || 'OAuth authorization failed');
  }

  if (!code || !state) {
    return renderErrorPage('missing_params', 'Missing authorization code or state');
  }

  if (!REVENUECAT_CLIENT_ID) {
    console.error('Missing REVENUECAT_OAUTH_CLIENT_ID environment variable');
    return renderErrorPage('server_error', 'Server configuration error');
  }

  // Parse state to get clerkId
  let stateData: { clerkId: string; nonce: string };
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch (e) {
    console.error('Failed to parse state:', e);
    return renderErrorPage('invalid_state', 'Invalid OAuth state');
  }

  const { clerkId } = stateData;

  if (!clerkId) {
    return renderErrorPage('invalid_state', 'Missing user identifier in state');
  }

  // Get code verifier from in-memory storage
  const codeVerifier = global.revenuecatCodeVerifiers?.get(state);
  if (!codeVerifier) {
    console.error('No code verifier found for state:', state.substring(0, 20) + '...');
    return renderErrorPage('invalid_state', 'OAuth session expired. Please try again.');
  }

  try {
    // Exchange authorization code for tokens
    // Try with both client_secret and code_verifier (confidential client with PKCE)
    console.log('🔐 Exchanging code for tokens...');

    // Build token request params
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REVENUECAT_OAUTH_REDIRECT_URI,
      code_verifier: codeVerifier,
    };

    // Build headers - try HTTP Basic Auth (client_secret_basic) if we have a secret
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (REVENUECAT_CLIENT_SECRET) {
      // Use HTTP Basic Auth: Authorization: Basic base64(client_id:client_secret)
      const basicAuth = Buffer.from(`${REVENUECAT_CLIENT_ID}:${REVENUECAT_CLIENT_SECRET}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
      console.log('🔐 Using HTTP Basic Auth (client_secret_basic)');
    } else {
      // Public client - include client_id in body
      tokenParams.client_id = REVENUECAT_CLIENT_ID;
      console.log('🔐 Using public client (no secret)');
    }

    console.log('🔐 Token request params:', {
      ...tokenParams,
      code: '[REDACTED]',
      code_verifier: '[REDACTED]',
    });

    const tokenResponse = await fetch('https://api.revenuecat.com/oauth2/token', {
      method: 'POST',
      headers,
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        error: errorText,
      });
      return renderErrorPage('token_error', 'Failed to exchange authorization code');
    }

    const tokenData = await tokenResponse.json();
    console.log('🔐 Token exchange successful:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
    });
    console.log('🔐 FULL SCOPE RECEIVED:', tokenData.scope);

    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Calculate expiration time (expires_in is in seconds)
    const expiresAt = Date.now() + (expires_in * 1000);

    // Store credentials in Convex
    console.log('🔐 Storing RevenueCat credentials for user:', clerkId);
    console.log('🔐 Scope being stored:', scope);

    await convex.mutation(api.revenuecat.upsert, {
      clerkId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
      scope: scope || '',
    });

    console.log('✅ RevenueCat OAuth complete for user:', clerkId, 'with scope:', scope);

    // Clean up code verifier
    global.revenuecatCodeVerifiers?.delete(state);

    // Return success page that redirects to the app
    return renderSuccessPage();
  } catch (error) {
    console.error('RevenueCat OAuth callback error:', error);
    return renderErrorPage('server_error', 'An unexpected error occurred');
  }
}

/**
 * Render success page with redirect back to app
 */
function renderSuccessPage() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>RevenueCat Connected</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0A0A0F 0%, #1a1a2e 100%);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          text-align: center;
          max-width: 400px;
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .success-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          box-shadow: 0 8px 32px rgba(74, 222, 128, 0.3);
        }
        .success-icon svg {
          width: 40px;
          height: 40px;
          color: white;
        }
        .title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #fff 0%, #a0a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .message {
          font-size: 16px;
          color: #9ca3af;
          margin-bottom: 32px;
          line-height: 1.5;
        }
        .brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 24px;
        }
        .brand img {
          width: 32px;
          height: 32px;
          border-radius: 8px;
        }
        .brand span {
          font-size: 14px;
          color: #6b7280;
        }
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          color: #6b7280;
        }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #374151;
          border-top-color: #4ade80;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .close-btn {
          margin-top: 24px;
          padding: 12px 32px;
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          color: white;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 16px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .close-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 32px rgba(74, 222, 128, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">
          <span>RevenueCat + Vibra Code</span>
        </div>
        <div class="success-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div class="title">RevenueCat Connected!</div>
        <div class="message">
          Your RevenueCat account is now connected. The AI can now help you manage your in-app purchases and subscriptions.
        </div>
        <div class="loading">
          <div class="spinner"></div>
          <span>Returning to Vibra Code...</span>
        </div>
        <button class="close-btn" onclick="closeWindow()">Close Window</button>
      </div>
      <script>
        function closeWindow() {
          // Try to close the window/tab
          window.close();
          // If that doesn't work, redirect to the app
          setTimeout(() => {
            window.location.href = 'vibracodeapp://revenuecat/success';
          }, 500);
        }

        // Auto-close after 3 seconds
        setTimeout(() => {
          closeWindow();
        }, 3000);
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * Render error page
 */
function renderErrorPage(errorCode: string, errorMessage: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connection Failed</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0A0A0F 0%, #1a1a2e 100%);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          text-align: center;
          max-width: 400px;
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .error-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          box-shadow: 0 8px 32px rgba(248, 113, 113, 0.3);
        }
        .error-icon svg {
          width: 40px;
          height: 40px;
          color: white;
        }
        .title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #fff 0%, #a0a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .message {
          font-size: 16px;
          color: #9ca3af;
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .error-code {
          font-size: 12px;
          color: #6b7280;
          font-family: monospace;
          background: rgba(255, 255, 255, 0.05);
          padding: 8px 16px;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        .close-btn {
          padding: 12px 32px;
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="title">Connection Failed</div>
        <div class="message">${errorMessage}</div>
        <div class="error-code">Error: ${errorCode}</div>
        <button class="close-btn" onclick="window.close()">Close Window</button>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
    status: 400,
  });
}
