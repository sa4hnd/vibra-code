import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// RevenueCat API Keys - Read from environment variables
const REVENUECAT_API_KEY = {
  ios:
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ||
    Constants.expoConfig?.extra?.revenueCatIosApiKey || '',
  android:
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ||
    Constants.expoConfig?.extra?.revenueCatAndroidApiKey || '',
};

// Entitlement identifiers - must match RevenueCat dashboard
export const ENTITLEMENTS = {
  PREMIUM: 'Pro', // RevenueCat entitlement identifier
} as const;

// Product identifiers - Replace with your RevenueCat product IDs
export const PRODUCTS = {
  WEEKLY: 'weekly',
  MONTHLY: 'com.yourcompany.vibracode.monthly', // Replace with your RevenueCat product ID
  BUSINESS: 'business_monthly', // Actual RevenueCat product ID from dashboard
  YEARLY: 'com.yourcompany.vibracode.yearly', // Replace with your RevenueCat product ID
  ENTERPRISE: 'com.yourcompany.vibracode.enterprise', // Replace with your RevenueCat product ID
} as const;

// Offering identifiers
export const OFFERINGS = {
  DEFAULT: 'default',
} as const;

/**
 * Map RevenueCat product ID to internal plan ID
 */
export function getPlanIdFromProductId(productId: string): string {
  const productIdMap: Record<string, string> = {
    weekly: 'weekly_plus', // Weekly subscription - 25 messages per week
    'com.yourcompany.vibracode.monthly': 'pro', // Replace with your RevenueCat product ID
    business_monthly: 'business', // Business plan - 300 messages per month
    'com.yourcompany.vibracode.yearly': 'pro', // Replace with your RevenueCat product ID
    'com.yourcompany.vibracode.business': 'business', // Replace with your RevenueCat product ID
    'com.yourcompany.vibracode.enterprise': 'enterprise', // Replace with your RevenueCat product ID
  };

  const planId = productIdMap[productId];
  if (!planId) {
    console.warn(
      `⚠️ Unknown RevenueCat product ID: "${productId}". Defaulting to 'free'. Please add this product ID to the mapping.`
    );
    return 'free';
  }

  return planId;
}

/**
 * Initialize RevenueCat SDK
 */
export const initializeRevenueCat = async (): Promise<void> => {
  try {
    // Set log level for debugging
    await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

    // Get the appropriate API key based on platform
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY.ios : REVENUECAT_API_KEY.android;

    // Check if API key is configured
    if (!apiKey || apiKey.includes('YOUR_')) {
      console.warn(
        `⚠️ RevenueCat API key not properly configured for ${Platform.OS}. Skipping initialization.`
      );
      console.warn(
        `Please set EXPO_PUBLIC_REVENUECAT_${Platform.OS.toUpperCase()}_API_KEY in your environment variables.`
      );
      return;
    }

    // Configure RevenueCat with StoreKit testing support
    await Purchases.configure({
      apiKey,
      // Enable StoreKit testing mode
      usesStoreKit2IfAvailable: true,
      // Allow testing with StoreKit configuration files
      observerMode: false,
    });

    console.log('✅ RevenueCat initialized successfully with StoreKit testing support');
  } catch (error) {
    console.error('❌ Failed to initialize RevenueCat:', error);
    console.warn(
      '⚠️ Continuing without RevenueCat - this is expected if API keys are not configured'
    );
    // Don't throw error - let the app continue
  }
};

/**
 * Get current customer info
 * @param forceRefresh - If true, forces a fresh fetch from RevenueCat servers (bypasses cache)
 */
export const getCustomerInfo = async (forceRefresh: boolean = false) => {
  try {
    // If forceRefresh, we need to invalidate cache first
    // RevenueCat SDK doesn't have a direct forceRefresh parameter, but we can sync
    if (forceRefresh) {
      // Sync with RevenueCat servers to get latest data
      await Purchases.syncPurchases();
    }
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error: any) {
    // Check if RevenueCat is not initialized (singleton instance error)
    if (
      error?.message?.includes('singleton instance') ||
      error?.message?.includes('configure Purchases')
    ) {
      console.warn('⚠️ RevenueCat not initialized. Using fallback customer info.');
    } else if (
      error?.message?.includes('product entitlement mapping') ||
      error?.message?.includes('BackendError') ||
      error?.message?.includes('504')
    ) {
      console.warn('⚠️ RevenueCat configuration error detected. Using fallback customer info.');
    } else {
      console.error('Failed to get customer info:', error);
    }

    // Return a mock customer info for development
    return {
      entitlements: { active: {} },
      activeEntitlements: {},
      allEntitlements: {},
      nonSubscriptionTransactions: [],
      firstSeen: new Date().toISOString(),
      originalAppUserId: 'anonymous',
      requestDate: new Date().toISOString(),
    };
  }
};

/**
 * Check if user has premium entitlement
 */
export const hasPremiumAccess = async (): Promise<boolean> => {
  try {
    const customerInfo = await getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;
  } catch (error) {
    console.error('Failed to check premium access:', error);
    return false;
  }
};

/**
 * Get available offerings
 */
export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error: any) {
    // Check if RevenueCat is not initialized (singleton instance error)
    if (
      error?.message?.includes('singleton instance') ||
      error?.message?.includes('configure Purchases')
    ) {
      console.warn('⚠️ RevenueCat not initialized. Using fallback offerings.');
    } else {
      console.error('Failed to get offerings:', error);
    }

    // Return mock offerings for development
    return {
      current: {
        identifier: 'default',
        availablePackages: [],
        monthly: null,
        annual: null,
        sixMonth: null,
        twoMonth: null,
        threeMonth: null,
        weekly: null,
        twoWeek: null,
        twoYear: null,
        threeYear: null,
        lifetime: null,
      },
      all: {},
    };
  }
};

/**
 * Purchase a package
 */
export const purchasePackage = async (packageToPurchase: any) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    return customerInfo;
  } catch (error) {
    console.error('Failed to purchase package:', error);
    throw error;
  }
};

/**
 * Restore purchases
 */
export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    throw error;
  }
};

/**
 * Set user ID for RevenueCat
 */
export const setUserId = async (userId: string) => {
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.error('Failed to set user ID:', error);
    throw error;
  }
};

/**
 * Log out user from RevenueCat
 */
export const logOut = async () => {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Failed to log out:', error);
    throw error;
  }
};
