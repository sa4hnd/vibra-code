/**
 * Vibra Restart Dev Server Service
 * Service to restart the dev server in E2B sandboxes when it gets killed by mistake
 */

import { ENV } from '../config/env';

export interface RestartDevServerResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Calls the v0-clone restart-dev-server API to restart the dev server in a sandbox
 * This is useful when Claude Code accidentally kills the dev server process
 */
export async function restartDevServer(sessionId: string): Promise<RestartDevServerResult> {
  if (!sessionId) {
    const errorMsg = 'Session ID is required';
    console.error('❌ Restart dev server error:', errorMsg);
    return { success: false, error: errorMsg };
  }

  try {
    console.log('🔄 Calling restart-dev-server API for session:', sessionId);

    // Use the same API URL pattern as other Expo Go services
    const apiUrl = ENV.V0_API_URL.replace(/\/$/, '');
    console.log('🌐 Using API URL:', `${apiUrl}/api/session/restart-dev-server`);

    const response = await fetch(`${apiUrl}/api/session/restart-dev-server`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    console.log('📡 Restart dev server API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Restart dev server API Error:', response.status, errorText);
      throw new Error(`Failed to restart dev server: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log('✅ Dev server restarted successfully for session:', sessionId);
      return {
        success: true,
        message: result.message || 'Dev server restarted successfully',
      };
    } else {
      throw new Error(result.error || 'Failed to restart dev server');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Restart dev server error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
