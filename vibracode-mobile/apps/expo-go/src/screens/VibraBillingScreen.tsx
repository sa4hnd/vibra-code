import { useUser } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Diamond, User, Settings, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

import { api } from '../../convex/_generated/api';
import { VibraCosmicBackground } from '../components/vibra/VibraCosmicBackground';
import { VibraUpgradeButton } from '../components/vibra/VibraUpgradeButton';
import { OFFERINGS } from '../config/revenuecat';
import { VibraColors, VibraSpacing, VibraBorderRadius } from '../constants/VibraColors';
import { useRevenueCat } from '../contexts/RevenueCatContext';

interface VibraBillingScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const VibraBillingScreen: React.FC<VibraBillingScreenProps> = ({ visible, onClose }) => {
  const { user } = useUser();
  const { hasPremium } = useRevenueCat();

  // Token management
  const userTokens = useQuery(api.usage.getUserMessages, { clerkId: user?.id || '' });
  const isPro = userTokens?.subscriptionPlan === 'pro';
  const remainingMessages = userTokens?.messagesRemaining || 0;
  const usedMessages = userTokens?.messagesUsed || 0;
  const totalMessages = (userTokens?.messagesRemaining || 0) + (userTokens?.messagesUsed || 0);
  const usagePercentage = totalMessages > 0 ? (usedMessages / totalMessages) * 100 : 0;

  const handleBack = () => {
    onClose();
  };

  const handleUpgrade = async () => {
    try {
      await RevenueCatUI.presentPaywall({
        offeringIdentifier: OFFERINGS.DEFAULT,
        displayCloseButton: true,
      });
    } catch (error) {
      console.error('Error presenting paywall:', error);
      Alert.alert('Error', 'Failed to load payment options. Please try again.');
    }
  };

  const handleManageSubscription = () => {
    Alert.alert(
      'Manage Subscription',
      'To manage your subscription, please visit the App Store or Google Play Store.',
      [{ text: 'OK' }]
    );
  };

  if (!user) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <VibraCosmicBackground>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>Billing & Plans</Text>
              <Text style={styles.headerSubtitle}>Manage your subscription</Text>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Current Plan Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Plan</Text>

              <View style={styles.planCard}>
                <View style={styles.planHeader}>
                  <View style={styles.planIconContainer}>
                    {isPro ? (
                      <LinearGradient
                        colors={[VibraColors.accent.amber, VibraColors.accent.amber]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.planIconGradient}>
                        <Diamond size={24} color="#000000" />
                      </LinearGradient>
                    ) : (
                      <View style={styles.freePlanIcon}>
                        <User size={24} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{isPro ? 'Pro Plan' : 'Free Plan'}</Text>
                    <Text style={styles.planDescription}>
                      {isPro
                        ? 'Unlimited access to all features'
                        : 'Limited access with free tokens'}
                    </Text>
                  </View>
                  {isPro && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>

                {/* Usage Stats */}
                <View style={styles.usageSection}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageTitle}>Usage This Month</Text>
                    <Text style={styles.usageCount}>
                      {usedMessages} / {totalMessages} messages
                    </Text>
                  </View>

                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${usagePercentage}%`,
                            backgroundColor: isPro
                              ? VibraColors.accent.amber
                              : VibraColors.accent.blue,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressPercentage}>
                      {Math.round(usagePercentage)}% used
                    </Text>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{remainingMessages}</Text>
                      <Text style={styles.statLabel}>Remaining</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{usedMessages}</Text>
                      <Text style={styles.statLabel}>Used</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{totalMessages}</Text>
                      <Text style={styles.statLabel}>Total</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Action Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>

              {/* Upgrade/Get More Tokens Button */}
              <VibraUpgradeButton onPress={handleUpgrade} isPro={isPro} />

              {/* Manage Subscription Button for Pro Users */}
              {isPro && (
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={handleManageSubscription}
                  activeOpacity={0.8}>
                  <View style={styles.manageButtonContent}>
                    <View style={styles.manageIcon}>
                      <Settings size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.manageButtonText}>Manage Subscription</Text>
                    <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Plan Features Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Plan Features</Text>

              <View style={styles.featuresCard}>
                <View style={styles.featureItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={isPro ? VibraColors.accent.amber : VibraColors.accent.blue}
                  />
                  <Text style={styles.featureText}>
                    {isPro ? 'Unlimited' : 'Limited'} app generations
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={isPro ? VibraColors.accent.amber : VibraColors.accent.blue}
                  />
                  <Text style={styles.featureText}>
                    {isPro ? 'Unlimited' : 'Limited'} chat messages
                  </Text>
                </View>

                <View style={styles.featureItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={isPro ? VibraColors.accent.amber : VibraColors.accent.blue}
                  />
                  <Text style={styles.featureText}>{isPro ? 'Priority' : 'Standard'} support</Text>
                </View>

                <View style={styles.featureItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={isPro ? VibraColors.accent.amber : VibraColors.accent.blue}
                  />
                  <Text style={styles.featureText}>{isPro ? 'Advanced' : 'Basic'} AI models</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </VibraCosmicBackground>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: VibraSpacing.lg,
    paddingBottom: VibraSpacing.md,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.button,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: VibraSpacing.lg,
  },
  section: {
    marginTop: VibraSpacing['2xl'],
    marginBottom: VibraSpacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: VibraColors.neutral.text,
    marginBottom: VibraSpacing.xl,
    letterSpacing: -0.3,
  },
  planCard: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    padding: VibraSpacing.xl,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VibraSpacing.xl,
  },
  planIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: VibraSpacing.lg,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  planIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  freePlanIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 24,
    fontWeight: '800',
    color: VibraColors.neutral.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 16,
    color: VibraColors.neutral.textSecondary,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  activeBadge: {
    backgroundColor: VibraColors.accent.amber,
    paddingHorizontal: VibraSpacing.md,
    paddingVertical: VibraSpacing.sm,
    borderRadius: 20,
    shadowColor: VibraColors.accent.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  activeBadgeText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  usageSection: {
    borderTopWidth: 1,
    borderTopColor: VibraColors.neutral.border,
    paddingTop: VibraSpacing.xl,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: VibraSpacing.lg,
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: VibraColors.neutral.text,
    letterSpacing: -0.2,
  },
  usageCount: {
    fontSize: 16,
    fontWeight: '600',
    color: VibraColors.neutral.textSecondary,
    letterSpacing: -0.2,
  },
  progressContainer: {
    marginBottom: VibraSpacing.xl,
  },
  progressBar: {
    height: 12,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    marginBottom: VibraSpacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: VibraColors.neutral.textSecondary,
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: VibraColors.neutral.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: VibraColors.neutral.textSecondary,
    letterSpacing: -0.1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: VibraColors.neutral.border,
    marginHorizontal: VibraSpacing.md,
  },
  manageButton: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    marginTop: VibraSpacing.md,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  manageButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VibraSpacing.lg,
    paddingHorizontal: VibraSpacing.lg,
  },
  manageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  manageButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: VibraColors.neutral.text,
    letterSpacing: -0.2,
  },
  featuresCard: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: VibraBorderRadius.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    padding: VibraSpacing.xl,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VibraSpacing.lg,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
    color: VibraColors.neutral.text,
    marginLeft: VibraSpacing.md,
    letterSpacing: -0.2,
  },
});

export default VibraBillingScreen;
