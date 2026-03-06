'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Database, Key, Globe } from 'lucide-react';

interface SupabaseProject {
  projectId: string;
  projectUrl: string;
  apiKey: string;
  organizationId: string;
  projectName?: string;
  region?: string;
}

interface SupabaseDashboardProps {
  project?: SupabaseProject;
  onClose?: () => void;
}

export function SupabaseDashboard({ 
  project, 
  onClose 
}: SupabaseDashboardProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  if (!project) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No Supabase project connected</p>
          <p className="text-sm text-muted-foreground mt-2">
            Click the Supabase button to connect to Supabase
          </p>
        </div>
      </div>
    );
  }

  const dashboardUrl = `https://supabase.com/dashboard/project/${project.projectId}`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 bg-muted p-2 flex-shrink-0">
        <div className="flex grow items-center gap-1 rounded-full border bg-background px-3 py-1 text-sm">
          <Database className="h-4 w-4 text-green-600" />
          <input 
            className="w-full bg-transparent outline-none" 
            type="text" 
            value={dashboardUrl} 
            disabled 
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            window.open(dashboardUrl, '_blank');
          }}
          aria-label="Open Supabase dashboard in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        {onClose && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        )}
      </div>
      
      <div className="flex-1 border-t p-4 overflow-y-auto">
        <div className="space-y-6">
          {/* Project Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Project Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Project Name</label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono">{project.projectName || project.projectId}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Region</label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono">{project.region || 'us-east-1'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* API Credentials */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">API Credentials</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Project URL</label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono break-all">{project.projectUrl}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Anon Key</label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono break-all">{project.apiKey}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Project ID</label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono">{project.projectId}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold">Environment Variables</h3>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Add these environment variables to your project:
              </p>
              
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono">
                    <span className="text-green-600">SUPABASE_URL</span>={project.projectUrl}
                  </p>
                </div>
                
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono">
                    <span className="text-green-600">SUPABASE_ANON_KEY</span>={project.apiKey}
                  </p>
                </div>
                
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono">
                    <span className="text-green-600">EXPO_PUBLIC_SUPABASE_URL</span>={project.projectUrl}
                  </p>
                </div>
                
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-mono">
                    <span className="text-green-600">EXPO_PUBLIC_SUPABASE_ANON_KEY</span>={project.apiKey}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quick Actions</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => window.open(`${dashboardUrl}/editor`, '_blank')}
                className="justify-start"
              >
                <Database className="h-4 w-4 mr-2" />
                Open SQL Editor
              </Button>
              
              <Button
                variant="outline"
                onClick={() => window.open(`${dashboardUrl}/auth/users`, '_blank')}
                className="justify-start"
              >
                <Key className="h-4 w-4 mr-2" />
                Manage Users
              </Button>
              
              <Button
                variant="outline"
                onClick={() => window.open(`${dashboardUrl}/storage/buckets`, '_blank')}
                className="justify-start"
              >
                <Globe className="h-4 w-4 mr-2" />
                Storage
              </Button>
              
              <Button
                variant="outline"
                onClick={() => window.open(`${dashboardUrl}/settings/api`, '_blank')}
                className="justify-start"
              >
                <Key className="h-4 w-4 mr-2" />
                API Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
