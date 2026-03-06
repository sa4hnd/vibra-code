import { useAuth, useSignIn, useOAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons'; // Keep for social logos
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { X } from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert, TextInput } from 'react-native';

interface VibraSignInModalProps {
  visible: boolean;
  onClose: () => void;
}

export const VibraSignInModal: React.FC<VibraSignInModalProps> = ({ visible, onClose }) => {
  const { isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_github' });
  const [isLoading, setIsLoading] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    if (!isLoaded) return;

    try {
      setIsLoading(true);

      // Attempt to sign in
      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        onClose(); // Close modal after successful sign-in
      } else {
        Alert.alert('Sign In Error', 'Sign in failed. Please check your credentials.');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      Alert.alert(
        'Sign In Error',
        error.errors?.[0]?.message || 'Failed to sign in. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = useCallback(async () => {
    try {
      setIsGitHubLoading(true);

      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL('/dashboard', { scheme: 'expo' }),
      });

      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
        onClose(); // Close modal after successful sign-in
      }
    } catch (error: any) {
      console.error('GitHub OAuth error:', error);
      Alert.alert('GitHub Sign In Error', 'Failed to sign in with GitHub. Please try again.');
    } finally {
      setIsGitHubLoading(false);
    }
  }, [startOAuthFlow, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Sign In to Vibra</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.logoSection}>
              <View style={styles.orangeSquare} />
              <Text style={styles.brandTitle}>Vibra Code</Text>
            </View>

            <Text style={styles.subtitle}>
              Sign in to access your projects and continue building amazing apps
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#666666"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#666666"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
              onPress={handleSignIn}
              disabled={isLoading || !email || !password}>
              <Text style={styles.signInButtonText}>{isLoading ? 'Signing In...' : 'Sign In'}</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* GitHub OAuth Button */}
            <TouchableOpacity
              style={[styles.githubButton, isGitHubLoading && styles.githubButtonDisabled]}
              onPress={handleGitHubSignIn}
              disabled={isGitHubLoading}>
              <Ionicons name="logo-github" size={18} color="#FFFFFF" style={styles.githubIcon} />
              <Text style={styles.githubButtonText}>
                {isGitHubLoading ? 'Signing in with GitHub...' : 'Continue with GitHub'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  orangeSquare: {
    width: 40,
    height: 40,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    minWidth: 200,
  },
  signInButtonDisabled: {
    backgroundColor: '#666666',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#555555',
  },
  dividerText: {
    color: '#999999',
    fontSize: 12,
    marginHorizontal: 12,
    fontWeight: '500',
  },
  githubButton: {
    backgroundColor: '#24292E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  githubButtonDisabled: {
    backgroundColor: '#666666',
  },
  githubIcon: {
    marginRight: 10,
  },
  githubButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
