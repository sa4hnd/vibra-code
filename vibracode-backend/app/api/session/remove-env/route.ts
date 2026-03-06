import { NextRequest, NextResponse } from 'next/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { E2BManager } from '@/lib/e2b/config';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, key } = await request.json();

    if (!sessionId || !key) {
      return NextResponse.json(
        { error: 'Missing sessionId or key' },
        { status: 400 }
      );
    }

    // Remove the environment variable from the session in DB
    await fetchMutation(api.sessions.removeEnv, {
      sessionId,
      key,
    });

    // Get updated session to get all envs
    const session = await fetchQuery(api.sessions.getBySessionId, {
      sessionId
    });

    if (!session) {
      return NextResponse.json({ success: true, synced: false });
    }

    // Sync to sandbox
    try {
      const e2bManager = new E2BManager();
      await e2bManager.connectToSandbox(sessionId);

      // Get existing sandbox envs first
      const sandboxEnvsResult = await e2bManager.executeCommand(`
        if [ -f .env.local ]; then
          cat .env.local
        else
          echo ""
        fi
      `);

      // Parse sandbox environment variables
      const sandboxEnvs: Record<string, string> = {};
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
            const [envKey, ...valueParts] = trimmedLine.split('=');
            if (envKey && valueParts.length > 0) {
              const envValue = valueParts.join('=');
              sandboxEnvs[envKey.trim()] = envValue.trim();
            }
          }
        }
      }

      // Remove the key from sandbox envs too
      delete sandboxEnvs[key];

      // Merge: sandbox envs + DB envs (DB takes precedence)
      const dbEnvs = session.envs || {};
      const mergedEnvs = {
        ...sandboxEnvs,
        ...dbEnvs,
      };

      // Write merged envs to sandbox
      const mergedEnvContent = Object.entries(mergedEnvs)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

      await e2bManager.executeCommand(`
        cat > .env.local << 'EOF'
${mergedEnvContent}
EOF
      `);

      console.log(`Removed env ${key} and synced to sandbox`);
      return NextResponse.json({ success: true, synced: true });
    } catch (syncError) {
      console.warn('Failed to sync env removal to sandbox:', syncError);
      return NextResponse.json({ success: true, synced: false });
    }
  } catch (error) {
    console.error('Error removing environment variable:', error);
    return NextResponse.json(
      { error: 'Failed to remove environment variable' },
      { status: 500 }
    );
  }
}
