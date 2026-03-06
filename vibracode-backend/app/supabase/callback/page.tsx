'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

type TokenResponse =
  | {
      accessToken: string;
      refreshToken: string;
      projectId: string;
      projectUrl: string;
      apiKey: string;
      organizationId: string;
      projectName: string;
      region: string;
      organizations?: any[];
      projects?: any[];
      selectedProject?: any;
    }
  | {
      error: string;
    };

function SupabaseCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [credentials, setCredentials] = useState<any>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      setStatus('error');
      return;
    }

    // Exchange the code for a token
    const handleTokenExchange = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        
        if (!code) {
          setStatus('error');
          return;
        }

        // Call the API route to process the token exchange
        const response = await fetch(`/api/supabase/callback?${searchParams.toString()}`);
        const data = await response.json();
        const tokenData = data as TokenResponse;

        if ('accessToken' in tokenData) {
          setCredentials(tokenData);
          setStatus('success');
          
          // Log the credentials only if project is selected
          if (tokenData.projectId) {
            console.log('🔑 Supabase Project Credentials:');
            console.log('SUPABASE_URL=', tokenData.projectUrl);
            console.log('SUPABASE_ANON_KEY=', tokenData.apiKey);
            console.log('EXPO_PUBLIC_SUPABASE_URL=', tokenData.projectUrl);
            console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY=', tokenData.apiKey);
            console.log('SUPABASE_PROJECT_ID=', tokenData.projectId);
            console.log('SUPABASE_ORGANIZATION_ID=', tokenData.organizationId);
          } else {
            console.log('📊 OAuth successful - projects available for selection:', tokenData.projects?.length || 0);
          }
          
          // Store in localStorage for potential future use (session-specific)
          localStorage.setItem('supabaseProjectToken', tokenData.accessToken);
          if (tokenData.projectId) {
            localStorage.setItem('supabaseProjectId', tokenData.projectId);
            localStorage.setItem('supabaseProjectUrl', tokenData.projectUrl);
            localStorage.setItem('supabaseProjectApiKey', tokenData.apiKey);
            localStorage.setItem('supabaseOrganizationId', tokenData.organizationId);
          }
          
          // Parse state to get sessionId
          const state = searchParams.get('state');
          let sessionId = 'default';
          try {
            const stateData = JSON.parse(state || '{}');
            sessionId = stateData.sessionId || 'default';
          } catch (error) {
            console.warn('Failed to parse state parameter, using default sessionId');
            sessionId = state || 'default';
          }
          
          // Send simple message to parent window (like Convex does)
          if (window.opener) {
            try {
              const messageData = {
                type: 'supabaseOAuthComplete',
                sessionId: sessionId,
                projectId: tokenData.projectId,
                projects: tokenData.projects
              };
              
              window.opener.postMessage(messageData, window.location.origin);
              console.log('✅ OAuth completion message sent to parent window');
              
              // Close the popup after a short delay
              setTimeout(() => {
                window.close();
              }, 1500);
            } catch (error) {
              console.error('❌ Error sending message to parent window:', error);
            }
          } else {
            console.warn('⚠️ No window.opener found, using localStorage fallback');
            // Fallback: Store data in localStorage for parent window to pick up
            localStorage.setItem('supabaseOAuthData', JSON.stringify({
              ...callbackMessageData,
              timestamp: Date.now()
            }));
            console.log('📤 Fallback: Stored OAuth data in localStorage:', callbackMessageData);
          }
          
          // Store credentials in the current session (if session ID is valid)
          if (state && state !== 'default') {
            try {
              // First, get existing envs from the session
              const getSessionResponse = await fetch(`/api/session/get-envs?sessionId=${state}`);
              let existingEnvs = {};
              
              if (getSessionResponse.ok) {
                const sessionData = await getSessionResponse.json();
                existingEnvs = sessionData.envs || {};
              }
              
              // Add Supabase credentials to existing envs only if project is selected
              const updatedEnvs = {
                ...existingEnvs,
                ...(tokenData.projectId ? {
                  SUPABASE_URL: tokenData.projectUrl,
                  SUPABASE_ANON_KEY: tokenData.apiKey,
                  EXPO_PUBLIC_SUPABASE_URL: tokenData.projectUrl,
                  EXPO_PUBLIC_SUPABASE_ANON_KEY: tokenData.apiKey,
                  SUPABASE_PROJECT_ID: tokenData.projectId,
                  SUPABASE_ORGANIZATION_ID: tokenData.organizationId,
                } : {}),
              };
              
              // Update session with all envs
              const sessionResponse = await fetch('/api/session/update-envs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sessionId: state,
                  envs: updatedEnvs,
                })
              });
              
              if (sessionResponse.ok) {
                console.log('✅ Supabase credentials stored in session envs');
                
                // Sync envs to sandbox
                await fetch('/api/session/sync-envs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: state }),
                });
                console.log('✅ Environment variables synced to sandbox');
              } else {
                console.error('❌ Failed to store Supabase credentials in session');
                const errorData = await sessionResponse.text();
                console.error('Error details:', errorData);
              }
            } catch (error) {
              console.error('❌ Error storing Supabase credentials:', error);
            }
          } else {
            console.log('⚠️ No valid session ID, credentials will be stored in localStorage only');
          }
          
          console.log('📊 OAuth completed for session:', sessionId);
          
          // Send simple message to parent window to refresh/check for stored data
          if (window.opener) {
            try {
              window.opener.postMessage({
                type: 'supabaseOAuthComplete',
                sessionId: sessionId
              }, window.location.origin);
              console.log('✅ OAuth completion message sent to parent window for session:', sessionId);
            } catch (error) {
              console.error('❌ Error sending message to parent window:', error);
            }
            
            // Close the popup
            setTimeout(() => {
              window.close();
            }, 1000);
          } else {
            // Close after a delay
            setTimeout(() => {
              window.close();
            }, 2000);
          }
        } else {
          console.error('Failed to exchange code for token:', tokenData.error);
          setStatus('error');
        }
      } catch (error) {
        console.error('Error exchanging code:', error);
        setStatus('error');
      }
    };

    handleTokenExchange();
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm text-muted-foreground">Connecting to Supabase...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600">Connection Failed</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Failed to connect to Supabase. Please try again.
          </p>
          <button 
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4">
          <div className="h-12 w-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-green-600">OAuth Successful!</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Found {credentials?.projects?.length || 0} projects. Please select one in the main window.
        </p>
        {credentials?.projects && credentials.projects.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-md">
            <p className="text-sm font-medium text-blue-900">Available Projects:</p>
            <ul className="mt-1 text-sm text-blue-700">
              {credentials.projects.map((project: any, index: number) => (
                <li key={index}>• {project.name} ({project.status})</li>
              ))}
            </ul>
          </div>
        )}
        {credentials && (
          <div className="mt-4 p-4 bg-muted rounded-md text-left max-w-md">
            <p className="text-xs font-mono">
              <strong>Project:</strong> {credentials.projectName || credentials.projectId}
            </p>
            <p className="text-xs font-mono">
              <strong>URL:</strong> {credentials.projectUrl}
            </p>
            <p className="text-xs font-mono">
              <strong>Region:</strong> {credentials.region}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Project selector will appear in the main window...
        </p>
      </div>
    </div>
  );
}

export default function SupabaseCallback() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SupabaseCallbackContent />
    </Suspense>
  );
}
