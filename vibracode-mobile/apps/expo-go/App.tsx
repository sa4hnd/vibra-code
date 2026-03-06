import { ApolloProvider } from '@apollo/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from 'react-native-paper';
import { enableScreens } from 'react-native-screens';
import { Provider as ReduxProvider } from 'react-redux';

import HomeApp from './src/HomeApp';
import ApolloClient from './src/api/ApolloClient';
import Store from './src/redux/Store';
import './src/menu/DevMenuApp';
import './src/menu/OrangeMenuApp';
import { AccountNameProvider } from './src/utils/AccountNameContext';
import { InitialDataProvider } from './src/utils/InitialDataContext';
import { ClerkProvider, publishableKey } from './src/config/clerk';

import { tokenCache } from '@clerk/clerk-expo/token-cache';

import { trpc, trpcClient } from './src/config/trpc';
import { VibeAuthProvider } from './src/contexts/VibeAuthContext';
import { RevenueCatProvider } from './src/contexts/RevenueCatContext';

import { ConvexProvider } from 'convex/react';

import convex from './src/config/convex';
import { EnvBridge } from './src/native/EnvBridge';

if (Platform.OS === 'android') {
  enableScreens(false);
}
SplashScreen.preventAutoHideAsync();

// Sync env vars to native iOS code at startup
if (Platform.OS === 'ios') {
  EnvBridge.syncEnvVars().catch((err) => {
    console.warn('[App] Failed to sync env vars to native:', err);
  });
}

// Create a query client for React Query
const queryClient = new QueryClient();

export default function App() {
  const theme = useTheme();
  // Removing the background color of the active tab
  // See https://github.com/callstack/react-native-paper/issues/3554
  theme.colors.secondaryContainer = 'transparent';

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProvider client={convex}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <ReduxProvider store={Store}>
                <ApolloProvider client={ApolloClient}>
                  <InitialDataProvider>
                    <AccountNameProvider>
                      <VibeAuthProvider>
                        <RevenueCatProvider>
                          <HomeApp />
                        </RevenueCatProvider>
                      </VibeAuthProvider>
                    </AccountNameProvider>
                  </InitialDataProvider>
                </ApolloProvider>
              </ReduxProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </trpc.Provider>
      </ConvexProvider>
    </ClerkProvider>
  );
}
