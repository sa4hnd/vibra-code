import {
  HomeFilledIcon,
  SettingsFilledIcon,
  UserFilledIcon,
  AddPhotoIcon,
} from '@expo/styleguide-native';
import { useUser } from '@clerk/clerk-expo';
import { NavigationContainer, useTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import * as Notifications from 'expo-notifications';
import * as React from 'react';
import { Platform, StyleSheet, Linking } from 'react-native';

import BottomTab, { getNavigatorProps } from './BottomTabNavigator';
import {
  HomeStackRoutes,
  SettingsStackRoutes,
  ModalStackRoutes,
  CreateAppStackRoutes,
  ProfileStackRoutes,
} from './Navigation.types';
import defaultNavigationOptions from './defaultNavigationOptions';
import DiagnosticsIcon from '../components/Icons';
import { ColorTheme } from '../constants/Colors';
import Themes from '../constants/Themes';
import { AccountModal } from '../screens/AccountModal';
import { BranchDetailsScreen } from '../screens/BranchDetailsScreen';
import { BranchListScreen } from '../screens/BranchListScreen';
import { DiagnosticsStackScreen } from '../screens/DiagnosticsScreen';
import { FeedbackFormScreen } from '../screens/FeedbackFormScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProjectScreen } from '../screens/ProjectScreen';
import { ProjectsListScreen } from '../screens/ProjectsListScreen';
import QRCodeScreen from '../screens/QRCodeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SnacksListScreen } from '../screens/SnacksListScreen';
import { VibraAppLoadingScreen } from '../screens/VibraAppLoadingScreen';
import { VibraChatScreen } from '../screens/VibraChatScreen';
import { VibraCreateAppScreen } from '../screens/VibraCreateAppScreen';
import { VibraProfileScreen } from '../screens/VibraProfileScreen';
import { resumeVibraSession } from '../services/VibraResumeService';
import { safeOpenProject } from '../utils/SafeProjectOpener';
import {
  alertWithCameraPermissionInstructions,
  requestCameraPermissionsAsync,
} from '../utils/PermissionUtils';

// TODO(Bacon): Do we need to create a new one each time?
const HomeStack = createStackNavigator<HomeStackRoutes>();
const SettingsStack = createStackNavigator<SettingsStackRoutes>();
const CreateAppStack = createStackNavigator<CreateAppStackRoutes>();
const ProfileStack = createStackNavigator<ProfileStackRoutes>();

// We have to disable this option on Android to not use `react-native-screen`,
// which aren't correcly installed in the Home app.
const shouldDetachInactiveScreens = Platform.OS !== 'android';

function useThemeName() {
  const theme = useTheme();
  return theme.dark ? ColorTheme.DARK : ColorTheme.LIGHT;
}

export function HomeStackScreen() {
  const themeName = useThemeName();

  return (
    <HomeStack.Navigator
      initialRouteName="Home"
      detachInactiveScreens={shouldDetachInactiveScreens}
      screenOptions={defaultNavigationOptions(themeName)}>
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <HomeStack.Screen
        name="ProjectsList"
        component={ProjectsListScreen}
        options={{
          title: 'Projects',
        }}
      />
      <HomeStack.Screen
        name="SnacksList"
        component={SnacksListScreen}
        options={{
          title: 'Snacks',
        }}
      />
      <HomeStack.Screen
        name="ProjectDetails"
        component={ProjectScreen}
        options={{
          title: 'Project',
        }}
      />
      <HomeStack.Screen
        name="Branches"
        component={BranchListScreen}
        options={{
          title: 'Branches',
        }}
      />
      <HomeStack.Screen
        name="BranchDetails"
        component={BranchDetailsScreen}
        options={{
          title: 'Branch',
        }}
      />
      <HomeStack.Screen
        name="FeedbackForm"
        component={FeedbackFormScreen}
        options={{
          title: 'Share your feedback',
        }}
      />
      <HomeStack.Screen
        name="VibraCreateApp"
        component={VibraCreateAppScreen}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: '#1A1A1A' },
          ...TransitionPresets.SlideFromRightIOS,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 200, // Faster transition
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
          },
        }}
      />
      <HomeStack.Screen
        name="VibraAppLoading"
        component={VibraAppLoadingScreen}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: '#1A1A1A' },
          ...TransitionPresets.SlideFromRightIOS,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 200, // Faster transition
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
          },
        }}
      />
      <HomeStack.Screen
        name="VibraChat"
        component={VibraChatScreen}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: '#1A1A1A' },
          ...TransitionPresets.SlideFromRightIOS,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 200, // Faster transition
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
          },
        }}
      />
    </HomeStack.Navigator>
  );
}

function SettingsStackScreen() {
  const themeName = useThemeName();

  return (
    <SettingsStack.Navigator
      initialRouteName="Settings"
      detachInactiveScreens={shouldDetachInactiveScreens}
      screenOptions={defaultNavigationOptions(themeName)}>
      <SettingsStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerBackImage: () => <></>,
        }}
      />
    </SettingsStack.Navigator>
  );
}

function CreateAppStackScreen() {
  const themeName = useThemeName();

  return (
    <CreateAppStack.Navigator
      initialRouteName="CreateApp"
      detachInactiveScreens={shouldDetachInactiveScreens}
      screenOptions={defaultNavigationOptions(themeName)}>
      <CreateAppStack.Screen
        name="CreateApp"
        component={VibraCreateAppScreen}
        options={{
          headerShown: false,
        }}
      />
      <CreateAppStack.Screen
        name="VibraAppLoading"
        component={VibraAppLoadingScreen}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: '#1A1A1A' },
          ...TransitionPresets.SlideFromRightIOS,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
          },
        }}
      />
      <CreateAppStack.Screen
        name="VibraChat"
        component={VibraChatScreen}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: '#1A1A1A' },
          ...TransitionPresets.SlideFromRightIOS,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
          },
        }}
      />
    </CreateAppStack.Navigator>
  );
}

function ProfileStackScreen() {
  const themeName = useThemeName();

  return (
    <ProfileStack.Navigator
      initialRouteName="Profile"
      detachInactiveScreens={shouldDetachInactiveScreens}
      screenOptions={defaultNavigationOptions(themeName)}>
      <ProfileStack.Screen
        name="Profile"
        component={VibraProfileScreen}
        options={{
          headerShown: false,
        }}
      />
    </ProfileStack.Navigator>
  );
}

const RootStack = createStackNavigator();

function TabNavigator(props: { theme: string }) {
  return (
    <BottomTab.Navigator
      {...getNavigatorProps(props)}
      initialRouteName="HomeStack"
      detachInactiveScreens={shouldDetachInactiveScreens}>
      <BottomTab.Screen
        name="HomeStack"
        component={HomeStackScreen}
        options={{
          tabBarIcon: (props: any) =>
            Platform.OS === 'ios' ? (
              { sfSymbolName: 'house.fill' }
            ) : (
              <HomeFilledIcon {...props} style={styles.icon} size={24} />
            ),
          tabBarLabel: 'Home',
        }}
      />
      <BottomTab.Screen
        name="CreateAppStack"
        component={CreateAppStackScreen}
        options={{
          tabBarIcon: (props: any) =>
            Platform.OS === 'ios' ? (
              { sfSymbolName: 'plus.circle.fill' }
            ) : (
              <AddPhotoIcon {...props} style={styles.icon} size={24} />
            ),
          tabBarLabel: 'Create',
        }}
      />
      <BottomTab.Screen
        name="ProfileStack"
        component={ProfileStackScreen}
        options={{
          tabBarIcon: (props: any) =>
            Platform.OS === 'ios' ? (
              { sfSymbolName: 'person.fill' }
            ) : (
              <UserFilledIcon {...props} style={styles.icon} size={24} />
            ),
          tabBarLabel: 'Profile',
        }}
      />
    </BottomTab.Navigator>
  );
}

const ModalStack = createStackNavigator<ModalStackRoutes>();

export default (props: { theme: ColorTheme }) => {
  const navigationRef = useNavigationContainerRef<ModalStackRoutes>();
  const isNavigationReadyRef = React.useRef(false);
  const initialURLWasConsumed = React.useRef(false);
  const { user } = useUser();

  // Handle notification taps (deep linking for push notifications)
  React.useEffect(() => {
    // Handle notification when app is opened from a notification tap
    const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      console.log('📱 Notification tapped:', data);

      // Handle "app_ready" or "app_completion" notification - open the app directly
      if ((data?.type === 'app_ready' || data?.type === 'app_completion') && data?.sessionId && data?.tunnelUrl) {
        console.log('📱 Opening app directly from notification:', data.sessionId);

        try {
          // Resume session first (same as VibraProjectsList behavior)
          // SECURITY: Pass clerkId for ownership verification
          // Use createdBy from notification data if available, otherwise use current user
          const clerkId = data?.createdBy || user?.id;
          console.log('🔄 Resuming session before opening:', data.sessionId, 'clerkId:', clerkId);
          const resumeResult = await resumeVibraSession(data.sessionId, clerkId);

          if (resumeResult.success) {
            console.log('✅ Session resumed successfully');
          } else {
            console.warn('⚠️ Session resume failed, but continuing:', resumeResult.error);
          }

          // Open the app directly using safeOpenProject
          console.log('📱 Opening project URL:', data.tunnelUrl);
          await safeOpenProject(data.tunnelUrl, data.sessionId);
          console.log('✅ Project opened successfully from notification');
        } catch (error) {
          console.error('❌ Failed to open project from notification:', error);
        }
      }
    };

    // Listen for notification taps while app is running
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    // Check if app was opened from a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      responseListener.remove();
    };
  }, [user]);

  React.useEffect(() => {
    const handleDeepLinks = async ({ url }: { url: string | null }) => {
      if (Platform.OS === 'ios' || !url || !isNavigationReadyRef.current) {
        return;
      }
      const nav = navigationRef.current;
      if (!nav) {
        return;
      }

      if (url.startsWith('expo-home://qr-scanner')) {
        if (await requestCameraPermissionsAsync()) {
          nav.navigate('QRCode');
        } else {
          await alertWithCameraPermissionInstructions();
        }
      }
    };
    if (!initialURLWasConsumed.current) {
      initialURLWasConsumed.current = true;
      Linking.getInitialURL().then((url) => {
        handleDeepLinks({ url });
      });
    }

    const deepLinkSubscription = Linking.addEventListener('url', handleDeepLinks);

    return () => {
      isNavigationReadyRef.current = false;
      deepLinkSubscription.remove();
    };
  }, []);

  return (
    <NavigationContainer
      theme={Themes[props.theme]}
      ref={navigationRef}
      onReady={() => {
        isNavigationReadyRef.current = true;
      }}>
      <ModalStack.Navigator
        initialRouteName="RootStack"
        detachInactiveScreens={shouldDetachInactiveScreens}
        screenOptions={({ route: _route, navigation: _navigation }) => ({
          headerShown: false,
          gestureEnabled: true,
          cardOverlayEnabled: true,
          cardStyle: { backgroundColor: 'transparent' },
          presentation: 'modal',
          // NOTE(brentvatne): it is unclear what this was intended for, it doesn't appear to be needed?
          // headerStatusBarHeight: navigation.getState().routes.indexOf(route) > 0 ? 0 : undefined,
          ...TransitionPresets.ModalPresentationIOS,
        })}>
        <ModalStack.Screen name="RootStack">
          {() => (
            <RootStack.Navigator
              initialRouteName="Tabs"
              detachInactiveScreens={shouldDetachInactiveScreens}
              screenOptions={{ presentation: 'modal' }}>
              <RootStack.Screen name="Tabs" options={{ headerShown: false }}>
                {() => <TabNavigator theme={props.theme} />}
              </RootStack.Screen>
              <RootStack.Screen
                name="Account"
                component={AccountModal}
                options={({ route: _route, navigation: _navigation }) => ({
                  headerShown: false,
                  ...(Platform.OS === 'ios' && {
                    gestureEnabled: true,
                    cardOverlayEnabled: true,
                    // NOTE(brentvatne): it is unclear what this was intended for, it doesn't appear to be needed?
                    // headerStatusBarHeight:
                    //   navigation
                    //     .getState()
                    //     .routes.findIndex((r: RouteProp<any, any>) => r.key === route.key) > 0
                    //     ? 0
                    //     : undefined,
                    ...TransitionPresets.ModalPresentationIOS,
                  }),
                })}
              />
            </RootStack.Navigator>
          )}
        </ModalStack.Screen>
        <ModalStack.Screen name="QRCode" component={QRCodeScreen} />
      </ModalStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  icon: {
    marginBottom: Platform.OS === 'ios' ? -3 : 0,
  },
});
