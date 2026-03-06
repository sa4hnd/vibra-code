/**
 * Vibra Resume Service
 * Simple service to call v0-clone's resume API before opening projects
 */

import { ENV } from '../config/env';

export interface ResumeSessionResult {
  success: boolean;
  sessionId: string;
  message?: string;
  error?: string;
}

/**
 * Calls the v0-clone resume API to wake up paused E2B sandboxes
 * This is the same API that v0-clone uses when refreshing session pages
 * @param sessionId - The E2B sandbox session ID
 * @param clerkId - The Clerk user ID for ownership verification (REQUIRED for security)
 */
export async function resumeVibraSession(sessionId: string, clerkId?: string): Promise<ResumeSessionResult> {
  if (!sessionId) {
    const errorMsg = 'Session ID is required';
    console.error('❌ Resume session error:', errorMsg);
    return { success: false, sessionId: '', error: errorMsg };
  }

  if (!clerkId) {
    const errorMsg = 'Clerk ID is required for session resume';
    console.error('❌ Resume session error:', errorMsg);
    return { success: false, sessionId, error: errorMsg };
  }

  try {
    console.log('🔄 Calling resume API for session:', sessionId, 'clerkId:', clerkId);

    // Use the same API URL pattern as other Expo Go services
    const apiUrl = ENV.V0_API_URL.replace(/\/$/, '');
    console.log('🌐 Using API URL:', `${apiUrl}/api/session/resume`);

    // Call the same resume API that v0-clone uses
    // This will wake up the E2B sandbox if it's paused
    // SECURITY: Include clerkId for ownership verification
    const response = await fetch(`${apiUrl}/api/session/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, clerkId }),
    });

    console.log('📡 Resume API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Resume API Error:', response.status, errorText);
      throw new Error(`Failed to resume session: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log('✅ Session resumed successfully:', sessionId);
      return {
        success: true,
        sessionId,
        message: result.message || 'Session resumed successfully',
      };
    } else {
      throw new Error(result.error || 'Failed to resume session');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Resume session error:', errorMsg);
    return { success: false, sessionId, error: errorMsg };
  }
}
