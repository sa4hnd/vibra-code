'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Database, ExternalLink, Loader2 } from 'lucide-react';
import { SupabaseWordmark } from '@/components/supabase-wordmark';
import SupabaseProjectSelector from './supabase-project-selector';

interface SupabaseConnectionProps {
  sessionId?: string;
  onProjectConnected?: (project: any) => void;
  className?: string;
}

export function SupabaseConnection({ 
  sessionId, 
  onProjectConnected,
  className = ""
}: SupabaseConnectionProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [oauthData, setOauthData] = useState<any>(null);

  // Load Supabase project from database (like Convex does)
  const loadSupabaseProject = async () => {
    if (!sessionId) return;
    
    try {
      console.log('🔍 Loading Supabase project for session:', sessionId);
      const response = await fetch(`/api/session/get-supabase-oauth-data?sessionId=${sessionId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.supabaseOAuthData) {
          console.log('📊 Found Supabase OAuth data in database:', data.supabaseOAuthData);
          console.log('📊 Projects available:', data.supabaseOAuthData.projects?.length || 0);
          
          // Check if data is not expired
          if (data.supabaseOAuthData.expiresAt > Date.now()) {
            setOauthData(data.supabaseOAuthData);
            setShowProjectSelector(true);
          } else {
            console.log('⚠️ Supabase OAuth data expired');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading Supabase project:', error);
    }
  };

  // Load Supabase project from database on component mount
  useEffect(() => {
    loadSupabaseProject();
  }, [sessionId]);


  const handleConnectSupabase = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    
    try {
      console.log('🔍 Starting Supabase OAuth flow...');
      
      // Get OAuth URL from our API
      const oauthResponse = await fetch('/api/supabase/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId || 'default',
          redirectUri: window.location.origin + '/supabase/callback',
        }),
      });

      if (!oauthResponse.ok) {
        throw new Error('Failed to get OAuth URL');
      }

      const { authUrl, codeVerifier } = await oauthResponse.json();
      console.log('🔍 OAuth URL generated:', authUrl);
      
      // Code verifier is now passed through state parameter, no need to store in session storage
      console.log('🔑 Code verifier will be passed through state parameter');

      // Open OAuth popup
      const popup = window.open(
        authUrl,
        'supabase-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for messages from the popup
      const handleMessage = (event: MessageEvent) => {
        console.log('📨 Received message:', event.data, 'from origin:', event.origin);
        if (event.origin !== window.location.origin) return;
        
            if (event.data.type === 'supabaseOAuthComplete') {
              console.log('📤 Supabase OAuth completed, reloading data from database');
              
              // Close popup
              popup.close();
              window.removeEventListener('message', handleMessage);
              setIsConnecting(false);
              
              // Reload Supabase project from database
              loadSupabaseProject();
            }
      };

      window.addEventListener('message', handleMessage);

      // Handle popup close
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Error connecting to Supabase:', error);
      alert('Failed to connect to Supabase. Please try again.');
      // Code verifier cleanup not needed since it's passed through state
      setIsConnecting(false);
    }
  };

  const handleProjectSelected = async (project: any, apiKey: string) => {
    try {
      console.log('💾 Storing selected Supabase project in database:', project.id);
      
      // Store selected project in database
      const response = await fetch('/api/session/update-supabase-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || 'default',
          supabaseProject: {
            projectId: project.id,
            projectUrl: project.api_url || `https://${project.id}.supabase.co`,
            apiKey: apiKey,
            organizationId: oauthData?.organizations?.[0]?.id || '',
            projectName: project.name,
            region: project.region || 'us-east-1',
          }
        })
      });
      
      if (response.ok) {
        console.log('✅ Supabase project stored in database successfully');
        
        // Store environment variables
        await fetch('/api/session/update-envs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId || 'default',
            envs: {
              SUPABASE_URL: project.api_url || `https://${project.id}.supabase.co`,
              SUPABASE_ANON_KEY: apiKey,
              EXPO_PUBLIC_SUPABASE_URL: project.api_url || `https://${project.id}.supabase.co`,
              EXPO_PUBLIC_SUPABASE_ANON_KEY: apiKey,
              SUPABASE_PROJECT_ID: project.id,
              SUPABASE_ORGANIZATION_ID: oauthData?.organizations?.[0]?.id || '',
            }
          })
        });
        
        console.log('✅ Supabase environment variables stored');
        
        // Sync envs to sandbox
        await fetch('/api/session/sync-envs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId || 'default' }),
        });
        
        console.log('✅ Environment variables synced to sandbox');
      } else {
        console.error('❌ Failed to store Supabase project in database');
      }
    } catch (error) {
      console.error('❌ Error storing Supabase project:', error);
    }
    
    // Notify parent component
    if (onProjectConnected) {
      onProjectConnected({
        ...project,
        apiKey,
        accessToken: oauthData?.accessToken,
        refreshToken: oauthData?.refreshToken,
        expiresAt: oauthData?.expiresAt,
      });
    }
    
    // Close project selector
    setShowProjectSelector(false);
    setOauthData(null);
  };

  const handleCreateNew = () => {
    // For now, just use the first project or create one
    // In a real implementation, you'd call an API to create a new project
    if (oauthData?.projects && oauthData.projects.length > 0) {
      handleProjectSelected(oauthData.projects[0], '');
    } else {
      // Fallback to the selected project from OAuth
      handleProjectSelected(oauthData?.selectedProject, oauthData?.apiKey || '');
    }
  };

  const handleCancel = () => {
    setShowProjectSelector(false);
    setOauthData(null);
  };

  // Show project selector if OAuth completed
  if (showProjectSelector && oauthData) {
    console.log('🎯 Rendering project selector with data:', oauthData);
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="p-6">
            <SupabaseProjectSelector
              accessToken={oauthData.accessToken}
              organizations={oauthData.organizations || []}
              projects={oauthData.projects || []}
              onProjectSelected={handleProjectSelected}
              onCreateNew={handleCreateNew}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={handleConnectSupabase}
      disabled={isConnecting}
      className={`${className}`}
      variant="outline"
    >
      {isConnecting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <SupabaseWordmark size="sm" className="mr-2" />
          Supabase
        </>
      )}
    </Button>
  );
}
