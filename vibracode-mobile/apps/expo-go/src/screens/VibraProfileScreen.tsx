import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';

import { VibraUpgradeButton } from '../components/vibra/VibraUpgradeButton';
import { VibraAccountSettings } from '../components/vibra/VibraAccountSettings';
import { VibraNotificationSettings } from '../components/vibra/VibraNotificationSettings';
// VibraAgentTypeSelector removed - agent type is now controlled globally by admin
import { VibraColors, VibraSpacing, TABLET_BREAKPOINT, VibraResponsive } from '../constants/VibraColors';
import { api } from '../../convex/_generated/api';
import { LinearGradient } from 'expo-linear-gradient';
import {
  UserCircle,
  LogIn,
  User,
  ChevronRight,
  CreditCard,
  Bell,
  HelpCircle,
  Info,
  LogOut,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  useWindowDimensions,
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

import { VibraAboutUsScreen } from './VibraAboutUsScreen';
import { VibraHelpScreen } from './VibraHelpScreen';
import { VibraAuthModal } from '../components/vibra/VibraAuthModal';
import { VibraCosmicBackground } from '../components/vibra/VibraCosmicBackground';
import { VibraUsageDisplay } from '../components/vibra/VibraUsageDisplay';
import { OFFERINGS } from '../config/revenuecat';
import { useRevenueCat } from '../contexts/RevenueCatContext';
import { useVibraAuth } from '../contexts/VibraAuthContext';
import LocalStorage from '../storage/LocalStorage';

interface VibraProfileScreenProps {
  navigation: any;
}

export const VibraProfileScreen: React.FC<VibraProfileScreenProps> = () => {
  const { user } = useUser();
  const { signOut, isAuthenticated, isLoading } = useVibraAuth();
  const { hasPremium } = useRevenueCat();
  const navigation = useNavigation();
  const clearAllUserData = useMutation(api.usage.clearAllUserData);

  // Responsive layout
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const maxContentWidth = isTablet ? VibraResponsive.maxContentWidth : width;

  // Token management - same as VibraCreateAppScreen
  const userTokens = useQuery(api.usage.getUserMessages, { clerkId: user?.id || '' });
  const isPro = userTokens?.subscriptionPlan === 'pro';
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            // Navigate to Home screen after successful sign out
            (navigation as any).reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          } catch (error) {
            console.error('Sign out error:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const handleSignIn = () => {
    setShowAuthModal(true);
  };

  const handleBilling = async () => {
    if (hasPremium) {
      Alert.alert('Premium Active', 'You have an active premium subscription!');
    } else {
      try {
        await RevenueCatUI.presentPaywall({
          offeringIdentifier: OFFERINGS.DEFAULT,
          displayCloseButton: true,
        });
      } catch (error) {
        console.error('Error presenting paywall:', error);
        Alert.alert('Error', 'Failed to load payment options. Please try again.');
      }
    }
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

  const handleAccountSettings = () => {
    setShowAccountSettings(true);
  };

  const handleAboutUs = () => {
    setShowAboutUs(true);
  };

  const handleHelp = () => {
    setShowHelp(true);
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your projects, chat history, and settings. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'This will delete EVERYTHING and cannot be undone.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Yes, Delete All',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      if (!user?.id) {
                        Alert.alert('Error', 'User not found. Please try signing out and back in.');
                        return;
                      }

                      // Clear AsyncStorage completely
                      await AsyncStorage.clear();

                      // Clear LocalStorage data (history, settings, session)
                      await LocalStorage.clearHistoryAsync();
                      await LocalStorage.removeSessionAsync();

                      // Clear all settings
                      await AsyncStorage.removeItem('Exponent.settings');

                      // Clear Convex database entries (sessions, messages, user data, transactions)
                      try {
                        await clearAllUserData({ clerkId: user.id });
                      } catch (convexError) {
                        console.warn(
                          'Convex data clearing failed, but local data was cleared:',
                          convexError
                        );
                        // Continue execution - local data is still cleared
                      }

                      // Clear any cached files/data
                      // Note: Expo's FileSystem.deleteAsync could be used here if needed
                      // for clearing downloaded files, but we don't seem to have file caching in this app

                      Alert.alert('Success', 'All local data has been cleared successfully.');
                    } catch (error) {
                      console.error('Error clearing data:', error);
                      Alert.alert('Error', 'Failed to clear all data. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <>
        <VibraCosmicBackground>
          <View style={styles.headerContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Profile</Text>
            </View>
          </View>
          <View style={styles.contentWrapper}>
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          </View>
        </VibraCosmicBackground>

        <VibraAuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  // Show signed out state
  if (!isAuthenticated) {
    return (
      <>
        <VibraCosmicBackground>
          <View style={styles.headerContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Profile</Text>
            </View>
          </View>

          <View style={styles.contentWrapper}>
            {/* Sign In Prompt - Centered */}
            <View style={styles.signInContainer}>
              <View style={[styles.signInPrompt, isTablet && { maxWidth: maxContentWidth * 0.85 }]}>
                <View style={styles.signInIcon}>
                  <UserCircle size={isTablet ? 64 : 80} color={VibraColors.neutral.textTertiary} />
                </View>
                <Text style={[styles.signInTitle, isTablet && { fontSize: 20 }]}>
                  Sign in to your account
                </Text>
                <Text style={[styles.signInSubtitle, isTablet && { fontSize: 14 }]}>
                  Access your profile, projects, and settings
                </Text>
                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={handleSignIn}
                  activeOpacity={0.8}>
                  <LinearGradient
                    colors={[VibraColors.neutral.text, VibraColors.neutral.textSecondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInButtonGradient}>
                    <LogIn size={20} color="#000000" />
                    <Text style={styles.signInButtonText}>Sign In</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* App Version */}
              <View style={styles.versionSection}>
                <Text style={styles.versionText}>Designed in Europe</Text>
              </View>
            </View>
          </View>
        </VibraCosmicBackground>

        <VibraAuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  return (
    <>
      <VibraCosmicBackground>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
          </View>
        </View>

        <View style={styles.contentWrapper}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.scrollContent,
              isTablet && { alignSelf: 'center', width: maxContentWidth },
            ]}
            showsVerticalScrollIndicator={false}>
            {/* User Info Section */}
            <View style={styles.section}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <LinearGradient
                    colors={[VibraColors.accent.purple, VibraColors.accent.blue]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradient}>
                    <Text style={styles.avatarText}>
                      {user?.firstName?.charAt(0) ||
                        user?.emailAddresses[0]?.emailAddress?.charAt(0) ||
                        'U'}
                    </Text>
                  </LinearGradient>
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.emailAddresses[0]?.emailAddress || 'User'}
                  </Text>
                  <Text style={styles.userEmail}>{user?.emailAddresses[0]?.emailAddress}</Text>
                </View>
              </View>
            </View>

            {/* Upgrade Button - Above Token Display */}
            <VibraUpgradeButton onPress={handleUpgrade} isPro={isPro} />

            {/* Usage Display */}
            <VibraUsageDisplay />

            {/* Agent Type Selector removed - controlled globally by admin */}

            {/* Menu Items */}
            <View style={styles.menuSection}>
              <TouchableOpacity style={styles.menuItem} onPress={handleAccountSettings}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <User size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>Account Settings</Text>
                </View>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleBilling}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <CreditCard size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.menuTextRow}>
                    <Text style={styles.menuText}>Billing & Plans</Text>
                    {hasPremium && <Text style={styles.premiumBadge}>Premium</Text>}
                  </View>
                </View>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setShowNotificationSettings(true)}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Bell size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>Notifications</Text>
                </View>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <HelpCircle size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>Help & Support</Text>
                </View>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleAboutUs}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuIcon}>
                    <Info size={20} color="#FFFFFF" />
                  </View>
                  <Text style={styles.menuText}>About</Text>
                </View>
                <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
              </TouchableOpacity>

              {/* Clear All Data Button - Removed */}
            </View>

            {/* Sign Out Button */}
            <View style={styles.signOutSection}>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <LogOut size={20} color="#FF6B6B" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            {/* App Version */}
            <View style={styles.versionSection}>
              <Text style={styles.versionText}>Designed in Europe</Text>
            </View>
          </ScrollView>
        </View>
      </VibraCosmicBackground>

      <VibraAuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />

      <VibraAccountSettings
        visible={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />

      <VibraNotificationSettings
        visible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />

      {/* About Us Modal */}
      <Modal visible={showAboutUs} animationType="slide" presentationStyle="fullScreen">
        <VibraAboutUsScreen navigation={{ goBack: () => setShowAboutUs(false) }} />
      </Modal>

      {/* Help Screen Modal */}
      <Modal visible={showHelp} animationType="slide" presentationStyle="fullScreen">
        <VibraHelpScreen navigation={{ goBack: () => setShowHelp(false) }} />
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: VibraColors.neutral.border,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: VibraSpacing.xl,
    paddingBottom: VibraSpacing.md,
    minHeight: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: VibraSpacing.xl,
  },
  scrollContent: {
    paddingBottom: VibraSpacing['4xl'],
  },
  signInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing['2xl'],
  },
  section: {
    marginTop: VibraSpacing.xl,
    marginBottom: VibraSpacing.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 16,
    padding: VibraSpacing.xl,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: VibraSpacing.lg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: -0.3,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: '400',
    opacity: 0.8,
  },
  menuSection: {
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: VibraSpacing.lg,
    paddingHorizontal: VibraSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: VibraSpacing.md,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VibraSpacing.sm,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  premiumBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: VibraColors.accent.amber,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signOutSection: {
    marginTop: VibraSpacing.xl,
    marginBottom: VibraSpacing.lg,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 16,
    paddingVertical: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF6B6B',
    marginLeft: VibraSpacing.sm,
    letterSpacing: -0.1,
  },
  versionSection: {
    alignItems: 'center',
    paddingTop: VibraSpacing.md,
    paddingBottom: VibraSpacing.lg,
  },
  versionText: {
    fontSize: 13,
    color: '#CCCCCC',
    fontWeight: '500',
  },

  // Loading state styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: VibraSpacing['6xl'],
  },
  loadingText: {
    color: '#CCCCCC',
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },

  // Sign in prompt styles
  signInPrompt: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
    paddingVertical: VibraSpacing['4xl'],
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
    minHeight: 350,
    width: '100%',
    maxWidth: 400,
  },
  signInIcon: {
    marginBottom: VibraSpacing['2xl'],
    opacity: 0.9,
  },
  signInTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: VibraSpacing.lg,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  signInSubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: VibraSpacing['3xl'],
    lineHeight: 22,
    fontWeight: '400',
    opacity: 0.9,
    paddingHorizontal: VibraSpacing.lg,
  },
  signInButton: {
    borderRadius: 16,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    overflow: 'hidden',
    minWidth: 200,
  },
  signInButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    gap: VibraSpacing.md,
  },
  signInButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  clearDataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: VibraSpacing.lg,
    paddingHorizontal: VibraSpacing.lg,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderBottomWidth: 0,
    marginTop: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 53, 0.2)',
  },
  clearDataIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: VibraSpacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  clearDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
    letterSpacing: -0.2,
  },
});

export default VibraProfileScreen;
