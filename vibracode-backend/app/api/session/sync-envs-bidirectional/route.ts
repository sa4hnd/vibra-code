import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { E2BManager } from '@/lib/e2b/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as any;
    const sessionId = body?.sessionId as string | undefined;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Get session data by sessionId string
    const session = await fetchQuery(api.sessions.getBySessionId, { 
      sessionId 
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Create E2B manager and connect to existing sandbox
    const e2bManager = new E2BManager();
    await e2bManager.connectToSandbox(sessionId);

    // Get environment variables from sandbox .env.local file
    const sandboxEnvsResult = await e2bManager.executeCommand(`
      if [ -f .env.local ]; then
        cat .env.local
      else
        echo ""
      fi
    `);

    console.log('Sandbox env result type:', typeof sandboxEnvsResult);
    console.log('Sandbox env result:', sandboxEnvsResult);

    // Parse sandbox environment variables
    const sandboxEnvs: Record<string, string> = {};
    
    // Handle different possible return types from executeCommand
    let sandboxEnvContent = '';
    if (typeof sandboxEnvsResult === 'string') {
      sandboxEnvContent = sandboxEnvsResult;
    } else if (sandboxEnvsResult && typeof sandboxEnvsResult === 'object' && 'stdout' in sandboxEnvsResult) {
      sandboxEnvContent = sandboxEnvsResult.stdout || '';
    }

    if (sandboxEnvContent && sandboxEnvContent.trim()) {
      const lines = sandboxEnvContent.trim().split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=');
            sandboxEnvs[key.trim()] = value.trim();
          }
        }
      }
    }

    // Get database environment variables
    const dbEnvs = session.envs || {};

    // Merge environment variables (sandbox takes precedence for conflicts)
    const mergedEnvs = {
      ...dbEnvs,
      ...sandboxEnvs,
    };

    // Update database with merged environment variables
    await fetchMutation(api.sessions.updateEnvs, {
      sessionId,
      envs: mergedEnvs,
    });

    // Sync merged environment variables back to sandbox
    const mergedEnvContent = Object.entries(mergedEnvs)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const syncResult = await e2bManager.executeCommand(`
      cat > .env.local << 'EOF'
${mergedEnvContent}
EOF
      echo "✅ Environment variables synced bidirectionally"
      echo "📊 Database: ${Object.keys(dbEnvs).length} vars"
      echo "📊 Sandbox: ${Object.keys(sandboxEnvs).length} vars"
      echo "📊 Merged: ${Object.keys(mergedEnvs).length} vars"
    `);

    console.log('Bidirectional sync completed:', syncResult);

    return NextResponse.json({ 
      success: true, 
      result: syncResult,
      stats: {
        database: Object.keys(dbEnvs).length,
        sandbox: Object.keys(sandboxEnvs).length,
        merged: Object.keys(mergedEnvs).length,
      }
    });
  } catch (error) {
    console.error('Error syncing environment variables bidirectionally:', error);
    return NextResponse.json(
      { error: 'Failed to sync environment variables bidirectionally' },
      { status: 500 }
    );
  }
}
