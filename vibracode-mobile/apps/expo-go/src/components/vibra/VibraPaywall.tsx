import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { RevenueCatUI } from 'react-native-purchases';

import { VibraColors, VibraSpacing } from '../../constants/VibraColors';
import { useRevenueCat } from '../../contexts/RevenueCatContext';
import { Ionicons } from '../Icons';

// Legal URLs for App Store compliance
const PRIVACY_POLICY_URL = 'https://www.vibracodeapp.com/privacy';
const TERMS_OF_USE_URL = 'https://www.vibracodeapp.com/terms';

interface VibraPaywallProps {
  onDismiss: () => void;
}

export const VibraPaywall: React.FC<VibraPaywallProps> = ({ onDismiss }) => {
  const { offerings, isLoading, purchasePackage, restorePurchases } = useRevenueCat();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handlePurchase = async (packageToPurchase: any) => {
    try {
      setIsPurchasing(true);
      await purchasePackage(packageToPurchase);
      Alert.alert('Success', 'Purchase completed successfully!');
      onDismiss();
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Failed to complete purchase. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsPurchasing(true);
      await restorePurchases();
      Alert.alert('Success', 'Purchases restored successfully!');
      onDismiss();
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={VibraColors.accent.amber} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <Text style={styles.subtitle}>Unlock all features and get the most out of Vibra</Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <CheckCircle size={20} color={VibraColors.accent.amber} />
            <Text style={styles.featureText}>Unlimited projects</Text>
          </View>
          <View style={styles.feature}>
            <CheckCircle size={20} color={VibraColors.accent.amber} />
            <Text style={styles.featureText}>Advanced AI features</Text>
          </View>
          <View style={styles.feature}>
            <CheckCircle size={20} color={VibraColors.accent.amber} />
            <Text style={styles.featureText}>Priority support</Text>
          </View>
          <View style={styles.feature}>
            <CheckCircle size={20} color={VibraColors.accent.amber} />
            <Text style={styles.featureText}>Export capabilities</Text>
          </View>
        </View>

        <View style={styles.packagesContainer}>
          {offerings?.current?.availablePackages.map((pkg: any) => (
            <TouchableOpacity
              key={pkg.identifier}
              style={styles.packageButton}
              onPress={() => handlePurchase(pkg)}
              disabled={isPurchasing}>
              <LinearGradient
                colors={[VibraColors.accent.amber, VibraColors.accent.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.packageGradient}>
                <Text style={styles.packageTitle}>{pkg.packageType}</Text>
                <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                {isPurchasing && (
                  <ActivityIndicator size="small" color="#FFFFFF" style={styles.purchaseLoader} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isPurchasing}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Subscriptions automatically renew unless cancelled at least 24 hours before the end of the
          current period. Payment will be charged to your Apple ID account. Manage subscriptions in
          Settings {'>'} [Your Name] {'>'} Subscriptions.
        </Text>

        {/* Legal Links - Required by App Store */}
        <View style={styles.legalContainer}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_OF_USE_URL)}>
            <Text style={styles.legalLink}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.legalSeparator}>|</Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VibraColors.neutral.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 60,
    paddingHorizontal: VibraSpacing.xl,
    paddingBottom: VibraSpacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: VibraSpacing.xl,
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
  titleContainer: {
    alignItems: 'center',
    marginBottom: VibraSpacing['3xl'],
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: VibraSpacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresContainer: {
    marginBottom: VibraSpacing['3xl'],
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VibraSpacing.lg,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: VibraSpacing.md,
  },
  packagesContainer: {
    marginBottom: VibraSpacing.xl,
  },
  packageButton: {
    marginBottom: VibraSpacing.lg,
    borderRadius: 16,
    overflow: 'hidden',
  },
  packageGradient: {
    paddingVertical: VibraSpacing.xl,
    paddingHorizontal: VibraSpacing.xl,
    alignItems: 'center',
    position: 'relative',
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  packagePrice: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: VibraSpacing.sm,
    opacity: 0.9,
  },
  purchaseLoader: {
    position: 'absolute',
    right: VibraSpacing.lg,
    top: '50%',
    marginTop: -10,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: VibraSpacing.lg,
    marginBottom: VibraSpacing.xl,
  },
  restoreText: {
    fontSize: 16,
    color: VibraColors.accent.amber,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.7,
  },
  legalContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: VibraSpacing.lg,
    paddingBottom: VibraSpacing.xl,
  },
  legalLink: {
    fontSize: 12,
    color: VibraColors.accent.amber,
    fontWeight: '500',
  },
  legalSeparator: {
    fontSize: 12,
    color: '#666666',
    marginHorizontal: VibraSpacing.md,
  },
});

export default VibraPaywall;
