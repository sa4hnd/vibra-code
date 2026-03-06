'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

type TokenResponse =
  | {
      token: string;
      deploymentName: string;
      deploymentUrl: string;
      adminKey: string;
    }
  | {
      status: 'already_processed';
      message: string;
      deploymentName?: string;
      deploymentUrl?: string;
      adminKey?: string;
    }
  | {
      error: string;
    };

function ConvexCallbackContent() {
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
        const response = await fetch(`/api/convex/callback?${searchParams.toString()}`);
        const data = await response.json();
        const tokenData = data as TokenResponse;

        if ('token' in tokenData) {
          setCredentials(tokenData);
          setStatus('success');

          // Log the credentials as requested
          console.log('🔑 Convex Project Credentials:');
          console.log('CONVEX_DEPLOY_KEY=', tokenData.token);
          console.log('CONVEX_DEPLOYMENT=', tokenData.deploymentName);
          console.log('EXPO_PUBLIC_CONVEX_URL=', tokenData.deploymentUrl);
          console.log('Admin Key:', tokenData.adminKey);
          
          // Store in localStorage for potential future use (session-specific)
          localStorage.setItem('convexProjectToken', tokenData.token);
          localStorage.setItem('convexProjectDeploymentName', tokenData.deploymentName);
          localStorage.setItem('convexProjectDeploymentUrl', tokenData.deploymentUrl);
          localStorage.setItem('convexProjectAdminKey', tokenData.adminKey);
          
          // Store credentials in the current session (if session ID is valid)
          const state = searchParams.get('state');
          if (state && state !== 'default') {
            try {
              // First, get existing envs from the session
              const getSessionResponse = await fetch(`/api/session/get-envs?sessionId=${state}`);
              let existingEnvs = {};
              
              if (getSessionResponse.ok) {
                const sessionData = await getSessionResponse.json();
                existingEnvs = sessionData.envs || {};
              }
              
              // Add Convex credentials to existing envs
              const updatedEnvs = {
                ...existingEnvs,
                CONVEX_DEPLOY_KEY: tokenData.token,
                CONVEX_DEPLOYMENT: tokenData.deploymentName,
                EXPO_PUBLIC_CONVEX_URL: tokenData.deploymentUrl,
                CONVEX_ADMIN_KEY: tokenData.adminKey,
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
                console.log('✅ Convex credentials stored in session envs');
                
                // Sync envs to sandbox
                await fetch('/api/session/sync-envs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: state }),
                });
                console.log('✅ Environment variables synced to sandbox');
              } else {
                console.error('❌ Failed to store Convex credentials in session');
                const errorData = await sessionResponse.text();
                console.error('Error details:', errorData);
              }
            } catch (error) {
              console.error('❌ Error storing Convex credentials:', error);
            }
          } else {
            console.log('⚠️ No valid session ID, credentials will be stored in localStorage only');
          }

          // Send message to parent window (popup)
          const project = {
            token: tokenData.token,
            deploymentName: tokenData.deploymentName,
            deploymentUrl: tokenData.deploymentUrl,
            adminKey: tokenData.adminKey,
          };

          if (window.opener) {
            // Popup window - send message and close
            console.log('📤 Sending message to parent window:', {
              type: 'openConvexDashboard',
              project,
              switchToDatabaseTab: true
            });

            // Try multiple ways to send the message
            try {
              // Method 1: Direct to opener
              window.opener.postMessage({
                type: 'openConvexDashboard',
                project,
                switchToDatabaseTab: true
              }, '*');

              // Method 2: Try opener's parent
              if (window.opener.parent && window.opener.parent !== window.opener) {
                window.opener.parent.postMessage({
                  type: 'openConvexDashboard',
                  project,
                  switchToDatabaseTab: true
                }, '*');
              }
            } catch (e) {
              console.error('Error sending message to parent:', e);
            }

            // Close the popup after a longer delay to ensure message is sent
            setTimeout(() => {
              window.close();
            }, 2000);
          } else {
            // Not in a popup - might be a redirect, just show success
            console.log('📤 Not in popup mode, project saved to session');
          }
        } else if ('status' in tokenData && tokenData.status === 'already_processed') {
          // Code was already used - this is expected for duplicate requests
          console.log('🔄 Code already processed:', tokenData.message);
          if (tokenData.deploymentName) {
            setCredentials({
              deploymentName: tokenData.deploymentName,
              deploymentUrl: tokenData.deploymentUrl,
              adminKey: tokenData.adminKey,
            });
          }
          setStatus('success');
          // Close popup if in popup mode
          if (window.opener) {
            setTimeout(() => window.close(), 2000);
          }
        } else if ('error' in tokenData) {
          console.error('Failed to exchange code for token:', tokenData.error);
          setStatus('error');
        } else {
          console.error('Unexpected response format:', tokenData);
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
          <p className="text-sm text-muted-foreground">Connecting to Convex...</p>
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
            Failed to connect to Convex. Please try again.
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
        <h2 className="text-lg font-semibold text-green-600">Connected Successfully!</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your Convex project has been created and is ready to use.
        </p>
        {credentials && (
          <div className="mt-4 p-4 bg-muted rounded-md text-left max-w-md">
            <p className="text-xs font-mono">
              <strong>Deployment:</strong> {credentials.deploymentName}
            </p>
            <p className="text-xs font-mono">
              <strong>URL:</strong> {credentials.deploymentUrl}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          This window will close automatically...
        </p>
      </div>
    </div>
  );
}

export default function ConvexCallback() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ConvexCallbackContent />
    </Suspense>
  );
}
