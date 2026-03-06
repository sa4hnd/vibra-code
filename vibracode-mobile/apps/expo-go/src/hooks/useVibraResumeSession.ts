/**
 * Vibra Resume Hook
 * Simple hook for calling resume API before opening projects
 */

import { useState, useCallback } from 'react';

import { resumeVibraSession, ResumeSessionResult } from '../services/VibraResumeService';

export function useVibraResumeSession() {
  const [isResuming, setIsResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resumeSession = useCallback(async (sessionId: string, clerkId?: string): Promise<ResumeSessionResult> => {
    if (!sessionId) {
      const errorMsg = 'Session ID is required';
      setError(errorMsg);
      return { success: false, sessionId: '', error: errorMsg };
    }

    if (!clerkId) {
      const errorMsg = 'Clerk ID is required for session resume';
      setError(errorMsg);
      return { success: false, sessionId, error: errorMsg };
    }

    setIsResuming(true);
    setError(null);

    try {
      console.log('🔄 Resuming session:', sessionId, 'clerkId:', clerkId);

      const result = await resumeVibraSession(sessionId, clerkId);

      if (result.success) {
        console.log('✅ Session resumed successfully:', sessionId);
        return result;
      } else {
        throw new Error(result.error || 'Failed to resume session');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Resume session error:', errorMsg);
      setError(errorMsg);
      return { success: false, sessionId, error: errorMsg };
    } finally {
      setIsResuming(false);
    }
  }, []);

  return {
    resumeSession,
    isResuming,
    error,
  };
}
