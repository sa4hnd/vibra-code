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

export async function createConvexProjectForSession(sessionId: string, userId?: string) {
  try {
    if (!userId) {
      console.log('⏭️ No userId provided - skipping automatic project creation');
      return null;
    }

    // Get stored OAuth credentials for this user (same as chef)
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const credentials = await convex.query(api.sessions.getConvexCredentials, { userId });
    
    if (!credentials) {
      console.log('⏭️ No stored OAuth credentials found - user needs to authenticate first');
      return null;
    }

    console.log('🆕 Creating Convex project using stored credentials for session:', sessionId);
    
    // Use the stored projectDeployKey to create a new project (same as chef)
    const response = await fetch('https://api.convex.dev/api/deployment/provision_and_authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Convex-Client': 'v0-clone-1.0.0',
        Authorization: `Bearer ${credentials.projectDeployKey}`,
      },
      body: JSON.stringify({
        teamSlug: null,
        projectSlug: null,
        deploymentType: 'dev',
      }),
    });

    if (!response.ok) {
      console.error('Failed to create Convex project:', response.status);
      return null;
    }

    const projectData = await response.json();
    console.log('🔑 New Convex Project Created:', projectData);

    // Update the session with Convex project information
    await convex.mutation(api.sessions.updateConvexProject, {
      sessionId,
      convexProject: {
        deploymentName: projectData.deploymentName,
        deploymentUrl: projectData.deploymentUrl,
        adminKey: projectData.adminKey,
      },
    });

    console.log('✅ Convex project created and stored for session:', sessionId);

    return {
      deploymentName: projectData.deploymentName,
      deploymentUrl: projectData.deploymentUrl,
      adminKey: projectData.adminKey,
    };
  } catch (error) {
    console.error('❌ Error creating Convex project for session:', sessionId, error);
    return null;
  }
}
