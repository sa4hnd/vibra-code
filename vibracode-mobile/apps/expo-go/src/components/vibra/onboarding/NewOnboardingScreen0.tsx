import { useSSO, useSignUp, useSignIn, useAuth } from '@clerk/clerk-expo';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Mail, Eye, EyeOff, ChevronLeft, ArrowRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  Animated,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { OnboardingHaptics, OnboardingAnimations } from './OnboardingConstants';

// Welcome screen background - embedded in native iOS bundle for instant loading
// On iOS: loads from Images.xcassets/OnboardingWelcomeBg.imageset
// On Android/dev: falls back to require()
const WELCOME_BG_NATIVE = { uri: 'OnboardingWelcomeBg' };
const WELCOME_BG_FALLBACK = require('../../../assets/onboarding/screen0/welcome_bg.png');

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

// Check if Liquid Glass is available
const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

interface NewOnboardingScreen0Props {
  onLoginComplete: (isNewUser: boolean) => void;
}

// Official Google "G" Icon - multicolor logo
const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

// Official Apple Logo Icon
const AppleIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
  </Svg>
);

// Official GitHub Logo Icon (Octocat)
const GitHubIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2C6.477 2 2 6.477 2 12C2 16.418 4.865 20.166 8.839 21.489C9.339 21.581 9.521 21.272 9.521 21.007C9.521 20.769 9.513 20.14 9.508 19.307C6.726 19.917 6.139 17.966 6.139 17.966C5.685 16.812 5.029 16.503 5.029 16.503C4.121 15.883 5.098 15.896 5.098 15.896C6.101 15.967 6.629 16.926 6.629 16.926C7.521 18.455 8.97 18.013 9.539 17.758C9.631 17.11 9.889 16.669 10.175 16.42C7.954 16.167 5.62 15.31 5.62 11.477C5.62 10.386 6.01 9.494 6.649 8.794C6.546 8.542 6.203 7.524 6.747 6.148C6.747 6.148 7.587 5.88 9.497 7.173C10.295 6.95 11.15 6.84 12 6.836C12.85 6.84 13.705 6.95 14.505 7.173C16.413 5.88 17.251 6.148 17.251 6.148C17.797 7.524 17.454 8.542 17.351 8.794C17.991 9.494 18.379 10.386 18.379 11.477C18.379 15.321 16.041 16.164 13.813 16.41C14.172 16.722 14.496 17.338 14.496 18.274C14.496 19.608 14.484 20.675 14.484 21.007C14.484 21.275 14.664 21.586 15.174 21.487C19.145 20.161 22 16.416 22 12C22 6.477 17.523 2 12 2Z" />
  </Svg>
);

// Glass Button Component
const GlassButton: React.FC<{
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  children: React.ReactNode;
}> = ({ onPress, disabled, style, children }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: OnboardingAnimations.buttonPress.scale,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  };

  const content = <View style={styles.glassButtonContent}>{children}</View>;

  if (useGlass) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={1}>
          <GlassView style={styles.glassButton} isInteractive>
            {content}
          </GlassView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.8}>
        <View style={styles.blurButton}>
          <BlurView intensity={40} tint="dark" style={styles.blurButtonContent}>
            {content}
          </BlurView>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Glass Input Component
const GlassInput: React.FC<{
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  rightIcon?: React.ReactNode;
}> = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  rightIcon,
}) => {
  const content = (
    <View style={styles.glassInputInner}>
      <TextInput
        style={styles.glassInputText}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255, 255, 255, 0.4)"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
      />
      {rightIcon}
    </View>
  );

  if (useGlass) {
    return (
      <GlassView style={styles.glassInput} isInteractive>
        {content}
      </GlassView>
    );
  }

  return (
    <View style={styles.blurInput}>
      <BlurView intensity={30} tint="dark" style={styles.blurInputContent}>
        {content}
      </BlurView>
    </View>
  );
};

export const NewOnboardingScreen0: React.FC<NewOnboardingScreen0Props> = ({ onLoginComplete }) => {
  useWarmUpBrowser();

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Auth hooks
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: isSignInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Track if we're in an active auth flow to prevent auto-complete from overriding
  const isAuthInProgress = useRef(false);
  const hasCompletedLogin = useRef(false);

  // Animation values - start visible (opacity 1) so content shows even if image fails to load
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  // Run entrance animations when image loads
  useEffect(() => {
    if (imageLoaded) {
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [imageLoaded]);

  // Auto-complete if already signed in (only on initial mount, not during auth flow)
  useEffect(() => {
    // Skip if we're in the middle of an auth flow or already completed login
    if (isAuthInProgress.current || hasCompletedLogin.current) {
      return;
    }
    if (isSignedIn) {
      hasCompletedLogin.current = true;
      onLoginComplete(false);
    }
  }, [isSignedIn, onLoginComplete]);

  // OAuth Sign In Handler
  const handleOAuthSignIn = useCallback(
    async (strategy: 'oauth_github' | 'oauth_google' | 'oauth_apple') => {
      try {
        setIsLoading(true);
        setLoadingProvider(strategy);
        isAuthInProgress.current = true;

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
          const isNewUser = !!ssoSignUp?.createdUserId;

          console.log('🔐 OAuth result:', {
            strategy,
            isNewUser,
            signUpStatus: ssoSignUp?.status,
            signUpCreatedUserId: ssoSignUp?.createdUserId,
            signInStatus: ssoSignIn?.status,
          });

          setActive!({
            session: createdSessionId,
            navigate: async ({ session }) => {
              if (session?.currentTask) {
                console.log(session?.currentTask);
                return;
              }
              OnboardingHaptics.success();
              hasCompletedLogin.current = true;
              onLoginComplete(isNewUser);
            },
          });
        }
      } catch (error: any) {
        console.error('OAuth error:', error);
        isAuthInProgress.current = false;
        Alert.alert(
          'Authentication Error',
          error.errors?.[0]?.message || 'Authentication failed. Please try again.'
        );
      } finally {
        setIsLoading(false);
        setLoadingProvider(null);
      }
    },
    [startSSOFlow, onLoginComplete]
  );

  // Email/Password Sign Up Handler
  const handleEmailPasswordSignUp = useCallback(async () => {
    if (!isSignUpLoaded || !signUp || !setActiveSignUp) return;

    if (isSignedIn && !isAuthInProgress.current) {
      hasCompletedLogin.current = true;
      onLoginComplete(false);
      return;
    }

    try {
      setIsLoading(true);
      isAuthInProgress.current = true;

      const signUpResult = await signUp.create({
        emailAddress: email,
        password,
      });

      if (signUpResult.status === 'complete') {
        if (signUpResult.createdSessionId) {
          try {
            await setActiveSignUp({ session: signUpResult.createdSessionId });
            OnboardingHaptics.success();
            hasCompletedLogin.current = true;
            onLoginComplete(true);
          } catch (setActiveError: any) {
            console.error('Set active error:', setActiveError);
            isAuthInProgress.current = false;
            if (setActiveError.message?.includes('already') || isSignedIn) {
              hasCompletedLogin.current = true;
              onLoginComplete(false);
            } else {
              Alert.alert('Error', 'Account created but failed to sign in. Please try signing in.');
            }
          }
        }
      } else if (signUpResult.status === 'missing_requirements') {
        try {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
        } catch (verifyError: any) {
          console.log('Verification not required');
          if (signUpResult.createdSessionId) {
            await setActiveSignUp({ session: signUpResult.createdSessionId });
            OnboardingHaptics.success();
            hasCompletedLogin.current = true;
            onLoginComplete(true);
          }
        }
      } else {
        isAuthInProgress.current = false;
        Alert.alert('Sign Up Error', 'Sign up incomplete. Please try again.');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      isAuthInProgress.current = false;
      const errorMessage = error.errors?.[0]?.message || error.message || 'Failed to sign up.';
      if (errorMessage.includes('already signed')) {
        hasCompletedLogin.current = true;
        onLoginComplete(false);
      } else {
        Alert.alert('Sign Up Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignUpLoaded, signUp, setActiveSignUp, email, password, isSignedIn, onLoginComplete]);

  // Email Verification Handler
  const handleEmailVerification = useCallback(async () => {
    if (!isSignUpLoaded || !signUp || !setActiveSignUp) return;

    try {
      setIsLoading(true);

      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (signUpAttempt.status === 'complete') {
        if (signUpAttempt.createdSessionId) {
          try {
            await setActiveSignUp({ session: signUpAttempt.createdSessionId });
            OnboardingHaptics.success();
            hasCompletedLogin.current = true;
            onLoginComplete(true);
          } catch (setActiveError: any) {
            isAuthInProgress.current = false;
            if (setActiveError.message?.includes('already') || isSignedIn) {
              hasCompletedLogin.current = true;
              onLoginComplete(false);
            } else {
              Alert.alert('Error', 'Failed to sign in. Please try signing in manually.');
            }
          }
        }
      } else {
        Alert.alert('Verification Error', 'Verification incomplete. Please try again.');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      isAuthInProgress.current = false;
      const errorMessage = error.errors?.[0]?.message || 'Failed to verify email.';
      if (errorMessage.includes('already signed') || errorMessage.includes('session')) {
        hasCompletedLogin.current = true;
        onLoginComplete(false);
      } else if (errorMessage.includes('No sign up attempt')) {
        setPendingVerification(false);
        setVerificationCode('');
        Alert.alert('Verification Error', 'Session expired. Please try signing up again.');
      } else {
        Alert.alert('Verification Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignUpLoaded, signUp, setActiveSignUp, verificationCode, isSignedIn, onLoginComplete]);

  // Email/Password Sign In Handler
  const handleEmailPasswordSignIn = useCallback(async () => {
    if (!isSignInLoaded || !signIn || !setActiveSignIn) return;

    if (isSignedIn && !isAuthInProgress.current) {
      hasCompletedLogin.current = true;
      onLoginComplete(false);
      return;
    }

    try {
      setIsLoading(true);
      isAuthInProgress.current = true;

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
            OnboardingHaptics.success();
            hasCompletedLogin.current = true;
            onLoginComplete(false);
          },
        });
      } else {
        isAuthInProgress.current = false;
        Alert.alert('Sign In Error', 'Sign in incomplete. Please try again.');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      isAuthInProgress.current = false;
      const errorMessage = error.errors?.[0]?.message || 'Failed to sign in.';
      if (errorMessage.includes('already signed')) {
        hasCompletedLogin.current = true;
        onLoginComplete(false);
      } else {
        Alert.alert('Sign In Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignInLoaded, signIn, setActiveSignIn, email, password, isSignedIn, onLoginComplete]);

  const canSubmitEmail = email.trim().length > 0 && password.trim().length >= 6;
  const canVerify = verificationCode.trim().length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Image */}
      <Image
        source={Platform.OS === 'ios' ? WELCOME_BG_NATIVE : WELCOME_BG_FALLBACK}
        style={[styles.backgroundImage, { width, height }]}
        resizeMode="cover"
        onLoad={() => {
          console.log('✅ Welcome background image loaded successfully');
          setImageLoaded(true);
        }}
        onError={(e) => {
          console.error('❌ Welcome background image failed to load:', e.nativeEvent.error);
          setImageError(true);
        }}
      />

      {/* Fallback to JS bundle asset if native asset fails */}
      {imageError && (
        <Image
          source={WELCOME_BG_FALLBACK}
          style={[styles.backgroundImage, { width, height }]}
          resizeMode="cover"
          onLoad={() => {
            console.log('✅ Welcome background fallback image loaded');
            setImageLoaded(true);
            setImageError(false);
          }}
        />
      )}

      {/* Dark gradient overlay at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)', '#000000']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={styles.gradientOverlay}
      />

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top, paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Spacer to push title and buttons down */}
          <View style={styles.topSpacer} />

          {/* Title - Positioned lower */}
          <Animated.View
            style={[
              styles.titleSection,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}>
            <Text style={styles.titleText}>Build your idea</Text>
            <Text style={styles.titleTextSecond}>in minutes</Text>
          </Animated.View>

          {/* Spacer between title and buttons */}
          <View style={styles.middleSpacer} />

          {/* Auth Buttons Section - Bottom */}
          <Animated.View
            style={[
              styles.authSection,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}>
            {!showEmailForm ? (
              <>
                {/* Apple Button - Primary white button */}
                <TouchableOpacity
                  style={styles.appleButton}
                  onPress={() => handleOAuthSignIn('oauth_apple')}
                  disabled={isLoading}
                  activeOpacity={0.8}>
                  <AppleIcon size={20} color="#000000" />
                  <Text style={styles.appleButtonText}>
                    {loadingProvider === 'oauth_apple' ? 'Connecting...' : 'Continue with Apple'}
                  </Text>
                </TouchableOpacity>

                {/* Google Button - Glass */}
                <GlassButton
                  onPress={() => handleOAuthSignIn('oauth_google')}
                  disabled={isLoading}>
                  <GoogleIcon size={20} />
                  <Text style={styles.glassButtonText}>
                    {loadingProvider === 'oauth_google' ? 'Connecting...' : 'Continue with Google'}
                  </Text>
                </GlassButton>

                {/* GitHub Button - Glass */}
                <GlassButton
                  onPress={() => handleOAuthSignIn('oauth_github')}
                  disabled={isLoading}>
                  <GitHubIcon size={20} color="#FFFFFF" />
                  <Text style={styles.glassButtonText}>
                    {loadingProvider === 'oauth_github' ? 'Connecting...' : 'Continue with GitHub'}
                  </Text>
                </GlassButton>

                {/* Email Option - Text link style */}
                <TouchableOpacity
                  style={styles.emailToggle}
                  onPress={() => {
                    OnboardingHaptics.light();
                    setShowEmailForm(true);
                  }}
                  disabled={isLoading}>
                  <Mail size={16} color="rgba(255, 255, 255, 0.6)" />
                  <Text style={styles.emailToggleText}>Continue with Email</Text>
                </TouchableOpacity>
              </>
            ) : pendingVerification ? (
              <>
                {/* Title */}
                <Text style={styles.emailFormTitle}>Verify your email</Text>

                <Text style={styles.emailFormSubtitle}>
                  We sent a verification code to {email}
                </Text>

                {/* Verification Code Input */}
                <GlassInput
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="Enter verification code"
                  keyboardType="number-pad"
                  editable={!isLoading}
                />

                {/* Verify Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, (!canVerify || isLoading) && styles.primaryButtonDisabled]}
                  onPress={handleEmailVerification}
                  disabled={isLoading || !canVerify}
                  activeOpacity={0.8}>
                  <Text style={[styles.primaryButtonText, (!canVerify || isLoading) && styles.primaryButtonTextDisabled]}>
                    {isLoading ? 'Verifying...' : 'Verify Email'}
                  </Text>
                  {canVerify && !isLoading && <ArrowRight size={18} color="#000000" />}
                </TouchableOpacity>

                {/* Back to email form */}
                <TouchableOpacity
                  style={styles.backToOAuthButton}
                  onPress={() => {
                    OnboardingHaptics.light();
                    setPendingVerification(false);
                    setVerificationCode('');
                  }}
                  disabled={isLoading}>
                  <ChevronLeft size={16} color="rgba(255, 255, 255, 0.5)" />
                  <Text style={styles.backToOAuthText}>Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Title */}
                <Text style={styles.emailFormTitle}>
                  {isSignUpMode ? 'Create account' : 'Welcome back'}
                </Text>

                <Text style={styles.emailFormSubtitle}>
                  {isSignUpMode
                    ? 'Enter your email to get started'
                    : 'Sign in to continue building'}
                </Text>

                {/* Email Input */}
                <GlassInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  keyboardType="email-address"
                  editable={!isLoading}
                />

                {/* Password Input */}
                <GlassInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.passwordToggle}>
                      {showPassword ? (
                        <EyeOff size={20} color="rgba(255, 255, 255, 0.5)" />
                      ) : (
                        <Eye size={20} color="rgba(255, 255, 255, 0.5)" />
                      )}
                    </TouchableOpacity>
                  }
                />

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.primaryButton, (!canSubmitEmail || isLoading) && styles.primaryButtonDisabled]}
                  onPress={isSignUpMode ? handleEmailPasswordSignUp : handleEmailPasswordSignIn}
                  disabled={isLoading || !canSubmitEmail}
                  activeOpacity={0.8}>
                  <Text style={[styles.primaryButtonText, (!canSubmitEmail || isLoading) && styles.primaryButtonTextDisabled]}>
                    {isLoading ? 'Please wait...' : isSignUpMode ? 'Create Account' : 'Sign In'}
                  </Text>
                  {canSubmitEmail && !isLoading && <ArrowRight size={18} color="#000000" />}
                </TouchableOpacity>

                {/* Switch mode */}
                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => setIsSignUpMode(!isSignUpMode)}>
                  <Text style={styles.switchModeText}>
                    {isSignUpMode
                      ? 'Already have an account? '
                      : "Don't have an account? "}
                    <Text style={styles.switchModeTextBold}>
                      {isSignUpMode ? 'Sign in' : 'Sign up'}
                    </Text>
                  </Text>
                </TouchableOpacity>

                {/* Back to OAuth options */}
                <TouchableOpacity
                  style={styles.backToOAuthButton}
                  onPress={() => {
                    OnboardingHaptics.light();
                    setShowEmailForm(false);
                    setEmail('');
                    setPassword('');
                  }}
                  disabled={isLoading}>
                  <ChevronLeft size={16} color="rgba(255, 255, 255, 0.5)" />
                  <Text style={styles.backToOAuthText}>Other sign in options</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // Spacers for layout
  topSpacer: {
    flex: 1,
  },
  middleSpacer: {
    flex: 1.2,
  },

  // Title Section - Centered with elegant typography
  titleSection: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 48,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-light',
  },
  titleTextSecond: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 48,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },

  // Auth Section
  authSection: {
    marginBottom: 16,
    gap: 12,
  },

  // Apple Button - Primary white button
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
    minHeight: 56,
  },
  appleButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },

  // Glass Button styles
  glassButton: {
    borderRadius: 28,
    minHeight: 56,
    overflow: 'hidden',
  },
  glassButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
    minHeight: 56,
  },
  glassButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  blurButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  blurButtonContent: {
    borderRadius: 28,
  },

  // Glass Input styles
  glassInput: {
    borderRadius: 16,
    minHeight: 56,
    marginBottom: 12,
  },
  glassInputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  glassInputText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  blurInput: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  blurInputContent: {
    borderRadius: 16,
  },

  // Email form title (standalone, no header)
  emailFormTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  emailFormSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },

  // Email Toggle - Subtle text link
  emailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emailToggleText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
  },

  // Primary Button - White
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    minHeight: 56,
    marginTop: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
  primaryButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },

  // Password toggle
  passwordToggle: {
    padding: 4,
  },

  // Switch mode
  switchModeButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  switchModeTextBold: {
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Back to OAuth options
  backToOAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    marginTop: 8,
  },
  backToOAuthText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

export default NewOnboardingScreen0;
