/**
 * @deprecated This component is deprecated and no longer used.
 *
 * The new onboarding flow uses NewOnboardingScreen0 as the welcome/login screen.
 * See: src/components/vibra/onboarding/NewOnboardingScreen0.tsx
 *
 * The new flow:
 * - User opens app → sees NewOnboardingScreen0 (welcome/login)
 * - If existing user logs in → goes directly to app (skips onboarding)
 * - If new user creates account → proceeds through NewOnboardingScreen1-15
 *
 * This file is kept for reference only.
 */

import { useSSO, useSignUp, useSignIn, useAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons'; // Keep for social logos
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, Zap, Eye, Rocket } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Animated,
  StatusBar,
  TextInput,
  ScrollView,
} from 'react-native';

import { TextShimmer } from './TextShimmer';
import { VibraCosmicBackground } from './VibraCosmicBackground';
import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface OnboardingLoginScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

// Browser warm-up hook for better UX
const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

// Floating badge animation
const FloatingBadge: React.FC<{ text: string; delay: number; color: string[] }> = ({
  text,
  delay,
  color,
}) => {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      // Float animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -8,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, delay);
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.floatingBadge,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}>
      <LinearGradient
        colors={color}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badgeGradient}>
        <Text style={styles.badgeText}>{text}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

export const OnboardingLoginScreen: React.FC<OnboardingLoginScreenProps> = ({
  onComplete,
  onBack,
}) => {
  useWarmUpBrowser();

  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: isSignInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // Default to sign in for onboarding
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Complete onboarding if user is already signed in
  useEffect(() => {
    if (isSignedIn) {
      onComplete();
    }
  }, [isSignedIn, onComplete]);

  const logoScale = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(50)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animations
    Animated.sequence([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(contentSlide, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Button pulse animation
    setTimeout(() => {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(buttonPulse, {
            toValue: 1.02,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(buttonPulse, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    }, 1500);
  }, []);

  const handleOAuthSignIn = useCallback(
    async (strategy: 'oauth_github') => {
      try {
        setIsLoading(true);

        const {
          createdSessionId,
          setActive,
          signIn: ssoSignIn,
          signUp: ssoSignUp,
        } = await startSSOFlow({
          strategy,
          redirectUrl: 'exp://localhost:8081',
        });

        if (createdSessionId) {
          setActive!({
            session: createdSessionId,
            navigate: async ({ session }) => {
              if (session?.currentTask) {
                console.log(session?.currentTask);
                return;
              }
              onComplete();
            },
          });
        } else {
          if (ssoSignIn) {
            console.log('SSO Sign In status:', ssoSignIn.status);
          }
          if (ssoSignUp) {
            console.log('SSO Sign Up status:', ssoSignUp.status);
          }
        }
      } catch (error: any) {
        console.error('OAuth error:', error);
        Alert.alert(
          'Authentication Error',
          error.errors?.[0]?.message || 'Authentication failed. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [startSSOFlow, onComplete]
  );

  const handleEmailPasswordSignUp = useCallback(async () => {
    if (!isSignUpLoaded || !signUp || !setActiveSignUp) return;

    // Check if user is already signed in
    if (isSignedIn) {
      onComplete();
      return;
    }

    try {
      setIsLoading(true);

      // Create sign-up with email and password
      const signUpResult = await signUp.create({
        emailAddress: email,
        password,
      });

      // Check if signup is complete (no email verification required)
      if (signUpResult.status === 'complete') {
        // Automatically sign in the user
        if (signUpResult.createdSessionId) {
          try {
            await setActiveSignUp({
              session: signUpResult.createdSessionId,
            });
            // Wait a bit for the session to be set, then complete
            setTimeout(() => {
              onComplete();
            }, 500);
          } catch (setActiveError: any) {
            console.error('Set active error:', setActiveError);
            if (setActiveError.message?.includes('already') || isSignedIn) {
              onComplete();
            } else {
              Alert.alert(
                'Error',
                'Account created but failed to sign in. Please try signing in manually.'
              );
            }
          }
        } else {
          // If no session ID but status is complete, check if already signed in
          if (isSignedIn) {
            onComplete();
          } else {
            Alert.alert(
              'Error',
              'Account created but session not available. Please try signing in manually.'
            );
          }
        }
      } else if (signUpResult.status === 'missing_requirements') {
        // Email verification might be required, try to prepare it
        try {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
        } catch (verifyError: any) {
          // If verification preparation fails, try to complete signup anyway
          console.log('Verification not required or failed, completing signup');
          if (signUpResult.createdSessionId) {
            await setActiveSignUp({
              session: signUpResult.createdSessionId,
            });
            setTimeout(() => {
              onComplete();
            }, 500);
          } else {
            Alert.alert('Sign Up Error', 'Please try signing in with your credentials.');
          }
        }
      } else {
        Alert.alert('Sign Up Error', 'Sign up incomplete. Please try again.');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      const errorMessage =
        error.errors?.[0]?.message || error.message || 'Failed to sign up. Please try again.';

      // Handle "already signed in" error
      if (errorMessage.includes('already signed in') || errorMessage.includes('already signed')) {
        // User is already signed in, complete onboarding
        onComplete();
      } else {
        Alert.alert('Sign Up Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignUpLoaded, signUp, setActiveSignUp, email, password, isSignedIn, onComplete]);

  const handleEmailVerification = useCallback(async () => {
    if (!isSignUpLoaded || !signUp || !setActiveSignUp) return;

    try {
      setIsLoading(true);

      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (signUpAttempt.status === 'complete') {
        // Automatically sign in the user after successful verification
        if (signUpAttempt.createdSessionId) {
          try {
            await setActiveSignUp({
              session: signUpAttempt.createdSessionId,
            });
            // Wait a bit for the session to be set, then complete
            setTimeout(() => {
              onComplete();
            }, 500);
          } catch (setActiveError: any) {
            console.error('Set active error:', setActiveError);
            // If setting active fails but we have a session, user might already be signed in
            if (setActiveError.message?.includes('already') || isSignedIn) {
              onComplete();
            } else {
              Alert.alert('Error', 'Failed to sign in. Please try signing in manually.');
            }
          }
        } else {
          // If no session ID but status is complete, check if already signed in
          if (isSignedIn) {
            onComplete();
          } else {
            Alert.alert('Error', 'Session not created. Please try signing in manually.');
          }
        }
      } else {
        console.error('Sign up incomplete:', signUpAttempt);
        Alert.alert('Verification Error', 'Verification incomplete. Please try again.');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      const errorMessage =
        error.errors?.[0]?.message || error.message || 'Failed to verify email. Please try again.';

      // Handle "already signed in" error
      if (
        errorMessage.includes('already signed in') ||
        errorMessage.includes('already signed') ||
        errorMessage.includes('session')
      ) {
        // User is already signed in, complete onboarding
        onComplete();
      } else if (errorMessage.includes('No sign up attempt')) {
        // Sign up attempt was lost, reset and show error
        setPendingVerification(false);
        setVerificationCode('');
        Alert.alert('Verification Error', 'Sign up session expired. Please try signing up again.');
      } else {
        Alert.alert('Verification Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignUpLoaded, signUp, setActiveSignUp, verificationCode, isSignedIn, onComplete]);

  const handleEmailPasswordSignIn = useCallback(async () => {
    if (!isSignInLoaded || !signIn || !setActiveSignIn) return;

    // Check if user is already signed in
    if (isSignedIn) {
      onComplete();
      return;
    }

    try {
      setIsLoading(true);

      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActiveSignIn({
          session: signInAttempt.createdSessionId,
          navigate: async ({ session }) => {
            if (session?.currentTask) {
              console.log(session?.currentTask);
              return;
            }
            onComplete();
          },
        });
      } else {
        console.error('Sign in incomplete:', signInAttempt);
        Alert.alert('Sign In Error', 'Sign in incomplete. Please try again.');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage =
        error.errors?.[0]?.message || error.message || 'Failed to sign in. Please try again.';

      // Handle "already signed in" error
      if (errorMessage.includes('already signed in') || errorMessage.includes('already signed')) {
        // User is already signed in, complete onboarding
        onComplete();
      } else {
        Alert.alert('Sign In Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignInLoaded, signIn, setActiveSignIn, email, password, isSignedIn, onComplete]);

  return (
    <VibraCosmicBackground>
      <StatusBar barStyle="light-content" />

      <View style={styles.container}>
        {/* Floating Badges */}
        <FloatingBadge
          text="AI-Powered"
          delay={800}
          color={[VibraColors.accent.purple, VibraColors.accent.indigo]}
        />
        <FloatingBadge
          text="Lightning Fast"
          delay={1200}
          color={[VibraColors.accent.teal, VibraColors.accent.emerald]}
        />
        <FloatingBadge
          text="Production Ready"
          delay={1600}
          color={[VibraColors.accent.amber, VibraColors.accent.red]}
        />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <ChevronLeft size={20} color={VibraColors.neutral.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          {/* Logo Section */}
          <Animated.View style={[styles.logoSection, { transform: [{ scale: logoScale }] }]}>
            <Image
              source={{ uri: 'https://i.imgur.com/fPrpRh3.png' }}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <View style={styles.brandText}>
              <TextShimmer style={styles.brandTitle} duration={2500}>
                Vibra Code
              </TextShimmer>
              <Text style={styles.brandTagline}>AI-Powered App Development</Text>
            </View>
          </Animated.View>

          {/* Welcome Message */}
          <Animated.View
            style={[styles.welcomeSection, { transform: [{ translateY: contentSlide }] }]}>
            <Text style={styles.welcomeTitle}>Ready to Build Something Amazing? 🚀</Text>
            <Text style={styles.welcomeText}>
              You've seen the magic, now let's make it happen! Sign in to start creating your first
              app with VibraCoder.
            </Text>
          </Animated.View>

          {/* Features Reminder */}
          <Animated.View
            style={[styles.featuresReminder, { transform: [{ translateY: contentSlide }] }]}>
            <View style={styles.featureItem}>
              <Zap size={16} color={VibraColors.accent.purple} />
              <Text style={styles.featureText}>Build apps in minutes with AI</Text>
            </View>
            <View style={styles.featureItem}>
              <Eye size={16} color={VibraColors.accent.teal} />
              <Text style={styles.featureText}>Live preview in Expo Go</Text>
            </View>
            <View style={styles.featureItem}>
              <Rocket size={16} color={VibraColors.accent.amber} />
              <Text style={styles.featureText}>Deploy to app stores instantly</Text>
            </View>
          </Animated.View>

          {/* Auth Section */}
          <Animated.View
            style={[
              styles.authSection,
              {
                transform: [{ translateY: contentSlide }, { scale: buttonPulse }],
              },
            ]}>
            {!showEmailPassword ? (
              <>
                <TouchableOpacity
                  style={[styles.githubButton, isLoading && styles.authButtonDisabled]}
                  onPress={() => handleOAuthSignIn('oauth_github')}
                  disabled={isLoading}
                  activeOpacity={0.8}>
                  <LinearGradient
                    colors={
                      isLoading
                        ? [VibraColors.neutral.textSecondary, VibraColors.neutral.textTertiary]
                        : [VibraColors.neutral.text, VibraColors.neutral.textSecondary]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.githubButtonGradient}>
                    <Ionicons name="logo-github" size={24} color="#000000" />
                    <Text style={styles.authButtonText}>
                      {isLoading ? 'Getting Ready...' : 'Continue with GitHub'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.ctaText}>Join 50K+ developers building the future!</Text>

                {/* Email/Password Toggle */}
                <TouchableOpacity
                  onPress={() => setShowEmailPassword(true)}
                  style={styles.emailPasswordToggle}>
                  <Text style={styles.emailPasswordText}>
                    Or {isSignUp ? 'sign up' : 'sign in'} using email and password
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Email/Password Form */}
                {!pendingVerification ? (
                  <>
                    <TextInput
                      style={[styles.githubButton, styles.emailInput]}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email"
                      placeholderTextColor="#888888"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />

                    <TextInput
                      style={[styles.githubButton, styles.emailInput]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      placeholderTextColor="#888888"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />

                    <TouchableOpacity
                      style={[
                        styles.githubButton,
                        (isLoading || !email || !password) && styles.authButtonDisabled,
                      ]}
                      onPress={isSignUp ? handleEmailPasswordSignUp : handleEmailPasswordSignIn}
                      disabled={isLoading || !email || !password}
                      activeOpacity={0.9}>
                      <LinearGradient
                        colors={
                          isLoading || !email || !password
                            ? [VibraColors.neutral.textSecondary, VibraColors.neutral.textTertiary]
                            : [VibraColors.neutral.text, VibraColors.neutral.textSecondary]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.githubButtonGradient}>
                        <Text style={styles.authButtonText}>
                          {isLoading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setIsSignUp(!isSignUp)}
                      style={styles.switchAuthButton}>
                      <Text style={styles.switchAuthText}>
                        {isSignUp
                          ? 'Already have an account? Sign in'
                          : "Don't have an account? Sign up"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setShowEmailPassword(false)}
                      style={styles.backToOAuthButton}>
                      <Text style={styles.backToOAuthText}>Back to OAuth options</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.verificationTitle}>Verify your email</Text>
                    <Text style={styles.verificationSubtitle}>
                      We sent a verification code to {email}
                    </Text>
                    <TextInput
                      style={[styles.githubButton, styles.emailInput]}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder="Enter verification code"
                      placeholderTextColor="#888888"
                      keyboardType="number-pad"
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={[
                        styles.githubButton,
                        (isLoading || !verificationCode) && styles.authButtonDisabled,
                      ]}
                      onPress={handleEmailVerification}
                      disabled={isLoading || !verificationCode}
                      activeOpacity={0.9}>
                      <LinearGradient
                        colors={
                          isLoading || !verificationCode
                            ? [VibraColors.neutral.textSecondary, VibraColors.neutral.textTertiary]
                            : [VibraColors.neutral.text, VibraColors.neutral.textSecondary]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.githubButtonGradient}>
                        <Text style={styles.authButtonText}>
                          {isLoading ? 'Verifying...' : 'Verify Email'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setPendingVerification(false);
                        setVerificationCode('');
                      }}
                      style={styles.switchAuthButton}>
                      <Text style={styles.switchAuthText}>Back to sign up</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </Animated.View>

          {/* Terms */}
          <Animated.View
            style={[styles.termsSection, { transform: [{ translateY: contentSlide }] }]}>
            <Text style={styles.termsText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </Animated.View>
        </ScrollView>

        {/* Progress Indicator */}
        <View style={styles.progressSection}>
          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotCompleted]} />
            <View style={[styles.dot, styles.dotCompleted]} />
            <View style={[styles.dot, styles.dotCompleted]} />
            <View style={[styles.dot, styles.dotCompleted]} />
            <View style={[styles.dot, styles.dotCompleted]} />
            <View style={[styles.dot, styles.dotActive]} />
          </View>
          <Text style={styles.progressText}>Almost there! Final step.</Text>
        </View>
      </View>
    </VibraCosmicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },

  // Floating Badges
  floatingBadge: {
    position: 'absolute',
    top: 120,
    right: 20,
    zIndex: 10,
  },
  badgeGradient: {
    paddingHorizontal: VibraSpacing.md,
    paddingVertical: VibraSpacing.xs,
    borderRadius: VibraBorderRadius.xl,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Header
  header: {
    paddingHorizontal: VibraSpacing.lg,
    paddingBottom: VibraSpacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: VibraSpacing.xl,
    paddingBottom: VibraSpacing['2xl'],
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: VibraSpacing['2xl'],
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: VibraSpacing.lg,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  brandText: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.2,
    textAlign: 'center',
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  brandTagline: {
    fontSize: 16,
    fontWeight: '400',
    color: VibraColors.neutral.textSecondary,
    marginTop: VibraSpacing.xs,
    opacity: 0.9,
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // Welcome Section
  welcomeSection: {
    alignItems: 'center',
    marginBottom: VibraSpacing['2xl'],
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: VibraSpacing.md,
    letterSpacing: -0.5,
  },
  welcomeText: {
    fontSize: 16,
    color: VibraColors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: VibraSpacing.lg,
  },

  // Features Reminder
  featuresReminder: {
    marginBottom: VibraSpacing['2xl'],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VibraSpacing.sm,
    paddingHorizontal: VibraSpacing.lg,
    marginBottom: VibraSpacing.xs,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: VibraBorderRadius.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  featureText: {
    color: VibraColors.neutral.text,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: VibraSpacing.sm,
  },

  // Auth Section
  authSection: {
    marginBottom: VibraSpacing.xl,
  },
  githubButton: {
    borderRadius: VibraBorderRadius.lg,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    overflow: 'hidden',
    marginBottom: VibraSpacing.lg,
    width: '100%',
  },
  githubButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    gap: VibraSpacing.md,
    minHeight: 64,
  },
  authButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  authButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  ctaText: {
    color: VibraColors.accent.teal,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },

  // Terms
  termsSection: {
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: VibraColors.neutral.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '400',
    opacity: 0.8,
    letterSpacing: 0.1,
    paddingHorizontal: VibraSpacing.md,
  },

  // Progress
  progressSection: {
    alignItems: 'center',
    paddingVertical: VibraSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: VibraColors.neutral.border,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
  },
  dots: {
    flexDirection: 'row',
    gap: VibraSpacing.sm,
    marginBottom: VibraSpacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: VibraColors.neutral.border,
  },
  dotCompleted: {
    backgroundColor: VibraColors.accent.teal,
  },
  dotActive: {
    backgroundColor: VibraColors.accent.purple,
  },
  progressText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },

  // Email/Password Styles
  emailPasswordToggle: {
    paddingVertical: VibraSpacing.md,
    alignItems: 'center',
    marginTop: VibraSpacing.lg,
  },
  emailPasswordText: {
    color: VibraColors.accent.purple,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },
  backToOAuthButton: {
    paddingVertical: VibraSpacing.sm,
    alignItems: 'center',
    marginTop: VibraSpacing.md,
  },
  backToOAuthText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },
  emailInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    paddingLeft: VibraSpacing.md,
    minHeight: 64,
    backgroundColor: '#333333',
    borderColor: '#444444',
  },
  switchAuthButton: {
    paddingVertical: VibraSpacing.sm,
    alignItems: 'center',
  },
  switchAuthText: {
    color: VibraColors.accent.purple,
    fontSize: 14,
    fontWeight: '500',
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: VibraSpacing.lg,
    marginBottom: VibraSpacing.sm,
  },
  verificationSubtitle: {
    fontSize: 14,
    color: VibraColors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: VibraSpacing.lg,
  },
});
