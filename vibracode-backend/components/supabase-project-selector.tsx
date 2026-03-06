'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Database, Plus, Check, Globe, Calendar, Hash } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
  region: string;
  created_at: string;
  api_url?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface SupabaseProjectSelectorProps {
  accessToken: string;
  organizations: Organization[];
  projects: Project[];
  onProjectSelected: (project: Project, apiKey: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export default function SupabaseProjectSelector({
  accessToken,
  organizations,
  projects: initialProjects,
  onProjectSelected,
  onCreateNew,
  onCancel
}: SupabaseProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [loading, setLoading] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(organizations[0] || null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Use the projects passed as props if available, otherwise fetch them
    if (initialProjects && initialProjects.length > 0) {
      setProjects(initialProjects);
      setLoading(false);
    } else if (selectedOrg) {
      fetchProjects(selectedOrg.id);
    }
  }, [initialProjects, selectedOrg]);

  const fetchProjects = async (orgId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`https://api.supabase.com/v1/projects`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const projectsData = await response.json();
        setProjects(projectsData);
        console.log('📊 Projects loaded:', projectsData);
      } else {
        console.error('Failed to fetch projects:', response.status);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKey = async (projectId: string) => {
    if (apiKeys[projectId]) return apiKeys[projectId];

    try {
      setLoadingKeys(prev => new Set(prev).add(projectId));
      // Use our API route instead of direct Supabase API to avoid CORS issues
      const requestBody = {
        projectId,
        accessToken
      };
      console.log('🔍 Sending API key request:', requestBody);
      
      const response = await fetch(`/api/supabase/fetch-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const apiKey = data.apiKey || '';
        
        setApiKeys(prev => ({ ...prev, [projectId]: apiKey }));
        return apiKey;
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch API key:', errorData);
        return '';
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
    } finally {
      setLoadingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
    return '';
  };

  const handleProjectSelect = async (project: Project) => {
    setSelectedProject(project);
    try {
      const apiKey = await fetchApiKey(project.id);
      onProjectSelected(project, apiKey);
    } catch (error) {
      console.error('Failed to fetch API key, proceeding without it:', error);
      // Proceed without API key - user can get it from dashboard
      onProjectSelected(project, '');
    }
  };

  const handleCreateNew = () => {
    // Get the current organization ID
    const orgId = selectedOrg?.id || organizations[0]?.id;
    
    if (orgId) {
      // Open Supabase new project page with organization parameter
      const newProjectUrl = `https://supabase.com/dashboard/new?org=${orgId}`;
      window.open(newProjectUrl, '_blank');
    } else {
      // Fallback to general new project page
      window.open('https://supabase.com/dashboard/new', '_blank');
    }
    
    // Close the modal
    onCancel();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE_HEALTHY':
        return 'bg-green-100 text-green-800';
      case 'ACTIVE_UNHEALTHY':
        return 'bg-yellow-100 text-yellow-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/20 rounded-lg">
          <Database className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold">Select Supabase Project</h2>
        <p className="text-muted-foreground">Choose an existing project or create a new one</p>
      </div>

      {/* Organization Selection */}
      {organizations.length > 1 && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Organization</label>
          <Select
            value={selectedOrg?.id || ''}
            onValueChange={(value) => {
              const org = organizations.find(o => o.id === value);
              setSelectedOrg(org || null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Projects List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-muted rounded-lg">
              <Database className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No Projects Found</h3>
              <p className="text-muted-foreground text-sm">This organization doesn't have any Supabase projects yet.</p>
            </div>
            <Button onClick={handleCreateNew} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create New Project
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`cursor-pointer transition-all duration-200 hover:bg-muted/50 rounded-lg border p-4 ${
                  selectedProject?.id === project.id 
                    ? 'ring-2 ring-primary border-primary bg-primary/5' 
                    : 'border-border hover:border-border/80'
                }`}
                onClick={() => handleProjectSelect(project)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-md flex items-center justify-center">
                      <Database className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{project.name}</h3>
                      <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-1">
                        <span>{project.region}</span>
                        <span>•</span>
                        <span>{new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={project.status === 'ACTIVE_HEALTHY' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {project.status.replace('_', ' ')}
                    </Badge>
                    {selectedProject?.id === project.id && (
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-4">
        <Button 
          onClick={handleCreateNew} 
          variant="outline" 
          className="flex-1"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Project
        </Button>
        <Button 
          onClick={onCancel} 
          variant="outline" 
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
