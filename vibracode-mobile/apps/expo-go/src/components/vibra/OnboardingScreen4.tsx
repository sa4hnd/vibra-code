import { useSSO, useSignUp, useSignIn, useAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  ImageBackground,
  Linking,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface OnboardingScreen4Props {
  onNext: () => void;
  onBack: () => void;
}

export const OnboardingScreen4: React.FC<OnboardingScreen4Props> = ({ onNext, onBack }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive breakpoints
  const isTablet = width > 768;
  const isLandscape = width > height;
  const isCompact = height < 700;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleSlide = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const signInOpacity = useRef(new Animated.Value(0)).current;

  // Responsive styles
  const responsiveStyles = {
    imageHeight: isLandscape
      ? height * 0.35
      : isTablet
        ? height * 0.35
        : isCompact
          ? height * 0.32
          : height * 0.38,
    titleSize: isTablet ? 32 : isCompact ? 28 : 32,
    titleLineHeight: isTablet ? 40 : isCompact ? 34 : 40,
    subtitleSize: isTablet ? 16 : isCompact ? 15 : 17,
    subtitleLineHeight: isTablet ? 22 : isCompact ? 20 : 24,
    buttonWidth: isTablet ? Math.min(400, width * 0.5) : width * 0.8,
  };

  // State for auth flow
  const [showAuthOptions, setShowAuthOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // Authentication hooks
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: isSignInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();

  // Complete onboarding if user is already signed in
  useEffect(() => {
    if (isSignedIn) {
      onNext();
    }
  }, [isSignedIn, onNext]);

  // GitHub authentication handler
  const handleGitHubAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      const {
        createdSessionId,
        setActive,
        signIn: ssoSignIn,
        signUp: ssoSignUp,
      } = await startSSOFlow({
        strategy: 'oauth_github',
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
            onNext(); // Proceed to next screen after successful auth
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
      console.error('GitHub OAuth error:', error);
      Alert.alert(
        'Authentication Error',
        error.errors?.[0]?.message || 'GitHub authentication failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [startSSOFlow, onNext]);

  // Google authentication handler
  const handleGoogleAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      const {
        createdSessionId,
        setActive,
        signIn: ssoSignIn,
        signUp: ssoSignUp,
      } = await startSSOFlow({
        strategy: 'oauth_google',
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
            onNext(); // Proceed to next screen after successful auth
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
      console.error('Google OAuth error:', error);
      Alert.alert(
        'Authentication Error',
        error.errors?.[0]?.message || 'Google authentication failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [startSSOFlow, onNext]);

  // Apple authentication handler
  const handleAppleAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      const {
        createdSessionId,
        setActive,
        signIn: ssoSignIn,
        signUp: ssoSignUp,
      } = await startSSOFlow({
        strategy: 'oauth_apple',
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
            onNext(); // Proceed to next screen after successful auth
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
      console.error('Apple OAuth error:', error);
      Alert.alert(
        'Authentication Error',
        error.errors?.[0]?.message || 'Apple authentication failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [startSSOFlow, onNext]);

  const handleEmailPasswordSignUp = useCallback(async () => {
    if (!isSignUpLoaded || !signUp || !setActiveSignUp) return;

    if (isSignedIn) {
      onNext();
      return;
    }

    try {
      setIsLoading(true);

      const signUpResult = await signUp.create({
        emailAddress: email,
        password,
      });

      if (signUpResult.status === 'complete') {
        if (signUpResult.createdSessionId) {
          try {
            await setActiveSignUp({
              session: signUpResult.createdSessionId,
            });
            setShowEmailModal(false);
            setEmail('');
            setPassword('');
            setTimeout(() => {
              onNext();
            }, 500);
          } catch (setActiveError: any) {
            console.error('Set active error:', setActiveError);
            if (setActiveError.message?.includes('already') || isSignedIn) {
              setShowEmailModal(false);
              setEmail('');
              setPassword('');
              onNext();
            } else {
              Alert.alert(
                'Error',
                'Account created but failed to sign in. Please try signing in manually.'
              );
            }
          }
        } else {
          setShowEmailModal(false);
          setEmail('');
          setPassword('');
          if (isSignedIn) {
            onNext();
          } else {
            Alert.alert(
              'Error',
              'Account created but session not available. Please try signing in manually.'
            );
          }
        }
      } else if (signUpResult.status === 'missing_requirements') {
        try {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          Alert.alert('Verification Required', 'Please check your email for verification code.');
        } catch (verifyError: any) {
          console.log('Verification not required or failed, completing signup');
          if (signUpResult.createdSessionId) {
            await setActiveSignUp({
              session: signUpResult.createdSessionId,
            });
            setShowEmailModal(false);
            setEmail('');
            setPassword('');
            setTimeout(() => {
              onNext();
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

      if (errorMessage.includes('already signed in') || errorMessage.includes('already signed')) {
        setShowEmailModal(false);
        setEmail('');
        setPassword('');
        onNext();
      } else {
        Alert.alert('Sign Up Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignUpLoaded, signUp, setActiveSignUp, email, password, isSignedIn, onNext]);

  const handleEmailPasswordSignIn = useCallback(async () => {
    if (!isSignInLoaded || !signIn || !setActiveSignIn) return;

    if (isSignedIn) {
      onNext();
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
        });
        setShowEmailModal(false);
        setEmail('');
        setPassword('');
        onNext();
      } else {
        console.error('Sign in incomplete:', signInAttempt);
        Alert.alert('Sign In Error', 'Sign in incomplete. Please try again.');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage =
        error.errors?.[0]?.message || error.message || 'Failed to sign in. Please try again.';

      if (errorMessage.includes('already signed in') || errorMessage.includes('already signed')) {
        setShowEmailModal(false);
        setEmail('');
        setPassword('');
        onNext();
      } else {
        Alert.alert('Sign In Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignInLoaded, signIn, setActiveSignIn, email, password, isSignedIn, onNext]);

  useEffect(() => {
    // Smooth entrance sequence - EXACT same as other screens
    Animated.sequence([
      // Title fade in
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),

      // Subtitle entrance
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(subtitleSlide, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),

      // Sign in section
      Animated.delay(500),
      Animated.timing(signInOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),

      // Button entrance
      Animated.delay(1500),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Section with Image */}
      <View style={[styles.topSection, { height: responsiveStyles.imageHeight }]}>
        <ImageBackground
          source={{ uri: 'https://i.imgur.com/X03kfCx.png' }}
          style={styles.topImage}
          resizeMode="cover"
        />

        {/* Gradual merge mask */}
        <LinearGradient
          colors={['transparent', 'transparent', VibraColors.neutral.background]}
          locations={[0, 0.5, 1]}
          style={styles.topMergeMask}
        />
      </View>

      {/* Main Content Area - flex-based layout */}
      <View
        style={[
          styles.contentSection,
          { paddingBottom: Math.max(insets.bottom + VibraSpacing.xl, VibraSpacing['2xl']) },
        ]}>
        {/* Text Container */}
        <View style={styles.textContainer}>
          {/* Title */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleOpacity,
                fontSize: responsiveStyles.titleSize,
                lineHeight: responsiveStyles.titleLineHeight,
              },
            ]}>
            {!showAuthOptions ? (
              <>
                Welcome to the{'\n'}future of{'\n'}innovation
              </>
            ) : (
              <>Choose your{'\n'}sign-in method</>
            )}
          </Animated.Text>

          {/* Subtitle */}
          {!showAuthOptions && (
            <Animated.Text
              style={[
                styles.subtitle,
                {
                  opacity: subtitleOpacity,
                  transform: [{ translateY: subtitleSlide }],
                  fontSize: responsiveStyles.subtitleSize,
                  lineHeight: responsiveStyles.subtitleLineHeight,
                },
              ]}>
              Where ideas become reality{'\n'}and dreams take flight
            </Animated.Text>
          )}
        </View>

        {/* Sign In Section */}
        <Animated.View style={[styles.signInSection, { opacity: signInOpacity }]}>
          {!showAuthOptions ? (
            <>
              <TouchableOpacity
                style={[styles.signUpButton, { minWidth: responsiveStyles.buttonWidth }]}
                onPress={() => setShowAuthOptions(true)}
                activeOpacity={0.9}>
                <LinearGradient
                  colors={[VibraColors.neutral.text, VibraColors.neutral.textSecondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signUpGradient}>
                  <Text style={styles.signUpText}>Get Started</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Footer Text */}
              <Text style={styles.footerText}>
                By continuing, you agree to our{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => Linking.openURL('https://www.vibracodeapp.com/terms')}>
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => Linking.openURL('https://www.vibracodeapp.com/privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </>
          ) : (
            <>
              {/* Social Auth Options */}
              <TouchableOpacity
                style={[styles.socialButton, { minWidth: responsiveStyles.buttonWidth }]}
                onPress={handleGoogleAuth}
                activeOpacity={0.9}>
                <Ionicons name="logo-google" size={20} color="#FFFFFF" />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { minWidth: responsiveStyles.buttonWidth },
                  isLoading && styles.socialButtonDisabled,
                ]}
                onPress={handleGitHubAuth}
                activeOpacity={0.9}
                disabled={isLoading}>
                <Ionicons name="logo-github" size={20} color="#FFFFFF" />
                <Text style={styles.socialButtonText}>
                  {isLoading ? 'Signing in...' : 'Continue with GitHub'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, { minWidth: responsiveStyles.buttonWidth }]}
                onPress={handleAppleAuth}
                activeOpacity={0.9}>
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.socialButtonText}>Continue with Apple</Text>
              </TouchableOpacity>

              {/* Email/Password Toggle */}
              <TouchableOpacity
                onPress={() => setShowEmailModal(true)}
                style={styles.emailPasswordToggle}>
                <Text style={styles.emailPasswordText}>
                  Or {isSignUp ? 'sign up' : 'sign in'} using email and password
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButtonInline}
                onPress={() => setShowAuthOptions(false)}
                activeOpacity={0.9}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
          </View>
        </View>
      </View>

      {/* Email/Password Modal */}
      <Modal
        visible={showEmailModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowEmailModal(false);
          setEmail('');
          setPassword('');
        }}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowEmailModal(false);
              setEmail('');
              setPassword('');
            }}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.modalContent}>
              <TouchableOpacity
                onPress={() => {
                  setShowEmailModal(false);
                  setEmail('');
                  setPassword('');
                }}
                style={styles.modalCloseButton}>
                <X size={20} color={VibraColors.neutral.textTertiary} />
              </TouchableOpacity>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                  <Text style={styles.modalSubtitle}>
                    {isSignUp
                      ? 'Enter your details to get started'
                      : 'Welcome back! Enter your credentials'}
                  </Text>
                </View>

                <View style={styles.modalForm}>
                  <TextInput
                    style={styles.modalInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    placeholderTextColor="#888888"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    autoFocus={false}
                  />

                  <TextInput
                    style={styles.modalInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#888888"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />

                  <TouchableOpacity
                    style={[
                      styles.modalSubmitButton,
                      (isLoading || !email || !password) && styles.modalSubmitButtonDisabled,
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
                      style={styles.modalSubmitGradient}>
                      <Text style={styles.modalSubmitText}>
                        {isLoading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setIsSignUp(!isSignUp)}
                    style={styles.modalSwitchButton}>
                    <Text style={styles.modalSwitchText}>
                      {isSignUp
                        ? 'Already have an account? Sign in'
                        : "Don't have an account? Sign up"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VibraColors.neutral.background,
  },

  // Top Section with Image
  topSection: {
    position: 'relative',
    overflow: 'hidden',
  },

  topImage: {
    position: 'absolute',
    top: -50,
    left: 0,
    right: 0,
    bottom: -50,
    zIndex: 1,
  },

  topMergeMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },

  // Content Section - flex-based layout
  contentSection: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
  },

  // Text Container
  textContainer: {
    alignItems: 'center',
    paddingTop: VibraSpacing.lg,
    paddingHorizontal: VibraSpacing.md,
  },

  // Typography
  title: {
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: VibraSpacing.md,
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  subtitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    opacity: 0.85,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Sign In Section
  signInSection: {
    width: '100%',
    alignItems: 'center',
  },

  signUpButton: {
    borderRadius: VibraBorderRadius['2xl'],
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: VibraSpacing.lg,
  },

  signUpGradient: {
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    borderRadius: VibraBorderRadius['2xl'],
    alignItems: 'center',
  },

  signUpText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },

  // Progress Dots
  progressContainer: {
    alignItems: 'center',
    paddingTop: VibraSpacing.lg,
  },

  dots: {
    flexDirection: 'row',
    gap: VibraSpacing.sm,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VibraColors.neutral.border,
  },

  dotActive: {
    backgroundColor: VibraColors.neutral.text,
    width: 24,
  },

  // Social Auth Buttons
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333333',
    paddingHorizontal: VibraSpacing['2xl'],
    paddingVertical: VibraSpacing.md,
    borderRadius: VibraBorderRadius['2xl'],
    marginBottom: VibraSpacing.sm,
    borderWidth: 1,
    borderColor: '#444444',
  },

  socialButtonDisabled: {
    opacity: 0.6,
  },

  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: VibraSpacing.sm,
  },

  // Back Button
  backButtonInline: {
    paddingVertical: VibraSpacing.sm,
    alignItems: 'center',
  },

  backButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    opacity: 0.7,
  },

  // Footer Text
  footerText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.6,
    textAlign: 'center',
    marginTop: VibraSpacing.sm,
    paddingHorizontal: VibraSpacing.xl,
    lineHeight: 16,
  },

  linkText: {
    color: '#FFFFFF',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },

  // Email/Password Styles
  emailPasswordToggle: {
    paddingVertical: VibraSpacing.md,
    alignItems: 'center',
    marginTop: VibraSpacing.sm,
  },

  emailPasswordText: {
    color: VibraColors.accent.purple,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBackdrop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: VibraBorderRadius['2xl'],
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
    position: 'relative',
  },

  modalCloseButton: {
    position: 'absolute',
    top: VibraSpacing.lg,
    right: VibraSpacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    zIndex: 10,
  },

  modalScrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },

  modalScrollContent: {
    paddingHorizontal: VibraSpacing['2xl'],
    paddingTop: VibraSpacing['3xl'],
    paddingBottom: VibraSpacing['2xl'],
  },

  modalHeader: {
    alignItems: 'center',
    marginBottom: VibraSpacing['2xl'],
  },

  modalTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: VibraColors.neutral.text,
    textAlign: 'center',
    marginBottom: VibraSpacing.sm,
    letterSpacing: -0.5,
  },

  modalSubtitle: {
    fontSize: 15,
    color: VibraColors.neutral.textSecondary,
    textAlign: 'center',
    opacity: 0.8,
  },

  modalForm: {
    gap: VibraSpacing.lg,
  },

  modalInput: {
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    borderRadius: VibraBorderRadius.lg,
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.md,
    color: VibraColors.neutral.text,
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    minHeight: 52,
  },

  modalSubmitButton: {
    borderRadius: VibraBorderRadius.lg,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    overflow: 'hidden',
    marginTop: VibraSpacing.md,
  },

  modalSubmitButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },

  modalSubmitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.md,
    minHeight: 52,
  },

  modalSubmitText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  modalSwitchButton: {
    paddingVertical: VibraSpacing.md,
    alignItems: 'center',
  },

  modalSwitchText: {
    color: VibraColors.accent.purple,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default OnboardingScreen4;
