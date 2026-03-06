import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const PROVISION_HOST = process.env.PROVISION_HOST || 'https://api.convex.dev';

async function fetchDeploymentCredentials(
  provisionHost: string,
  projectDeployKey: string,
  deploymentType: 'prod' | 'dev',
) {
  const response = await fetch(`${provisionHost}/api/deployment/provision_and_authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Convex-Client': 'v0-clone-1.0.0',
      Authorization: `Bearer ${projectDeployKey}`,
    },
    body: JSON.stringify({
      // teamSlug and projectSlug are not needed since we're using a project deploy key as an auth token
      teamSlug: null,
      projectSlug: null,
      deploymentType,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch deployment credentials');
  }

  const json = (await response.json()) as {
    deploymentName: string;
    url: string;
    adminKey: string;
  };

  return json;
}

// Store processed codes to avoid duplicate processing
const processedCodes = new Map<string, any>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This will contain the sessionId
  const CLIENT_ID = process.env.CONVEX_OAUTH_CLIENT_ID;
  const CLIENT_SECRET = process.env.CONVEX_OAUTH_CLIENT_SECRET;

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing required environment variables (CONVEX_OAUTH_CLIENT_ID, CONVEX_OAUTH_CLIENT_SECRET)');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Check if we've already processed this code
  if (processedCodes.has(code)) {
    console.log('🔄 Code already processed, returning cached result');
    const cachedResult = processedCodes.get(code);
    
    // Determine if this is an Expo Go request
    const isExpoGo = request.headers.get('user-agent')?.includes('Expo') || 
                     request.headers.get('referer')?.includes('exp://');
    
    if (isExpoGo) {
      // Return HTML for Expo Go
      return new NextResponse(cachedResult.html, {
        headers: { 'Content-Type': 'text/html' },
      });
    } else {
      // Return JSON for web
      return NextResponse.json(cachedResult.data);
    }
  }

  try {
    // Get the current origin for the redirect_uri
    // In production, use NEXT_PUBLIC_APP_URL to avoid reverse proxy issues
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ''); // Remove trailing slash
    const origin = appUrl || request.nextUrl.origin;

    // Use the same redirect URI that was used in the OAuth URL
    // This should match what was sent from the OAuth API
    // For ngrok requests, we need to use the ngrok URL, not localhost
    let redirectUri: string;
    const host = request.headers.get('host');

    if (host?.includes('ngrok')) {
      redirectUri = `https://${host}/convex/callback`;
    } else if (appUrl && !origin.includes('localhost')) {
      // In production, always use the configured app URL
      redirectUri = `${appUrl}/convex/callback`;
    } else {
      redirectUri = `${origin}/convex/callback`;
    }

    console.log('🔍 Using redirect URI for token exchange:', redirectUri);

    // Exchange the code for a token - use the correct Convex token endpoint
    const tokenResponse = await fetch('https://api.convex.dev/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorData,
        code,
        redirectUri,
        clientId: CLIENT_ID
      });
      
      // Check if the code was already used
      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson.code === 'NoSuchCode') {
          console.log('🔄 Code already used, this is likely a duplicate request from Expo Go');
          
          // Try to get the project from the session since it was already processed
          let sessionProject = null;
          try {
            console.log('🔍 Checking session for existing project:', state || 'default');
            const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
            const session = await convex.query(api.sessions.getBySessionId, { sessionId: state || 'default' });
            console.log('📊 Session query result:', { 
              sessionExists: !!session,
              hasConvexProject: !!session?.convexProject,
              convexProject: session?.convexProject
            });
            sessionProject = session?.convexProject;
            
            // If no session exists, this might be the first request that succeeded
            if (!session) {
              console.log('⚠️ No session found - this might be the first successful request');
            }
          } catch (error) {
            console.log('⚠️ Could not retrieve project from session:', error);
          }
          
          // Return a success response with a message indicating the code was already processed
          const responseData = { 
            message: 'Code already processed',
            status: 'already_processed',
            ...(sessionProject && {
              deploymentName: sessionProject.deploymentName,
              deploymentUrl: sessionProject.deploymentUrl,
              adminKey: sessionProject.adminKey
            })
          };
          
          // Determine if this is an Expo Go request
          const isExpoGo = request.headers.get('user-agent')?.includes('Expo') || 
                           request.headers.get('referer')?.includes('exp://');
          
          if (isExpoGo) {
            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <title>Already Connected</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #0A0A0F;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    padding: 20px;
                  }
                  .container {
                    text-align: center;
                    max-width: 400px;
                  }
                  .success-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                  }
                  .title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 10px;
                  }
                  .message {
                    font-size: 16px;
                    color: #CCCCCC;
                    margin-bottom: 30px;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="success-icon">✅</div>
                  <div class="title">Already Connected!</div>
                  <div class="message">This Convex project was already connected. Returning to VibraCoder...</div>
                </div>
                <script>
                  // Store project data in localStorage for Expo Go
                  ${sessionProject ? `
                    localStorage.setItem('convexProject', JSON.stringify({
                      deploymentName: '${sessionProject.deploymentName}',
                      deploymentUrl: '${sessionProject.deploymentUrl}',
                      adminKey: '${sessionProject.adminKey}'
                    }));
                    console.log('Project data stored in localStorage');
                  ` : ''}
                  
                  setTimeout(() => {
                    try {
                      window.location.href = 'exp://localhost:8081';
                    } catch (e) {
                      window.location.href = 'vibracoder://convex/callback';
                    }
                  }, 2000);
                </script>
              </body>
              </html>
            `;
            
            return new NextResponse(html, {
              headers: { 'Content-Type': 'text/html' },
            });
          }
          
          return NextResponse.json(responseData);
        }
      } catch (parseError) {
        // If we can't parse the error, continue with the original error handling
      }
      
      return NextResponse.json({ error: 'Failed to exchange code for token' }, { status: 500 });
    }

    console.log('✅ Token exchange successful!');
    const tokenResponseJson = await tokenResponse.json();
    console.log('📊 Token response:', { 
      hasAccessToken: !!tokenResponseJson.access_token,
      tokenType: tokenResponseJson.token_type,
      code
    });
    const tokenData = tokenResponseJson as { access_token: string; token_type: 'bearer' };
    const token = tokenData.access_token;

    // Always create a new prod deployment for each session
    console.log('🆕 Creating new prod deployment for this session...');
    const { deploymentName, url: deploymentUrl, adminKey } = await fetchDeploymentCredentials(
      PROVISION_HOST, 
      token, 
      'prod'
    );

    // Log the credentials as requested
    console.log('🔑 New Convex Project Created for Session:');
    console.log('CONVEX_DEPLOY_KEY=', token);
    console.log('CONVEX_DEPLOYMENT=', deploymentName);
    console.log('EXPO_PUBLIC_CONVEX_URL=', deploymentUrl);
    console.log('Admin Key:', adminKey);

    // Store the OAuth credentials for future automatic project creation
    // This allows subsequent sessions to create projects without OAuth
    console.log('💾 Storing OAuth credentials for future automatic project creation');
    
    // Extract team and project info from the token (same as chef)
    // The token format is: "project:teamSlug:projectSlug|..."
    const tokenParts = token.split('|')[0].split(':');
    const teamSlug = tokenParts[1];
    const projectSlug = tokenParts[2];
    
    // Store credentials in database (we'll need to get userId from session)
    // For now, we'll store it in a way that can be retrieved later
    console.log('🔑 Storing credentials:', { teamSlug, projectSlug });

    // Update the session with Convex project information
    try {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      console.log('🔍 Storing project in session:', state, {
        deploymentName,
        deploymentUrl,
        adminKey
      });
      
      // First, check if session exists, if not create it
      console.log('🔍 Checking if session exists:', state || 'default');
      const existingSession = await convex.query(api.sessions.getBySessionId, { 
        sessionId: state || 'default' 
      });
      console.log('📊 Session check result:', { 
        exists: !!existingSession,
        hasConvexProject: !!existingSession?.convexProject
      });
      
      if (!existingSession) {
        console.log('🔍 Session does not exist, creating new session...');
        try {
          await convex.mutation(api.sessions.create, {
            sessionId: state || 'default',
            name: 'Convex Project Session',
            templateId: 'convex-project',
            status: 'RUNNING',
          });
          console.log('✅ Session created successfully');
        } catch (createError) {
          console.error('❌ Failed to create session:', createError);
          throw createError;
        }
      } else {
        console.log('✅ Session already exists');
      }
      
      // Now update the session with Convex project information
      console.log('🔍 Storing Convex project in session...');
      try {
        await convex.mutation(api.sessions.updateConvexProject, {
          sessionId: state || 'default',
          convexProject: {
            deploymentName,
            deploymentUrl,
            adminKey,
          },
        });
        console.log('✅ Convex project stored in session successfully:', state);
      } catch (updateError) {
        console.error('❌ Failed to store Convex project in session:', updateError);
        throw updateError;
      }
    } catch (error) {
      console.error('❌ Failed to store Convex project in session:', error);
      // Continue anyway - the project was created successfully
    }

    // Return the token and deployment info
    const responseData = { 
      token, 
      deploymentName, 
      deploymentUrl,
      adminKey,
      teamSlug,
      projectSlug
    };

    // Cache the result to avoid duplicate processing
    const cacheResult = {
      data: responseData,
      html: null as string | null
    };

    // Determine if this is an Expo Go request
    const isExpoGo = request.headers.get('user-agent')?.includes('Expo') || 
                     request.headers.get('referer')?.includes('exp://');
    
    // For Expo Go, return HTML that redirects back to the app
    if (isExpoGo) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Convex Connected</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #0A0A0F;
              color: white;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .container {
              text-align: center;
              max-width: 400px;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .message {
              font-size: 16px;
              color: #CCCCCC;
              margin-bottom: 30px;
            }
            .loading {
              font-size: 14px;
              color: #888;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <div class="title">Convex Connected!</div>
            <div class="message">Redirecting back to VibraCoder...</div>
            <div class="loading">Please wait...</div>
          </div>
          <script>
            // Store credentials in localStorage for the app to retrieve
            localStorage.setItem('convex_credentials', JSON.stringify(${JSON.stringify(responseData)}));
            
            // For WebBrowser.openAuthSessionAsync, we need to redirect to the exact redirectUrl
            // that was passed to the openAuthSessionAsync call
            setTimeout(() => {
              // Try multiple redirect methods
              try {
                // Method 1: Direct redirect
                window.location.href = 'exp://localhost:8081';
              } catch (e) {
                // Method 2: Try with window.open
                window.open('exp://localhost:8081', '_self');
              }
            }, 500);
          </script>
        </body>
        </html>
      `;
      
      // Cache the HTML result
      cacheResult.html = html;
      processedCodes.set(code, cacheResult);
      
      // Determine if this is an Expo Go request
      const isExpoGo = request.headers.get('user-agent')?.includes('Expo') || 
                       request.headers.get('referer')?.includes('exp://');
      
      if (isExpoGo) {
        // Return HTML for Expo Go
        return new NextResponse(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      } else {
        // Return JSON for web
        return NextResponse.json(responseData);
      }
    }

    // Cache the JSON result
    processedCodes.set(code, cacheResult);

    // For direct API calls (from Expo Go), return JSON
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in Convex OAuth callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle POST requests (might be from WebBrowser)
export async function POST(request: NextRequest) {
  console.log('📨 POST request to callback - ignoring');
  // Just return success for POST requests
  return NextResponse.json({ message: 'POST not supported, use GET' }, { status: 200 });
}
