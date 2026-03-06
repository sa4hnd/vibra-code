import { useUser } from '@clerk/clerk-expo';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';

import {
  initializeRevenueCat,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  restorePurchases,
  setUserId,
  logOut,
  ENTITLEMENTS,
} from '../config/revenuecat';
import { syncCustomerInfo } from '../services/RevenueCatSyncService';

interface RevenueCatContextType {
  isInitialized: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  offerings: any | null;
  hasPremium: boolean;
  purchasePackage: (packageToPurchase: any) => Promise<CustomerInfo>;
  restorePurchases: () => Promise<CustomerInfo>;
  setUserId: (userId: string) => Promise<void>;
  logOut: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

interface RevenueCatProviderProps {
  children: ReactNode;
}

export const RevenueCatProvider: React.FC<RevenueCatProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<any | null>(null);
  const [hasPremium, setHasPremium] = useState(false);
  const { user } = useUser();

  // Initialize RevenueCat
  useEffect(() => {
    const init = async () => {
      try {
        await initializeRevenueCat();
        setIsInitialized(true);

        // Load initial data
        await loadData();
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Set RevenueCat user ID when user is authenticated
  useEffect(() => {
    const setRevenueCatUserId = async () => {
      if (user?.id && isInitialized) {
        try {
          console.log('Setting RevenueCat user ID:', user.id);
          await setUserId(user.id);
          await loadData(); // Reload data with the new user ID
        } catch (error) {
          console.error('Failed to set RevenueCat user ID:', error);
        }
      }
    };

    setRevenueCatUserId();
  }, [user?.id, isInitialized]);

  // Listen for CustomerInfo updates (real-time subscription changes)
  useEffect(() => {
    if (!isInitialized) return;

    const listener = (customerInfo: CustomerInfo) => {
      console.log('🔄 CustomerInfo updated - syncing with database');
      setCustomerInfo(customerInfo);
      setHasPremium(customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined);

      // Sync with Convex database whenever CustomerInfo updates
      if (user?.id) {
        syncCustomerInfo(user.id, customerInfo).catch((error) => {
          console.error('Failed to sync customer info with Convex:', error);
        });
      }
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [isInitialized, user?.id]);

  // Listen for app foreground to refresh subscription status
  useEffect(() => {
    if (!isInitialized) return;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user?.id) {
        // App came to foreground - refresh subscription status
        console.log('📱 App came to foreground - refreshing subscription status');
        refreshCustomerInfo();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isInitialized, user?.id]);

  // Load customer info and offerings
  const loadData = async () => {
    try {
      const [customerInfoData, offeringsData] = await Promise.all([
        getCustomerInfo(),
        getOfferings(),
      ]);

      setCustomerInfo(customerInfoData);
      setOfferings(offeringsData);
      setHasPremium(customerInfoData.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined);

      // Sync with Convex database
      if (user?.id && customerInfoData) {
        try {
          await syncCustomerInfo(user.id, customerInfoData);
        } catch (error) {
          console.error('Failed to sync customer info with Convex:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load RevenueCat data:', error);
    }
  };

  // Refresh customer info (force fresh fetch from RevenueCat)
  const refreshCustomerInfo = async () => {
    try {
      // Force refresh to get latest data from RevenueCat servers
      const customerInfoData = await getCustomerInfo(true);
      setCustomerInfo(customerInfoData);
      setHasPremium(customerInfoData.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined);

      // Sync with Convex database
      if (user?.id && customerInfoData) {
        try {
          await syncCustomerInfo(user.id, customerInfoData);
        } catch (error) {
          console.error('Failed to sync customer info with Convex after refresh:', error);
        }
      }
    } catch (error) {
      console.error('Failed to refresh customer info:', error);
    }
  };

  // Handle purchase
  const handlePurchasePackage = async (packageToPurchase: any) => {
    try {
      setIsLoading(true);
      const customerInfoData = await purchasePackage(packageToPurchase);
      setCustomerInfo(customerInfoData);
      setHasPremium(customerInfoData.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined);

      // NOTE: We do NOT sync immediately here!
      // The customerInfo returned by purchasePackage may have stale/incomplete entitlement data
      // (productIdentifier may be missing, transaction ID may not be updated yet)
      //
      // Instead, we rely on:
      // 1. The CustomerInfoUpdateListener (line 85) which fires when RevenueCat has processed the purchase
      // 2. A delayed refresh below to catch any edge cases
      //
      // The syncSubscriptionStatus function uses transaction ID deduplication,
      // so even if both fire, tokens will only be granted once.

      console.log('🛒 Purchase completed - waiting for CustomerInfo to update...');

      // Delayed refresh to ensure we get the fully-processed CustomerInfo
      // This catches cases where the listener doesn't fire or fires with stale data
      setTimeout(async () => {
        try {
          console.log('⏰ Running delayed CustomerInfo refresh after purchase...');
          const refreshedInfo = await getCustomerInfo(true);
          if (refreshedInfo && user?.id) {
            // Update local state
            setCustomerInfo(refreshedInfo);
            setHasPremium(refreshedInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined);

            // Sync to database - transaction ID deduplication prevents double-grant
            await syncCustomerInfo(user.id, refreshedInfo);
            console.log('✅ Delayed sync completed after purchase');
          }
        } catch (error) {
          console.error('Failed to refresh after purchase:', error);
          // Silent fail - the CustomerInfoUpdateListener should handle it
        }
      }, 3000); // 3 second delay for RevenueCat to fully process

      return customerInfoData;
    } catch (error) {
      console.error('Failed to purchase package:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle restore
  const handleRestorePurchases = async () => {
    try {
      setIsLoading(true);
      const customerInfoData = await restorePurchases();
      setCustomerInfo(customerInfoData);
      setHasPremium(customerInfoData.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined);

      // Sync with Convex database immediately after restore
      if (user?.id && customerInfoData) {
        try {
          await syncCustomerInfo(user.id, customerInfoData);
          console.log('✅ Successfully synced subscription after restore');
        } catch (error) {
          console.error('Failed to sync customer info with Convex after restore:', error);
          // Don't throw - restore was successful, sync can retry later
        }
      }

      return customerInfoData;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle set user ID
  const handleSetUserId = async (userId: string) => {
    try {
      await setUserId(userId);
      await refreshCustomerInfo();
    } catch (error) {
      console.error('Failed to set user ID:', error);
      throw error;
    }
  };

  // Handle log out
  const handleLogOut = async () => {
    try {
      await logOut();
      setCustomerInfo(null);
      setHasPremium(false);
    } catch (error) {
      console.error('Failed to log out:', error);
      throw error;
    }
  };

  const value: RevenueCatContextType = {
    isInitialized,
    isLoading,
    customerInfo,
    offerings,
    hasPremium,
    purchasePackage: handlePurchasePackage,
    restorePurchases: handleRestorePurchases,
    setUserId: handleSetUserId,
    logOut: handleLogOut,
    refreshCustomerInfo,
  };

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
};

export const useRevenueCat = (): RevenueCatContextType => {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
};
