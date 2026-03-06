import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const { EXEnvBridge } = NativeModules;

/**
 * Environment variable bridge for syncing React Native env vars to native iOS code.
 * Only available on iOS - uses native EXEnvBridge module.
 */
export const EnvBridge = {
  /**
   * Sync all EXPO_PUBLIC_* environment variables to NSUserDefaults.
   * This should be called once at app startup.
   * Native iOS code can then read these values via [EXEnvBridge getEnvValue:].
   */
  syncEnvVars: async (): Promise<{ success: boolean; syncedCount: number }> => {
    if (Platform.OS !== 'ios') {
      return { success: false, syncedCount: 0 };
    }
    if (!EXEnvBridge) {
      console.warn('[EnvBridge] EXEnvBridge native module not available');
      return { success: false, syncedCount: 0 };
    }

    // Collect all EXPO_PUBLIC_* env vars from process.env and Constants
    const envVars: Record<string, string> = {};

    // From process.env (via babel-plugin-transform-inline-environment-variables or dotenv)
    const envKeys = [
      'EXPO_PUBLIC_CONVEX_URL',
      'EXPO_PUBLIC_V0_API_URL',
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_PROVISION_HOST',
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'EXPO_PUBLIC_CONVEX_OAUTH_CLIENT_ID',
      'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    ];

    for (const key of envKeys) {
      // Try process.env first
      const value = process.env[key];
      if (value) {
        envVars[key] = value;
      }
    }

    // Also try expo-constants extra field (for managed workflow)
    const extra = Constants.expoConfig?.extra;
    if (extra) {
      for (const key of envKeys) {
        if (!envVars[key] && extra[key]) {
          envVars[key] = extra[key];
        }
      }
    }

    try {
      const result = await EXEnvBridge.syncEnvVars(envVars);
      console.log('[EnvBridge] Synced env vars to native:', result);
      return result;
    } catch (error) {
      console.error('[EnvBridge] Failed to sync env vars:', error);
      return { success: false, syncedCount: 0 };
    }
  },

  /**
   * Get a single env value from NSUserDefaults.
   */
  getEnv: async (key: string): Promise<string | null> => {
    if (Platform.OS !== 'ios' || !EXEnvBridge) {
      return null;
    }
    try {
      return await EXEnvBridge.getEnv(key);
    } catch {
      return null;
    }
  },

  /**
   * Get all synced env vars (with sensitive keys masked).
   */
  getAllEnvVars: async (): Promise<Record<string, string>> => {
    if (Platform.OS !== 'ios' || !EXEnvBridge) {
      return {};
    }
    try {
      return await EXEnvBridge.getAllEnvVars();
    } catch {
      return {};
    }
  },

  /**
   * Check if the bridge is supported on this platform.
   */
  isSupported: (): boolean => {
    return Platform.OS === 'ios' && !!EXEnvBridge;
  },
};

export default EnvBridge;
