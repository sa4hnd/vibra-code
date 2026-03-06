import { useSSO, useSignUp, useSignIn, useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { X, Github, Apple } from 'lucide-react-native';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  ScrollView,
} from 'react-native';

import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface VibraAuthModalProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

// Browser warm-up hook for better UX
const useWarmUpBrowser = () => {
  useEffect(() => {
    // Preloads the browser for Android devices to reduce authentication load time
    void WebBrowser.warmUpAsync();
    return () => {
      // Cleanup: closes browser when component unmounts
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export const VibraAuthModal: React.FC<VibraAuthModalProps> = ({
  visible,
  onClose,
  initialMode = 'signup',
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
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Close modal if user is already signed in
  useEffect(() => {
    if (isSignedIn && visible) {
      onClose();
    }
  }, [isSignedIn, visible, onClose]);

  const handleOAuthSignIn = useCallback(
    async (strategy: 'oauth_github' | 'oauth_google' | 'oauth_apple') => {
      try {
        setIsLoading(true);

        // Start the authentication process using useSSO hook
        const {
          createdSessionId,
          setActive,
          signIn: ssoSignIn,
          signUp: ssoSignUp,
        } = await startSSOFlow({
          strategy,
          redirectUrl: 'exp://localhost:8081', // Use localhost for development
        });

        // If sign in was successful, set the active session
        if (createdSessionId) {
          setActive!({
            session: createdSessionId,
            navigate: async ({ session }) => {
              if (session?.currentTask) {
                console.log(session?.currentTask);
                return;
              }
              onClose();
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
    [startSSOFlow, onClose]
  );

  const handleEmailPasswordSignUp = useCallback(async () => {
    if (!isSignUpLoaded || !signUp || !setActiveSignUp) return;

    // Check if user is already signed in
    if (isSignedIn) {
      Alert.alert('Already Signed In', 'You are already signed in. Closing the modal.');
      onClose();
      return;
    }

    try {
      setIsLoading(true);

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
            // Wait a bit for the session to be set, then close
            setTimeout(() => {
              onClose();
            }, 500);
          } catch (setActiveError: any) {
            console.error('Set active error:', setActiveError);
            if (setActiveError.message?.includes('already') || isSignedIn) {
              onClose();
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
            onClose();
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
              onClose();
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
        Alert.alert('Already Signed In', 'You are already signed in. Closing the modal.');
        onClose();
      } else {
        Alert.alert('Sign Up Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignUpLoaded, signUp, setActiveSignUp, email, password, isSignedIn, onClose]);

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
            // Wait a bit for the session to be set, then close
            setTimeout(() => {
              onClose();
            }, 500);
          } catch (setActiveError: any) {
            console.error('Set active error:', setActiveError);
            // If setting active fails but we have a session, user might already be signed in
            if (setActiveError.message?.includes('already') || isSignedIn) {
              onClose();
            } else {
              Alert.alert('Error', 'Failed to sign in. Please try signing in manually.');
            }
          }
        } else {
          // If no session ID but status is complete, check if already signed in
          if (isSignedIn) {
            onClose();
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
        // User is already signed in, just close the modal
        onClose();
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
  }, [isSignUpLoaded, signUp, setActiveSignUp, verificationCode, isSignedIn, onClose]);

  const handleEmailPasswordSignIn = useCallback(async () => {
    if (!isSignInLoaded || !signIn || !setActiveSignIn) return;

    // Check if user is already signed in
    if (isSignedIn) {
      Alert.alert('Already Signed In', 'You are already signed in. Closing the modal.');
      onClose();
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
            onClose();
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
        Alert.alert('Already Signed In', 'You are already signed in. Closing the modal.');
        onClose();
      } else {
        Alert.alert('Sign In Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignInLoaded, signIn, setActiveSignIn, email, password, isSignedIn, onClose]);

  const handleClose = () => {
    // Reset form state when closing
    setEmail('');
    setPassword('');
    setPendingVerification(false);
    setVerificationCode('');
    setIsSignUp(initialMode === 'signup');
    setShowEmailPassword(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={20} color={VibraColors.neutral.textTertiary} />
          </TouchableOpacity>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            nestedScrollEnabled>
            <View style={styles.logoSection}>
              <Image
                source={{ uri: 'https://i.imgur.com/fPrpRh3.png' }}
                style={styles.appIcon}
                resizeMode="contain"
              />
              <View style={styles.brandText}>
                <Text style={styles.brandTitle}>Vibra Code</Text>
                <Text style={styles.brandTagline}>Build amazing apps</Text>
              </View>
            </View>

            <Text style={styles.subtitle}>Sign in to start building amazing apps with AI</Text>

            {/* OAuth Sign In Buttons or Email/Password Form */}
            {!showEmailPassword ? (
              <>
                <View style={styles.authSection}>
                  {/* Google Sign In Button */}
                  <TouchableOpacity
                    style={[styles.authButton, isLoading && styles.authButtonDisabled]}
                    onPress={() => handleOAuthSignIn('oauth_google')}
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
                      style={styles.authButtonGradient}>
                      <View style={styles.iconWrapper}>
                        <Text style={styles.googleIcon}>G</Text>
                      </View>
                      <Text style={styles.authButtonText}>
                        {isLoading ? 'Connecting...' : 'Continue with Google'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* GitHub Sign In Button */}
                  <TouchableOpacity
                    style={[styles.authButton, isLoading && styles.authButtonDisabled]}
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
                      style={styles.authButtonGradient}>
                      <Github size={20} color="#000000" />
                      <Text style={styles.authButtonText}>
                        {isLoading ? 'Connecting...' : 'Continue with GitHub'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Apple Sign In Button */}
                  <TouchableOpacity
                    style={[styles.authButton, isLoading && styles.authButtonDisabled]}
                    onPress={() => handleOAuthSignIn('oauth_apple')}
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
                      style={styles.authButtonGradient}>
                      <Apple size={20} color="#000000" />
                      <Text style={styles.authButtonText}>
                        {isLoading ? 'Connecting...' : 'Continue with Apple'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

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
                      style={[styles.authButton, styles.emailInput]}
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
                      style={[styles.authButton, styles.emailInput]}
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
                        styles.authButton,
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
                        style={styles.authButtonGradient}>
                        <Text style={styles.authButtonText}>
                          {isLoading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setIsSignUp(!isSignUp)}
                      style={styles.backToOAuthButton}>
                      <Text style={styles.backToOAuthText}>
                        {isSignUp
                          ? 'Already have an account? Sign in'
                          : "Don't have an account? Sign up"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setShowEmailPassword(false)}
                      style={styles.backToOAuthButton}>
                      <Text style={styles.backToOAuthText}>← Back to OAuth options</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.verificationTitle}>Verify your email</Text>
                    <Text style={styles.verificationSubtitle}>
                      We sent a verification code to {email}
                    </Text>
                    <TextInput
                      style={[styles.authButton, styles.emailInput]}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder="Enter verification code"
                      placeholderTextColor="#888888"
                      keyboardType="number-pad"
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={[
                        styles.authButton,
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
                        style={styles.authButtonGradient}>
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

            <Text style={styles.termsText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
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
  closeButton: {
    position: 'absolute',
    top: VibraSpacing.lg,
    right: VibraSpacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: VibraSpacing.xl,
    paddingTop: VibraSpacing['3xl'], // Extra padding for close button
    paddingBottom: VibraSpacing['2xl'],
  },
  logoSection: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: VibraSpacing['2xl'],
    gap: VibraSpacing.lg,
  },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  brandText: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1.0,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 18,
    fontWeight: '400',
    color: '#CCCCCC',
    marginTop: 8,
    opacity: 0.8,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: VibraSpacing['3xl'],
    lineHeight: 26,
    fontWeight: '400',
    opacity: 0.9,
    paddingHorizontal: VibraSpacing.lg,
  },
  authSection: {
    marginBottom: VibraSpacing['2xl'],
  },
  authButton: {
    borderRadius: 16,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    overflow: 'hidden',
    marginBottom: VibraSpacing.md,
    width: '100%',
  },
  authButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    gap: VibraSpacing.md,
    minHeight: 56,
  },
  authButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  authButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  termsText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '400',
    opacity: 0.8,
    letterSpacing: 0.1,
    paddingHorizontal: VibraSpacing.md,
  },
  iconWrapper: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'System',
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
    textAlign: 'center',
  },
  emailInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    paddingLeft: VibraSpacing.md,
    minHeight: 56,
    backgroundColor: '#333333',
    borderColor: '#444444',
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
