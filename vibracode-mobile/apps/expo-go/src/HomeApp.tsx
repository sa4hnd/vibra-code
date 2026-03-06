import { darkTheme, lightTheme } from '@expo/styleguide-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Assets as StackAssets } from '@react-navigation/elements';
import { Asset } from 'expo-asset';
import { ThemePreference, ThemeProvider } from 'expo-dev-client-components';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { Linking, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import url from 'url';

import ApolloClient from './api/ApolloClient';
import { ColorTheme } from './constants/Colors';
import {
  AppPlatform,
  HomeScreenDataDocument,
  HomeScreenDataQuery,
  HomeScreenDataQueryVariables,
  Home_CurrentUserActorDocument,
  Home_CurrentUserActorQuery,
  Home_CurrentUserActorQueryVariables,
} from './graphql/types';
import Navigation from './navigation/Navigation';
import HistoryActions from './redux/HistoryActions';
import { useDispatch, useSelector } from './redux/Hooks';
import SessionActions from './redux/SessionActions';
import SettingsActions from './redux/SettingsActions';
import LocalStorage from './storage/LocalStorage';
import { useAccountName } from './utils/AccountNameContext';
import { useInitialData } from './utils/InitialDataContext';
import { safeOpenProject } from './utils/SafeProjectOpener';
import { initializeSafeUpdates } from './utils/SafeUpdatesModule';
import * as UrlUtils from './utils/UrlUtils';
import addListenerWithNativeCallback from './utils/addListenerWithNativeCallback';
import { preloadOnboardingImages } from './utils/imagePreloader';

// Download and cache stack assets, don't block loading on this though
Asset.loadAsync(StackAssets);

function useSplashScreenWhileLoadingResources(loadResources: () => Promise<void>) {
  const [isSplashScreenShown, setSplashScreenShown] = React.useState(true);
  React.useEffect(() => {
    (async () => {
      // await SplashScreen.preventAutoHideAsync(); // this is called in App (main component of the application)
      await loadResources();
      setSplashScreenShown(false);
    })();
  }, []);
  React.useEffect(() => {
    (async () => {
      if (!isSplashScreenShown) {
        await SplashScreen.hideAsync();
      }
    })();
  }, [isSplashScreenShown]);

  return isSplashScreenShown;
}

export default function HomeApp() {
  const colorScheme = useColorScheme();
  const preferredAppearance = useSelector((data) => data.settings.preferredAppearance);
  const dispatch = useDispatch();
  const { setAccountName } = useAccountName();

  // Fonts are now embedded at build time via expo-font config plugin in app.json
  // No need to load them at runtime - they're already available
  // Just verify they're loaded for debugging
  const [fontsLoaded] = React.useState(true); // Fonts are embedded, so always loaded
  const fontError = null;

  // Track if we've initialized state (to avoid multiple calls)
  const [hasInitialized, setHasInitialized] = React.useState(false);

  // Log font status for debugging
  React.useEffect(() => {
    console.log('🔍 Font status (embedded at build time):', {
      hasIoniconsFont: !!Ionicons.font,
      ioniconsFontKeys: Ionicons.font ? Object.keys(Ionicons.font) : [],
      fontsEmbedded: true,
    });

    // Verify fonts are available
    if (Ionicons.font) {
      const fontKeys = Object.keys(Ionicons.font);
      for (const name of fontKeys) {
        try {
          if (Font.isLoaded(name)) {
            console.log(`✅ Font "${name}" is loaded`);
          } else {
            console.log(
              `⚠️ Font "${name}" not verified by Font.isLoaded (may still work if embedded)`
            );
          }
        } catch (e) {
          console.log(`⚠️ Could not check font "${name}"`);
        }
      }
    }
  }, []);

  // Initialize state once fonts are loaded
  React.useEffect(() => {
    if (fontsLoaded && !hasInitialized) {
      setHasInitialized(true);
      initStateAsync().catch((error) => {
        console.error('Error initializing state:', error);
      });
    }
  }, [fontsLoaded, hasInitialized]);

  const isShowingSplashScreen = useSplashScreenWhileLoadingResources(async () => {
    // Wait for fonts to load before marking as ready
    if (!fontsLoaded) {
      // Keep waiting
    }
    // Fonts are loaded or errored, initialization will happen in useEffect above
  });

  const { setCurrentUserData, setHomeScreenData } = useInitialData();

  React.useEffect(() => {
    addProjectHistoryListener();
    addForegroundHomeListener();
  }, []);

  React.useEffect(() => {
    if (!isShowingSplashScreen && Platform.OS === 'ios') {
      // If Expo Go is opened via deep linking, we'll get the URL here
      Linking.getInitialURL().then(async (initialUrl) => {
        if (initialUrl && shouldOpenUrl(initialUrl)) {
          try {
            // Use safe project opening to prevent SQLite constraint errors
            const projectId = `initial-url-${Date.now()}`;
            await safeOpenProject(initialUrl, projectId);
          } catch (error) {
            console.error('Failed to open initial URL safely:', error);
            // Fallback to direct opening if safe opening fails
            Linking.openURL(UrlUtils.convertToExpoUrl(initialUrl));
          }
        }
      });

      // Note: Orange menu visibility is now managed automatically by native code
      // based on which app is visible (home vs non-home apps)
    }
  }, [isShowingSplashScreen]);

  const addProjectHistoryListener = () => {
    addListenerWithNativeCallback('ExponentKernel.addHistoryItem', async (event) => {
      let { manifestUrl, manifest, manifestString } = event;
      if (!manifest && manifestString) {
        manifest = JSON.parse(manifestString);
      }
      dispatch(HistoryActions.addHistoryItem(manifestUrl, manifest));

      // Note: Orange menu is now automatically shown by native code when project becomes visible
    });
  };

  const addForegroundHomeListener = () => {
    addListenerWithNativeCallback('ExponentKernel.foregroundHome', async () => {
      // Note: Orange menu is now automatically hidden by native code when home becomes visible
    });
  };

  const initStateAsync = async () => {
    try {
      dispatch(SettingsActions.loadSettings());
      dispatch(HistoryActions.loadHistory());

      const storedSession = await LocalStorage.getSessionAsync();

      if (storedSession) {
        dispatch(SessionActions.setSession(storedSession));
      }

      const [currentUserQueryResult, persistedCurrentAccount] = await Promise.all([
        ApolloClient.query<Home_CurrentUserActorQuery, Home_CurrentUserActorQueryVariables>({
          query: Home_CurrentUserActorDocument,
          context: { headers: { 'expo-session': storedSession?.sessionSecret } },
        }),
        AsyncStorage.getItem('currentAccount'),
        // Fonts are now loaded via useFonts hook above, so we don't need to load them here
        Promise.resolve(),
        Font.loadAsync({
          'Inter-Black': require('./assets/Inter/Inter-Black.otf'),
          'Inter-BlackItalic': require('./assets/Inter/Inter-BlackItalic.otf'),
          'Inter-Bold': require('./assets/Inter/Inter-Bold.otf'),
          'Inter-BoldItalic': require('./assets/Inter/Inter-BoldItalic.otf'),
          'Inter-ExtraBold': require('./assets/Inter/Inter-ExtraBold.otf'),
          'Inter-ExtraBoldItalic': require('./assets/Inter/Inter-ExtraBoldItalic.otf'),
          'Inter-ExtraLight': require('./assets/Inter/Inter-ExtraLight.otf'),
          'Inter-ExtraLightItalic': require('./assets/Inter/Inter-ExtraLightItalic.otf'),
          'Inter-Regular': require('./assets/Inter/Inter-Regular.otf'),
          'Inter-Italic': require('./assets/Inter/Inter-Italic.otf'),
          'Inter-Light': require('./assets/Inter/Inter-Light.otf'),
          'Inter-LightItalic': require('./assets/Inter/Inter-LightItalic.otf'),
          'Inter-Medium': require('./assets/Inter/Inter-Medium.otf'),
          'Inter-MediumItalic': require('./assets/Inter/Inter-MediumItalic.otf'),
          'Inter-SemiBold': require('./assets/Inter/Inter-SemiBold.otf'),
          'Inter-SemiBoldItalic': require('./assets/Inter/Inter-SemiBoldItalic.otf'),
          'Inter-Thin': require('./assets/Inter/Inter-Thin.otf'),
          'Inter-ThinItalic': require('./assets/Inter/Inter-ThinItalic.otf'),
        }),
        // Preload onboarding images in the background (non-blocking)
        preloadOnboardingImages().catch((error) => {
          console.warn('Failed to preload onboarding images:', error);
        }),
        // Initialize safe updates system to prevent SQLite constraint errors
        initializeSafeUpdates().catch((error) => {
          console.warn('Failed to initialize safe updates:', error);
        }),
      ]);

      if (currentUserQueryResult.data && currentUserQueryResult.data.meUserActor) {
        let firstLoadAccountName = persistedCurrentAccount;
        if (firstLoadAccountName) {
          // if there was a persisted account, and it matches the accounts available to the current user, use it
          if (
            [
              currentUserQueryResult.data.meUserActor.username,
              ...currentUserQueryResult.data.meUserActor.accounts.map((account) => account.name),
            ].includes(firstLoadAccountName)
          ) {
            setAccountName(firstLoadAccountName);
          } else {
            // if this persisted account is stale, clear it
            await AsyncStorage.removeItem('currentAccount');
          }
        } else {
          // if there was no persisted account, use the current user's personal account
          firstLoadAccountName = currentUserQueryResult.data.meUserActor.username;
          setAccountName(firstLoadAccountName);
        }

        // set initial data for home screen

        setCurrentUserData(currentUserQueryResult.data);

        if (firstLoadAccountName) {
          const homeScreenData = await ApolloClient.query<
            HomeScreenDataQuery,
            HomeScreenDataQueryVariables
          >({
            query: HomeScreenDataDocument,
            variables: {
              accountName: firstLoadAccountName,
              platform: Platform.OS === 'ios' ? AppPlatform.Ios : AppPlatform.Android,
            },
            context: { headers: { 'expo-session': storedSession?.sessionSecret } },
          });

          setHomeScreenData(homeScreenData.data);
        }
      } else {
        // if there is no current user data, clear the accountName
        setAccountName(undefined);
      }
    } finally {
      return;
    }
  };

  // Wait for fonts to load (or error) before showing the app
  // In production, fonts might work even if loading fails
  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (isShowingSplashScreen) {
    return null;
  }

  // Force dark mode
  const theme = 'dark';

  const backgroundColor =
    theme === 'dark' ? darkTheme.background.default : lightTheme.background.default;

  return (
    <ThemeProvider themePreference={theme as ThemePreference}>
      <View
        style={[
          styles.container,
          {
            backgroundColor,
          },
        ]}>
        <Navigation theme={theme === 'light' ? ColorTheme.LIGHT : ColorTheme.DARK} />
      </View>
    </ThemeProvider>
  );
}

// Certain links (i.e. 'expo.dev/expo-go') should just open the HomeScreen
function shouldOpenUrl(urlString: string) {
  const parsedUrl = url.parse(urlString);
  return !(
    (parsedUrl.hostname === 'expo.io' || parsedUrl.hostname === 'expo.dev') &&
    parsedUrl.pathname === '/expo-go'
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
