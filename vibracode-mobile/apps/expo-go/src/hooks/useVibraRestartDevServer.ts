/**
 * Vibra Restart Dev Server Hook
 * Hook for restarting the dev server in E2B sandboxes
 */

import { useState, useCallback } from 'react';

import { restartDevServer, RestartDevServerResult } from '../services/VibraRestartDevServerService';

export function useVibraRestartDevServer() {
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restartServer = useCallback(async (sessionId: string): Promise<RestartDevServerResult> => {
    if (!sessionId) {
      const errorMsg = 'Session ID is required';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsRestarting(true);
    setError(null);

    try {
      console.log('🔄 Restarting dev server for session:', sessionId);

      const result = await restartDevServer(sessionId);

      if (result.success) {
        console.log('✅ Dev server restarted successfully:', sessionId);
        return result;
      } else {
        throw new Error(result.error || 'Failed to restart dev server');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Restart dev server error:', errorMsg);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsRestarting(false);
    }
  }, []);

  return {
    restartServer,
    isRestarting,
    error,
  };
}
