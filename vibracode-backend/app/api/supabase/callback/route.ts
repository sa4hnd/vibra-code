import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Store processed codes to avoid duplicate processing
const processedCodes = new Map<string, any>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This will contain sessionId and codeVerifier
  const CLIENT_ID = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const CLIENT_SECRET = process.env.SUPABASE_OAUTH_CLIENT_SECRET;

  // Use sessionId directly from state (like Convex does)
  const sessionId = state || 'default';
  
  console.log('🔍 Callback received state:', state);
  console.log('🔍 Using sessionId:', sessionId);
  console.log('🔍 SessionId type:', typeof sessionId);
  console.log('🔍 SessionId length:', sessionId?.length);
  
  // Get codeVerifier from the temporary cache
  const codeVerifier = global.supabaseCodeVerifiers?.get(sessionId) || '';
  
  if (!codeVerifier) {
    console.error('❌ No codeVerifier found for session:', sessionId);
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing required environment variables (SUPABASE_OAUTH_CLIENT_ID, SUPABASE_OAUTH_CLIENT_SECRET)');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Check if we've already processed this code
  if (processedCodes.has(code)) {
    console.log('🔄 Code already processed, returning cached result');
    const cachedResult = processedCodes.get(code);
    
    // Determine if this is a mobile app request
    const isMobile = request.headers.get('user-agent')?.includes('Expo') || 
                     request.headers.get('referer')?.includes('exp://');
    
    if (isMobile) {
      // Return HTML for mobile apps
      return new NextResponse(cachedResult.html, {
        headers: { 'Content-Type': 'text/html' },
      });
    } else {
      // Return JSON for web
      return NextResponse.json(cachedResult.data);
    }
  }

  // Check if this is a duplicate request from the same session
  const requestId = `${code}-${state}`;
  if (processedCodes.has(requestId)) {
    console.log('🔄 Duplicate request detected, returning cached result');
    const cachedResult = processedCodes.get(requestId);
    return NextResponse.json(cachedResult.data);
  }

  try {
    // Get the current origin for the redirect_uri
    const origin = request.nextUrl.origin;

    // Use the same redirect URI that was used in the OAuth URL
    const redirectUri = request.headers.get('host')?.includes('ngrok') 
      ? `https://${request.headers.get('host')}/supabase/callback`
      : origin + '/supabase/callback';
    
    console.log('🔍 Using redirect URI for token exchange:', redirectUri);

    // Exchange the code for a token
    const tokenResponse = await fetch('https://api.supabase.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier || '', // PKCE code verifier
      }),
    });

    console.log('🔍 Token exchange request details:', {
      url: 'https://api.supabase.com/v1/oauth/token',
      method: 'POST',
      clientId: CLIENT_ID,
      code: code.substring(0, 8) + '...',
      redirectUri,
      sessionId,
      hasCodeVerifier: !!codeVerifier,
      codeVerifierLength: codeVerifier.length
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
        if (errorJson.error === 'invalid_grant') {
          console.log('🔄 Code already used, this is likely a duplicate request');
          
          // Try to get the project from the session since it was already processed
          let sessionProject = null;
          try {
            console.log('🔍 Checking session for existing Supabase project:', state || 'default');
            const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
            const session = await convex.query(api.sessions.getBySessionId, { sessionId: state || 'default' });
            console.log('📊 Session query result:', { 
              sessionExists: !!session,
              hasSupabaseProject: !!session?.supabaseProject,
              supabaseProject: session?.supabaseProject
            });
            sessionProject = session?.supabaseProject;
          } catch (error) {
            console.log('⚠️ Could not retrieve project from session:', error);
          }
          
          // Return a success response with a message indicating the code was already processed
          const responseData = { 
            message: 'Code already processed',
            status: 'already_processed',
            ...(sessionProject && {
              projectId: sessionProject.projectId,
              projectUrl: sessionProject.projectUrl,
              apiKey: sessionProject.apiKey,
              organizationId: sessionProject.organizationId
            })
          };
          
          // Determine if this is a mobile app request
          const isMobile = request.headers.get('user-agent')?.includes('Expo') || 
                           request.headers.get('referer')?.includes('exp://');
          
          if (isMobile) {
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
                  <div class="message">This Supabase project was already connected. Returning to VibraCoder...</div>
                </div>
                <script>
                  // Store project data in localStorage for mobile apps
                  ${sessionProject ? `
                    localStorage.setItem('supabaseProject', JSON.stringify({
                      projectId: '${sessionProject.projectId}',
                      projectUrl: '${sessionProject.projectUrl}',
                      apiKey: '${sessionProject.apiKey}',
                      organizationId: '${sessionProject.organizationId}'
                    }));
                    console.log('Project data stored in localStorage');
                  ` : ''}
                  
                  setTimeout(() => {
                    try {
                      window.location.href = 'exp://localhost:8081';
                    } catch (e) {
                      window.location.href = 'vibracoder://supabase/callback';
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
    const tokenData = tokenResponseJson as { 
      access_token: string; 
      refresh_token: string;
      token_type: 'bearer';
      expires_in: number;
    };
    const accessToken = tokenData.access_token;

    // Get user's organizations and projects
    console.log('🔍 Fetching user organizations and projects...');
    const orgsResponse = await fetch('https://api.supabase.com/v1/organizations', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orgsResponse.ok) {
      throw new Error('Failed to fetch organizations');
    }

    const organizations = await orgsResponse.json();
    console.log('📊 Organizations:', organizations);

    // Get projects from the first organization
    let projects = [];
    if (organizations.length > 0) {
      const orgId = organizations[0].id;
      console.log('🔍 Fetching projects for organization:', orgId);
      
      const projectsResponse = await fetch(`https://api.supabase.com/v1/projects`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (projectsResponse.ok) {
        projects = await projectsResponse.json();
        console.log('📊 Found projects:', projects.length);
        console.log('📊 Projects:', projects.map(p => ({ id: p.id, name: p.name, status: p.status })));
      } else {
        const errorText = await projectsResponse.text();
        console.error('❌ Failed to fetch projects:', projectsResponse.status, errorText);
      }
    }

    // Don't auto-select a project - let user choose in the frontend
    let selectedProject = null;
    if (projects.length > 0) {
      console.log('📊 Found projects for user selection:', projects.length);
      console.log('📊 Projects:', projects.map(p => ({ id: p.id, name: p.name, status: p.status })));
      // Don't select any project - let user choose
    } else {
      // Create a new project only if no existing projects
      console.log('🆕 No existing projects found, creating new Supabase project...');
      
      try {
        const createProjectResponse = await fetch('https://api.supabase.com/v1/projects', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `v0-clone-${Date.now()}`,
            organization_id: organizations[0]?.id,
            region: 'us-east-1', // Default region
            db_pass: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), // Generate random password
          }),
        });

        if (createProjectResponse.ok) {
          selectedProject = await createProjectResponse.json();
          console.log('✅ New project created:', selectedProject);
        } else {
          const errorText = await createProjectResponse.text();
          console.error('❌ Failed to create project:', createProjectResponse.status, errorText);
          
          // If we can't create a project, return an error with helpful message
          return NextResponse.json({ 
            error: 'Failed to create new Supabase project',
            details: errorText,
            suggestion: 'Please ensure your OAuth app has "Projects Write" scope enabled, or create a project manually in the Supabase dashboard.',
            organizations,
            projects: []
          }, { status: 400 });
        }
      } catch (error) {
        console.error('❌ Error creating project:', error);
        return NextResponse.json({ 
          error: 'Failed to create new Supabase project',
          details: error.message,
          suggestion: 'Please check your OAuth app permissions or create a project manually.',
          organizations,
          projects: []
        }, { status: 500 });
      }
    }

    // Only fetch API keys if a project is selected
    let apiKey = '';
    if (selectedProject) {
      console.log('🔑 Fetching API keys for project:', selectedProject.id);
      const apiKeysResponse = await fetch(`https://api.supabase.com/v1/projects/${selectedProject.id}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (apiKeysResponse.ok) {
        const apiKeys = await apiKeysResponse.json();
        console.log('📊 API Keys found:', apiKeys.length);
        
        // Find the anon/public key
        const anonKey = apiKeys.find((key: any) => key.name === 'anon' || key.name === 'public');
        if (anonKey) {
          apiKey = anonKey.api_key;
          console.log('✅ Found anon key');
        } else {
          console.warn('⚠️ No anon key found, using first available key');
          if (apiKeys.length > 0) {
            apiKey = apiKeys[0].api_key;
          }
        }
      } else {
        const errorText = await apiKeysResponse.text();
        console.error('❌ Failed to fetch API keys:', apiKeysResponse.status, errorText);
        // Continue without API key - user can get it from dashboard
      }
    } else {
      console.log('📊 No project selected - user will choose in frontend');
    }

    // Log the credentials only if project is selected
    if (selectedProject) {
      console.log('🔑 Supabase Project Selected:');
      console.log('SUPABASE_URL=', selectedProject.api_url);
      console.log('SUPABASE_ANON_KEY=', apiKey);
      console.log('SUPABASE_PROJECT_ID=', selectedProject.id);
      console.log('SUPABASE_ORGANIZATION_ID=', selectedProject.organization_id);
    } else {
      console.log('📊 OAuth successful - user will select project in frontend');
    }

    // Update the session with Supabase project information only if project is selected
    if (selectedProject) {
      try {
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        console.log('🔍 Storing Supabase project in session:', state, {
          projectId: selectedProject.id,
          projectUrl: selectedProject.api_url,
          apiKey: apiKey,
          organizationId: selectedProject.organization_id
        });
      
      // First, check if session exists, if not create it
      console.log('🔍 Checking if session exists:', state || 'default');
      const existingSession = await convex.query(api.sessions.getBySessionId, { 
        sessionId: state || 'default' 
      });
      console.log('📊 Session check result:', { 
        exists: !!existingSession,
        hasSupabaseProject: !!existingSession?.supabaseProject
      });
      
      if (!existingSession) {
        console.log('🔍 Session does not exist, creating new session...');
        try {
          await convex.mutation(api.sessions.create, {
            sessionId: state || 'default',
            name: 'Supabase Project Session',
            templateId: 'supabase-project',
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
      
      // Now update the session with Supabase project information
      console.log('🔍 Storing Supabase project in session...');
      try {
        await convex.mutation(api.sessions.updateSupabaseProject, {
          sessionId: state || 'default',
          supabaseProject: {
            projectId: selectedProject.id,
            projectUrl: selectedProject.api_url,
            apiKey: apiKey,
            organizationId: selectedProject.organization_id,
            projectName: selectedProject.name,
            region: selectedProject.region,
          },
        });
        console.log('✅ Supabase project stored in session successfully:', state);
      } catch (updateError) {
        console.error('❌ Failed to store Supabase project in session:', updateError);
        throw updateError;
      }
      } catch (error) {
        console.error('❌ Failed to store Supabase project in session:', error);
        // Continue anyway - the project was created successfully
      }
    }

    // Store OAuth data in database for this session (always store, even if no project selected)
    try {
      console.log('💾 Storing Supabase OAuth data in database for session:', sessionId);
      
      // Check if session exists (like Convex does)
      const existingSession = await convex.query(api.sessions.getBySessionId, { 
        sessionId: sessionId 
      });
      
      if (!existingSession) {
        console.log('❌ Session does not exist:', sessionId);
        console.log('❌ Supabase OAuth requires an existing session (like Convex)');
        return NextResponse.json({ 
          error: 'Session not found. Please start a session first.',
          sessionId: sessionId 
        }, { status: 404 });
      }
      
      // Filter projects to only include fields that match our schema
      const filteredProjects = projects.map(project => ({
        id: project.id,
        name: project.name,
        status: project.status,
        region: project.region,
        created_at: project.created_at,
        api_url: project.api_url,
        // Don't include database and organization_id fields for now
      }));
      
      await convex.mutation(api.sessions.updateSupabaseOAuthData, {
        sessionId,
        supabaseOAuthData: {
          accessToken,
          refreshToken: tokenData.refresh_token,
          organizations,
          projects: filteredProjects,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
        },
      });
      
      console.log('✅ Supabase OAuth data stored in database');
      
      // Clean up the codeVerifier from cache
      if (global.supabaseCodeVerifiers) {
        global.supabaseCodeVerifiers.delete(sessionId);
      }
    } catch (error) {
      console.error('❌ Failed to store Supabase OAuth data in database:', error);
      // Continue anyway - the OAuth was successful
    }

    // If no project selected, return projects for selection (like Convex doesn't auto-select)
    if (!selectedProject) {
      console.log('📊 No project selected - user will choose in frontend');
      
      const responseData = { 
        accessToken,
        refreshToken: tokenData.refresh_token,
        organizations,
        projects,
        message: 'OAuth successful - user will select project in frontend'
      };

      // Cache the result to avoid duplicate processing
      const cacheResult = {
        data: responseData,
        html: null as string | null
      };

      // Cache the JSON result for both code and request ID
      processedCodes.set(code, cacheResult);
      processedCodes.set(requestId, cacheResult);

      return NextResponse.json(responseData);
    }

    // Store the selected project in the session (like Convex does)
    try {
      console.log('💾 Storing Supabase project in session:', sessionId);
      
        // Session should already exist (like Convex does)
        const existingSession = await convex.query(api.sessions.getBySessionId, { 
          sessionId: sessionId 
        });
        
        if (!existingSession) {
          console.log('❌ Session does not exist for project storage:', sessionId);
          throw new Error('Session not found for project storage');
        }
        
        // Update the session with Supabase project information
        await convex.mutation(api.sessions.updateSupabaseProject, {
          sessionId: sessionId,
        supabaseProject: {
          projectId: selectedProject.id,
          projectUrl: selectedProject.api_url || `https://${selectedProject.id}.supabase.co`,
          apiKey: apiKey,
          organizationId: organizations[0]?.id || '',
          projectName: selectedProject.name,
          region: selectedProject.region || 'us-east-1',
        },
      });
      
      console.log('✅ Supabase project stored in session');
    } catch (error) {
      console.error('❌ Failed to store Supabase project in session:', error);
      // Continue anyway - the project was created successfully
    }

    // Log the credentials (like Convex does)
    console.log('🔑 Supabase Project Connected:');
    console.log('SUPABASE_URL=', selectedProject.api_url || `https://${selectedProject.id}.supabase.co`);
    console.log('SUPABASE_ANON_KEY=', apiKey);
    console.log('EXPO_PUBLIC_SUPABASE_URL=', selectedProject.api_url || `https://${selectedProject.id}.supabase.co`);
    console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY=', apiKey);
    console.log('SUPABASE_PROJECT_ID=', selectedProject.id);
    console.log('SUPABASE_ORGANIZATION_ID=', organizations[0]?.id || '');

    // Return the project data (like Convex does)
    const responseData = { 
      projectId: selectedProject.id,
      projectUrl: selectedProject.api_url || `https://${selectedProject.id}.supabase.co`,
      apiKey: apiKey,
      organizationId: organizations[0]?.id || '',
      projectName: selectedProject.name,
      region: selectedProject.region || 'us-east-1',
      accessToken,
      refreshToken: tokenData.refresh_token,
    };

    // Cache the result to avoid duplicate processing
    const cacheResult = {
      data: responseData,
      html: null as string | null
    };

    // Determine if this is a mobile app request
    const isMobile = request.headers.get('user-agent')?.includes('Expo') || 
                     request.headers.get('referer')?.includes('exp://');
    
    // For mobile apps, return HTML that redirects back to the app
    if (isMobile) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Supabase Connected</title>
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
            <div class="title">Supabase Connected!</div>
            <div class="message">Redirecting back to VibraCoder...</div>
            <div class="loading">Please wait...</div>
          </div>
          <script>
            // Store credentials in localStorage for the app to retrieve
            localStorage.setItem('supabase_credentials', JSON.stringify(${JSON.stringify(responseData)}));
            
            setTimeout(() => {
              try {
                window.location.href = 'exp://localhost:8081';
              } catch (e) {
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
      processedCodes.set(requestId, cacheResult);
      
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Cache the JSON result for both code and request ID
    processedCodes.set(code, cacheResult);
    processedCodes.set(requestId, cacheResult);

    // For direct API calls, return JSON
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in Supabase OAuth callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle POST requests
export async function POST(request: NextRequest) {
  console.log('📨 POST request to Supabase callback - ignoring');
  return NextResponse.json({ message: 'POST not supported, use GET' }, { status: 200 });
}
