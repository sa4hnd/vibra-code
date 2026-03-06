"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { SupabaseWordmark } from "@/components/supabase-wordmark";
import Image from "next/image";
import { Database, Settings, LogOut, ExternalLink, Plus } from "lucide-react";
import { Doc } from "@/convex/_generated/dataModel";

interface SupabaseDropdownProps {
  session: Doc<"sessions">;
  sessionId: string;
}

export function SupabaseDropdown({ session, sessionId }: SupabaseDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [oauthData, setOauthData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isChangingProject, setIsChangingProject] = useState(false);

  // Load Supabase project from database
  const loadSupabaseProject = async () => {
    try {
      console.log('🔍 Loading Supabase project for session:', sessionId);
      const response = await fetch(`/api/session/get-supabase-oauth-data?sessionId=${sessionId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.supabaseOAuthData) {
          console.log('📊 Found Supabase OAuth data in database:', data.supabaseOAuthData);
          
          // Check if data is not expired
          if (data.supabaseOAuthData.expiresAt > Date.now()) {
            setOauthData(data.supabaseOAuthData);
            return data.supabaseOAuthData;
          } else {
            console.log('⚠️ Supabase OAuth data expired');
          }
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error loading Supabase project:', error);
      return null;
    }
  };

  // Load Supabase project on mount
  useEffect(() => {
    loadSupabaseProject();
  }, [sessionId]);

  // Load projects when OAuth data is available
  useEffect(() => {
    console.log('🔄 OAuth data changed:', oauthData);
    if (oauthData && oauthData.projects) {
      console.log('📊 Setting projects from OAuth data:', oauthData.projects);
      setProjects(oauthData.projects);
    }
  }, [oauthData]);

  // Debug projects state
  useEffect(() => {
    console.log('🔄 Projects state changed:', projects);
  }, [projects]);

  const handleProjectSelected = async (project: any, apiKey: string) => {
    try {
      console.log('💾 Storing selected Supabase project in database:', project.id);
      
      // Store selected project in database
      const response = await fetch('/api/session/update-supabase-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
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
            sessionId: sessionId,
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
          body: JSON.stringify({ sessionId: sessionId }),
        });
        
        console.log('✅ Environment variables synced to sandbox');
        
        // Close dropdown immediately
        setIsOpen(false);
        setIsChangingProject(false);

        // Reload OAuth data to update state instead of page reload
        await loadSupabaseProject();
      } else {
        console.error('❌ Failed to store Supabase project in database');
      }
    } catch (error) {
      console.error('❌ Error storing Supabase project:', error);
    }
  };


  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out from Supabase, clearing database...');
      
      // Clear Supabase project from database
      const response = await fetch('/api/session/update-supabase-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          supabaseProject: null // Clear the project
        })
      });
      
      if (response.ok) {
        console.log('✅ Supabase project cleared from database');
        
        // Clear Supabase environment variables
        await fetch('/api/session/update-envs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            envs: {
              SUPABASE_URL: '',
              SUPABASE_ANON_KEY: '',
              EXPO_PUBLIC_SUPABASE_URL: '',
              EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
              SUPABASE_PROJECT_ID: '',
              SUPABASE_ORGANIZATION_ID: '',
            }
          })
        });
        
        console.log('✅ Supabase environment variables cleared');
        
        // Clear OAuth data from database
        await fetch('/api/session/remove-supabase-oauth-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId })
        });
        
        console.log('✅ Supabase OAuth data cleared');
        
        // Sync cleared envs to sandbox
        await fetch('/api/session/sync-envs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId }),
        });
        
        console.log('✅ Environment variables synced to sandbox');
        
        // Clear local state - Convex will update session automatically
        setOauthData(null);
        setProjects([]);
        setIsOpen(false);
      } else {
        console.error('❌ Failed to clear Supabase project from database');
        alert('Failed to logout. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error during logout:', error);
      alert('Failed to logout. Please try again.');
    }
  };

  const handleConnect = async () => {
    try {
      console.log('🔄 Starting OAuth flow for Supabase connection');
      console.log('🔍 Using sessionId:', sessionId);
      console.log('🔍 Current URL:', window.location.href);
      
      // Get OAuth URL from our API
      const oauthResponse = await fetch('/api/supabase/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          redirectUri: window.location.origin + '/supabase/callback',
        }),
      });

      if (!oauthResponse.ok) {
        throw new Error('Failed to get OAuth URL');
      }

      const { authUrl } = await oauthResponse.json();
      console.log('🔍 OAuth URL generated:', authUrl);

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
          setIsOpen(false);
          setIsChangingProject(false);
          
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
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Error starting OAuth flow:', error);
      alert('Failed to start OAuth flow. Please try again.');
    }
  };

  const handleChangeProject = async () => {
    try {
      console.log('🔄 Loading projects for project change');
      setIsChangingProject(true);
      
      // Load OAuth data to get projects
      const response = await fetch(`/api/session/get-supabase-oauth-data?sessionId=${sessionId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Full OAuth data received:', data);
        
        if (data.supabaseOAuthData && data.supabaseOAuthData.projects) {
          console.log('📊 Found projects for project change:', data.supabaseOAuthData.projects);
          console.log('📊 Projects count:', data.supabaseOAuthData.projects.length);
          setOauthData(data.supabaseOAuthData);
          setProjects(data.supabaseOAuthData.projects);
          console.log('📊 State updated - oauthData and projects set, isChangingProject:', true);
          // Keep dropdown open to show projects
        } else {
          console.log('⚠️ No OAuth data or projects found:', {
            hasOAuthData: !!data.supabaseOAuthData,
            hasProjects: !!(data.supabaseOAuthData && data.supabaseOAuthData.projects),
            projects: data.supabaseOAuthData?.projects
          });
          setIsChangingProject(false);
          // If no OAuth data, start fresh OAuth
          handleConnect();
        }
      } else {
        console.log('⚠️ Failed to load OAuth data, starting fresh OAuth flow');
        setIsChangingProject(false);
        handleConnect();
      }
    } catch (error) {
      console.error('❌ Error loading projects for change:', error);
      setIsChangingProject(false);
      // Fallback to OAuth if loading fails
      handleConnect();
    }
  };

  const openSupabaseDashboard = () => {
    if (session.supabaseProject?.projectUrl) {
      window.open(session.supabaseProject.projectUrl, '_blank');
    }
  };

  const handleCreateNewProject = () => {
    // Get the current organization ID
    const orgId = oauthData?.organizations?.[0]?.id;
    
    if (orgId) {
      // Open Supabase new project page with organization parameter
      const newProjectUrl = `https://supabase.com/dashboard/new?org=${orgId}`;
      window.open(newProjectUrl, '_blank');
    } else {
      // Fallback to general new project page
      window.open('https://supabase.com/dashboard/new', '_blank');
    }
    
    // Close dropdown
    setIsOpen(false);
  };

  const fetchApiKey = async (projectId: string) => {
    try {
      const response = await fetch('/api/supabase/fetch-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          accessToken: oauthData?.accessToken
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.apiKey || '';
      }
      return '';
    } catch (error) {
      console.error('Error fetching API key:', error);
      return '';
    }
  };


  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 px-3 bg-white/5 border-white/10 hover:bg-white/10">
          {session.supabaseProject ? (
            <div className="flex items-center gap-2 text-white text-sm font-medium">
              <Database className="h-4 w-4" />
              Supabase
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white text-sm font-medium">
              <Database className="h-4 w-4" />
              Connect Supabase
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Supabase Project
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {session.supabaseProject && !isChangingProject ? (
          <>
            <div className="px-2 py-1">
              <div className="text-sm font-medium text-foreground">
                {session.supabaseProject.projectName}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {session.supabaseProject.projectId}
              </div>
              <div className="text-xs text-muted-foreground">
                {session.supabaseProject.region}
              </div>
            </div>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={openSupabaseDashboard} className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Dashboard
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleChangeProject} className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Change Project
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-red-600">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </>
        ) : oauthData && projects.length > 0 ? (
          <>
            <div className="px-2 py-1">
              <div className="text-sm text-muted-foreground mb-2">Select a project:</div>
            </div>
            <DropdownMenuSeparator />
            
            {projects.map((project) => (
              <DropdownMenuItem 
                key={project.id}
                onClick={async () => {
                  const apiKey = await fetchApiKey(project.id);
                  handleProjectSelected(project, apiKey);
                }}
                className="flex items-center gap-2 p-2"
              >
                <Database className="h-4 w-4 text-green-600" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{project.name}</div>
                  <div className="text-xs text-muted-foreground">{project.region}</div>
                </div>
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleCreateNewProject} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create New Project
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-red-600">
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <div className="px-2 py-1">
              <div className="text-sm text-muted-foreground">No project connected</div>
              <div className="text-xs text-muted-foreground mt-1">
                Connect to manage your database
              </div>
            </div>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleConnect} className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Connect Project
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
