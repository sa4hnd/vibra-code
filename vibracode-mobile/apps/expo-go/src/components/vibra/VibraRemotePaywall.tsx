import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

import { OFFERINGS } from '../../config/revenuecat';
import { VibraColors, VibraSpacing } from '../../constants/VibraColors';
import { useRevenueCat } from '../../contexts/RevenueCatContext';
import { Ionicons } from '../Icons';

interface VibraRemotePaywallProps {
  onDismiss: () => void;
}

export const VibraRemotePaywall: React.FC<VibraRemotePaywallProps> = ({ onDismiss }) => {
  const { isLoading } = useRevenueCat();
  const [isPresenting, setIsPresenting] = useState(false);
  const hasPresentedRef = useRef(false);

  // Reset presentation state when component mounts (handles reopening case)
  useEffect(() => {
    hasPresentedRef.current = false;
    setIsPresenting(false);

    // Cleanup: reset when component unmounts (modal closes)
    return () => {
      hasPresentedRef.current = false;
      setIsPresenting(false);
    };
  }, []); // Only run on mount/unmount

  // Automatically present the paywall when loading completes
  useEffect(() => {
    if (!isLoading && !hasPresentedRef.current && !isPresenting) {
      presentRemotePaywall();
    }
  }, [isLoading, isPresenting]);

  const presentRemotePaywall = async () => {
    // Prevent double presentation
    if (hasPresentedRef.current || isPresenting) {
      return;
    }

    try {
      hasPresentedRef.current = true;
      setIsPresenting(true);
      await RevenueCatUI.presentPaywall({
        offeringIdentifier: OFFERINGS.DEFAULT, // Use your specific offering
        displayCloseButton: true,
        onDismiss: () => {
          console.log('Remote paywall dismissed');
          // Reset the ref so paywall can be presented again if modal reopens
          hasPresentedRef.current = false;
          onDismiss();
        },
        onPurchaseStarted: (params) => {
          console.log('Remote paywall purchase started:', params);
        },
        onPurchaseCompleted: (params) => {
          console.log('Remote paywall purchase completed:', params);
          Alert.alert('Success', 'Purchase completed successfully!');
          onDismiss();
        },
        onPurchaseError: (params) => {
          console.log('Remote paywall purchase error:', params);
          Alert.alert('Error', 'Purchase failed. Please try again.');
        },
        onPurchaseCancelled: () => {
          console.log('Remote paywall purchase cancelled');
        },
        onRestoreStarted: () => {
          console.log('Remote paywall restore started');
        },
        onRestoreCompleted: (params) => {
          console.log('Remote paywall restore completed:', params);
          Alert.alert('Success', 'Purchases restored successfully!');
          onDismiss();
        },
        onRestoreError: (params) => {
          console.log('Remote paywall restore error:', params);
          Alert.alert('Error', 'Failed to restore purchases. Please try again.');
        },
      });
    } catch (error) {
      console.error('Error presenting remote paywall:', error);
      // Reset the ref on error so user can try again
      hasPresentedRef.current = false;
      Alert.alert('Error', 'Failed to load paywall. Please try again.');
    } finally {
      setIsPresenting(false);
    }
  };

  const presentPaywallIfNeeded = async () => {
    try {
      setIsPresenting(true);
      await RevenueCatUI.presentPaywallIfNeeded({
        entitlementIdentifier: 'Pro', // Must match RevenueCat entitlement identifier
        offeringIdentifier: OFFERINGS.DEFAULT, // Use your specific offering
        onDismiss: () => {
          console.log('Remote paywall dismissed (if needed)');
          onDismiss();
        },
        onPurchaseCompleted: (params) => {
          console.log('Remote paywall purchase completed (if needed):', params);
          Alert.alert('Success', 'Purchase completed successfully!');
          onDismiss();
        },
        onRestoreCompleted: (params) => {
          console.log('Remote paywall restore completed (if needed):', params);
          Alert.alert('Success', 'Purchases restored successfully!');
          onDismiss();
        },
      });
    } catch (error) {
      console.error('Error presenting paywall if needed:', error);
      Alert.alert('Error', 'Failed to load paywall. Please try again.');
    } finally {
      setIsPresenting(false);
    }
  };

  // Show loading state while presenting paywall
  return (
    <View style={styles.container}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={VibraColors.accent.amber} />
        <Text style={styles.loadingText}>
          {isLoading ? 'Loading...' : 'Opening payment options...'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VibraColors.neutral.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: VibraSpacing.md,
  },
});

export default VibraRemotePaywall;
