import { useAuth, useUser } from '@clerk/clerk-expo';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Settings, Platform } from 'react-native';

import { trpc } from '../config/trpc';
import { vibeNotificationService } from '../services/VibraNotificationService';
import { resetOnboardingState } from '../utils/onboardingState';

interface VibraAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  signOut: () => void;
}

const VibraAuthContext = createContext<VibraAuthContextType | undefined>(undefined);

export const useVibraAuth = () => {
  const context = useContext(VibraAuthContext);
  if (!context) {
    throw new Error('useVibraAuth must be used within a VibraAuthProvider');
  }
  return context;
};

interface VibraAuthProviderProps {
  children: React.ReactNode;
}

export const VibraAuthProvider: React.FC<VibraAuthProviderProps> = ({ children }) => {
  const { isSignedIn, isLoaded, signOut: authSignOut } = useAuth();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const hasRegisteredPushToken = useRef(false);

  useEffect(() => {
    if (isLoaded) {
      setIsLoading(false);
    }
  }, [isLoaded]);

  // Register push token when user signs in
  useEffect(() => {
    const registerPushToken = async () => {
      if (isSignedIn && user?.id && !hasRegisteredPushToken.current) {
        hasRegisteredPushToken.current = true;
        console.log('📱 User signed in, registering push token...');

        // Setup Android notification channels first
        await vibeNotificationService.setupAndroidChannel();

        // Register push token with backend
        const success = await vibeNotificationService.registerPushTokenWithBackend(user.id);
        if (success) {
          console.log('📱 Push notifications enabled for background delivery');
        } else {
          // Reset flag so we can try again later
          hasRegisteredPushToken.current = false;
        }
      }
    };

    registerPushToken();
  }, [isSignedIn, user?.id]);

  // Save clerkId to NSUserDefaults for native iOS code to access
  // This enables native code to filter sessions by user (prevents cross-user session leakage)
  // Using Settings API which writes directly to NSUserDefaults on iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      if (isSignedIn && user?.id) {
        Settings.set({ CLERK_USER_ID: user.id });
        console.log('🔐 Saved clerkId to NSUserDefaults for session filtering');
      } else {
        Settings.set({ CLERK_USER_ID: '' });
      }
    }
  }, [isSignedIn, user?.id]);

  const signOut = async () => {
    try {
      // Unregister push token before signing out
      if (user?.id) {
        await vibeNotificationService.unregisterPushTokenFromBackend(user.id);
      }
      hasRegisteredPushToken.current = false;

      // Reset onboarding state so user sees login screen after sign out
      await resetOnboardingState();
      console.log('🔄 Onboarding state reset on sign out - will show login screen');

      await authSignOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const value: VibraAuthContextType = {
    isAuthenticated: isSignedIn || false,
    isLoading,
    user,
    signOut,
  };

  return <VibraAuthContext.Provider value={value}>{children}</VibraAuthContext.Provider>;
};
