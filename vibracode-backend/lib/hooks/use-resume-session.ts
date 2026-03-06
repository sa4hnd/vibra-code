import { useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

interface ResumeSessionResult {
  success: boolean;
  sessionId: string;
  message?: string;
  error?: string;
}

export function useResumeSession() {
  const [isResuming, setIsResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  const resumeSession = useCallback(async (sessionId: string): Promise<ResumeSessionResult> => {
    if (!sessionId) {
      const errorMsg = 'Session ID is required';
      setError(errorMsg);
      return { success: false, sessionId: '', error: errorMsg };
    }

    if (!user?.id) {
      const errorMsg = 'Authentication required';
      setError(errorMsg);
      return { success: false, sessionId: '', error: errorMsg };
    }

    setIsResuming(true);
    setError(null);

    try {
      console.log('🔄 Attempting to resume session:', sessionId);

      // Call the resume API to actually connect to and resume the E2B sandbox
      const response = await fetch('/api/session/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, clerkId: user.id }),
      });

      if (!response.ok) {
        throw new Error(`Failed to resume session: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Session resumed successfully:', sessionId);
        return {
          success: true,
          sessionId,
          message: result.message || 'Session resumed successfully'
        };
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
  }, [user?.id]);

  return {
    resumeSession,
    isResuming,
    error,
  };
}
