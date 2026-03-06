import { useAuth, useSignIn } from '@clerk/clerk-expo';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';

import { Ionicons } from '../Icons';

export const VibraSignInScreen: React.FC = () => {
  const { isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);
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

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo and Title */}
        <View style={styles.logoSection}>
          <View style={styles.orangeSquare} />
          <Text style={styles.title}>Vibra Code</Text>
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

        {/* Additional Info */}
        <Text style={styles.infoText}>Don't have an account? Sign up at vibracode.com</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  orangeSquare: {
    width: 48,
    height: 48,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    marginRight: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#999999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    minWidth: 200,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoText: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
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
  signInButtonDisabled: {
    backgroundColor: '#666666',
  },
});

export default VibraSignInScreen;
