import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ENV } from '../config/env';

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

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class VibraNotificationService {
  private static instance: VibraNotificationService;
  private notificationListeners: (() => void)[] = [];
  private registeredPushToken: string | null = null;

  static getInstance(): VibraNotificationService {
    if (!VibraNotificationService.instance) {
      VibraNotificationService.instance = new VibraNotificationService();
    }
    return VibraNotificationService.instance;
  }

  /**
   * Get the Expo Push Token for this device
   * This is used for receiving real push notifications when the app is backgrounded/closed
   */
  async getExpoPushToken(): Promise<string | null> {
    try {
      // Check if we already have permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // If not, request permission
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('📱 Push notification permission not granted');
        return null;
      }

      // Get the Expo Push Token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      console.log('📱 Got Expo Push Token:', tokenData.data);
      return tokenData.data;
    } catch (error) {
      console.error('Error getting Expo Push Token:', error);
      return null;
    }
  }

  /**
   * Register the device's push token with the backend
   * This enables real push notifications even when the app is closed
   */
  async registerPushTokenWithBackend(clerkId: string): Promise<boolean> {
    try {
      const pushToken = await this.getExpoPushToken();
      if (!pushToken) {
        console.log('📱 No push token available, skipping registration');
        return false;
      }

      // Don't re-register the same token
      if (this.registeredPushToken === pushToken) {
        console.log('📱 Push token already registered');
        return true;
      }

      const apiUrl = ENV.V0_API_URL.replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/push/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushToken,
          clerkId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📱 Failed to register push token:', errorText);
        return false;
      }

      const result = await response.json();
      if (result.success) {
        this.registeredPushToken = pushToken;
        console.log('📱 Push token registered successfully with backend');
        return true;
      } else {
        console.error('📱 Backend rejected push token:', result.error);
        return false;
      }
    } catch (error) {
      console.error('📱 Error registering push token with backend:', error);
      return false;
    }
  }

  /**
   * Unregister the push token from the backend
   * Call this when the user logs out
   */
  async unregisterPushTokenFromBackend(clerkId: string): Promise<boolean> {
    try {
      const apiUrl = ENV.V0_API_URL.replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/push/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkId,
        }),
      });

      if (!response.ok) {
        console.error('📱 Failed to unregister push token');
        return false;
      }

      this.registeredPushToken = null;
      console.log('📱 Push token unregistered from backend');
      return true;
    } catch (error) {
      console.error('📱 Error unregistering push token:', error);
      return false;
    }
  }

  /**
   * Configure Android notification channel (required for Android)
   */
  async setupAndroidChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('app_ready', {
        name: 'App Ready',
        description: 'Notifications when your app is ready to preview',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4CAF50',
      });
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Send app generation completion notification
   */
  async sendAppCompletionNotification(session: Session): Promise<void> {
    try {
      const isEnabled = await this.areNotificationsEnabled();
      if (!isEnabled) {
        console.log('Notifications not enabled, skipping app completion notification');
        return;
      }

      const appName = session.name || 'Your app';
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 App Generation Complete!',
          body: `${appName} is ready to use. Tap to open it.`,
          data: {
            type: 'app_completion',
            sessionId: session._id,
            appName,
            tunnelUrl: session.tunnelUrl,
            timestamp: Date.now(),
          },
        },
        trigger: null, // Send immediately
      });

      console.log('App completion notification sent:', notificationId);
    } catch (error) {
      console.error('Error sending app completion notification:', error);
    }
  }

  /**
   * Send token exhaustion warning notification
   */
  async sendMessageWarningNotification(remainingMessages: number): Promise<void> {
    try {
      const isEnabled = await this.areNotificationsEnabled();
      if (!isEnabled) {
        console.log('Notifications not enabled, skipping token warning notification');
        return;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Messages Running Low',
          body: `You have ${remainingMessages} messages remaining. Consider upgrading to Pro for unlimited access.`,
          data: {
            type: 'message_warning',
            remainingMessages,
            timestamp: Date.now(),
          },
        },
        trigger: null, // Send immediately
      });

      console.log('Token warning notification sent:', notificationId);
    } catch (error) {
      console.error('Error sending token warning notification:', error);
    }
  }

  /**
   * Send billing notification
   */
  async sendBillingNotification(
    type: 'payment_success' | 'payment_failed' | 'subscription_renewed',
    details?: any
  ): Promise<void> {
    try {
      const isEnabled = await this.areNotificationsEnabled();
      if (!isEnabled) {
        console.log('Notifications not enabled, skipping billing notification');
        return;
      }

      let title = '';
      let body = '';

      switch (type) {
        case 'payment_success':
          title = '✅ Payment Successful';
          body = 'Your subscription has been activated. Enjoy unlimited access!';
          break;
        case 'payment_failed':
          title = '❌ Payment Failed';
          body = 'There was an issue with your payment. Please update your payment method.';
          break;
        case 'subscription_renewed':
          title = '🔄 Subscription Renewed';
          body = 'Your subscription has been renewed successfully.';
          break;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'billing',
            billingType: type,
            details,
            timestamp: Date.now(),
          },
        },
        trigger: null, // Send immediately
      });

      console.log('Billing notification sent:', notificationId);
    } catch (error) {
      console.error('Error sending billing notification:', error);
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<void> {
    try {
      const isEnabled = await this.areNotificationsEnabled();
      if (!isEnabled) {
        throw new Error('Notifications not enabled');
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Vibra Test Notification',
          body: 'This is a test notification from Vibra! 🚀',
          data: {
            type: 'test',
            timestamp: Date.now(),
          },
        },
        trigger: null, // Send immediately
      });

      console.log('Test notification sent:', notificationId);
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }

  /**
   * Add notification response listener
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): () => void {
    const listener = Notifications.addNotificationResponseReceivedListener(callback);
    this.notificationListeners.push(listener.remove);
    return listener.remove;
  }

  /**
   * Add notification received listener
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): () => void {
    const listener = Notifications.addNotificationReceivedListener(callback);
    this.notificationListeners.push(listener.remove);
    return listener.remove;
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    this.notificationListeners.forEach((remove) => remove());
    this.notificationListeners = [];
  }
}

// Export singleton instance
export const vibeNotificationService = VibraNotificationService.getInstance();
