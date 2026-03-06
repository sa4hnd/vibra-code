import { useEffect, useRef } from 'react';

import { vibeNotificationService } from '../services/VibraNotificationService';

// Define Session interface based on the convex schema
interface Session {
  _id: string;
  createdBy?: string;
  sessionId?: string;
  name: string;
  tunnelUrl?: string;
  repository?: string;
  templateId: string;
  pullRequest?: any;
  status:
    | 'IN_PROGRESS'
    | 'CLONING_REPO'
    | 'INSTALLING_DEPENDENCIES'
    | 'STARTING_DEV_SERVER'
    | 'CREATING_TUNNEL'
    | 'CUSTOM'
    | 'RUNNING';
  statusMessage?: string;
}

interface UseAppCompletionNotificationsProps {
  session: Session | null | undefined;
  enabled?: boolean;
}

/**
 * Hook that monitors session status changes and sends notifications when app generation is completed
 */
export const useAppCompletionNotifications = ({
  session,
  enabled = true,
}: UseAppCompletionNotificationsProps) => {
  const previousStatusRef = useRef<string | null>(null);
  const hasNotifiedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !session) {
      return;
    }

    const currentStatus = session.status;
    const previousStatus = previousStatusRef.current;

    // Update previous status
    previousStatusRef.current = currentStatus;

    // Check if app generation just completed
    const justCompleted =
      currentStatus === 'RUNNING' &&
      previousStatus !== 'RUNNING' &&
      previousStatus !== null && // Not the first load
      session.tunnelUrl && // Has tunnel URL
      !hasNotifiedRef.current; // Haven't notified yet

    if (justCompleted) {
      console.log('🎉 App generation completed! Sending notification...');
      hasNotifiedRef.current = true;

      // Send notification
      vibeNotificationService.sendAppCompletionNotification(session).catch((error) => {
        console.error('Failed to send app completion notification:', error);
      });
    }

    // Reset notification flag if session changes (new session)
    if (previousStatus === null) {
      hasNotifiedRef.current = false;
    }
  }, [session?.status, session?.tunnelUrl, session?._id, enabled]);

  // Reset notification flag when session changes
  useEffect(() => {
    hasNotifiedRef.current = false;
  }, [session?._id]);
};
