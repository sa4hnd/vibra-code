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

export async function POST(request: NextRequest) {
  try {
    const { sessionId, token } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // Use provided token or fall back to environment variable
    const deployKey = token === 'auto-create' ? process.env.CONVEX_DEPLOY_KEY : token;
    
    if (!deployKey) {
      return NextResponse.json({ 
        error: 'No Convex deploy key available. Please use the OAuth flow to connect an existing project.',
        code: 'NO_DEPLOY_KEY'
      }, { status: 400 });
    }

    // Create a new prod deployment for this session
    console.log('🆕 Creating new Convex project for session:', sessionId);
    const { deploymentName, url: deploymentUrl, adminKey } = await fetchDeploymentCredentials(
      PROVISION_HOST, 
      deployKey, 
      'dev'
    );

    // Log the credentials
    console.log('🔑 New Convex Project Created:');
    console.log('CONVEX_DEPLOYMENT=', deploymentName);
    console.log('EXPO_PUBLIC_CONVEX_URL=', deploymentUrl);
    console.log('Admin Key:', adminKey);

    // Update the session with Convex project information
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    await convex.mutation(api.sessions.updateConvexProject, {
      sessionId,
      convexProject: {
        deploymentName,
        deploymentUrl,
        adminKey,
      },
    });

    return NextResponse.json({ 
      success: true,
      convexProject: {
        deploymentName,
        deploymentUrl,
        adminKey,
      }
    });
  } catch (error) {
    console.error('Error creating Convex project:', error);
    return NextResponse.json({ error: 'Failed to create Convex project' }, { status: 500 });
  }
}
