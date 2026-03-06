import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Database, X, AlertCircle, Link } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';

import { ConvexDashboard } from './ConvexDashboard';
import { VibraCosmicBackground } from './VibraCosmicBackground';
import { ENV } from '../../config/env';
import { VibraColors, VibraSpacing } from '../../constants/VibraColors';

interface ConvexProject {
  deploymentName: string;
  deploymentUrl: string;
  adminKey: string;
  token?: string;
}

interface ConvexDashboardModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId?: string;
}

export const ConvexDashboardModal: React.FC<ConvexDashboardModalProps> = ({
  visible,
  onClose,
  sessionId,
}) => {
  const [convexProject, setConvexProject] = useState<ConvexProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingProject, setIsCheckingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if there's already a project in the session when modal opens
  useEffect(() => {
    if (visible && sessionId) {
      // Immediately check for existing project to avoid showing connection page
      checkForExistingProject();
    }
  }, [visible, sessionId]);

  // Also check when convexProject changes to ensure we show the right state
  useEffect(() => {
    if (visible && convexProject) {
      console.log('🎉 Convex project loaded, showing dashboard');
    }
  }, [visible, convexProject]);

  const checkForExistingProject = async () => {
    try {
      setIsCheckingProject(true);
      console.log('🔍 Checking for existing Convex project...');
      const sessionResponse = await fetch(
        `${(ENV.V0_API_URL || '').replace(/\/$/, '')}/api/session/${sessionId}`
      );
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        console.log('📊 Existing session data:', sessionData);
        if (sessionData.convexProject) {
          console.log('🎉 Found existing Convex project!');
          setConvexProject(sessionData.convexProject);
        }
      }
    } catch (error) {
      console.log('⚠️ Could not check for existing project:', error);
    } finally {
      setIsCheckingProject(false);
    }
  };

  const handleConnectConvex = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use the OAuth API endpoint to get the correct URL
      const response = await fetch(
        `${(ENV.V0_API_URL || '').replace(/\/$/, '')}/api/convex/oauth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            redirectUri: `${(ENV.V0_API_URL || '').replace(/\/$/, '').replace(/\/$/, '')}/convex/callback`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get OAuth URL');
      }

      const { authUrl } = await response.json();
      console.log('🔗 OAuth URL from API:', authUrl);

      // Open the OAuth URL
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'exp://localhost:8081', {
        showInRecents: true,
        preferEphemeralSession: false,
      });

      console.log('📱 OAuth result:', result.type);

      if (result.type === 'success') {
        console.log('✅ OAuth completed - checking for project...');

        // Wait for web callback to finish
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check if project was created in session
        console.log('🔍 Checking session for project...');
        const sessionResponse = await fetch(
          `${(ENV.V0_API_URL || '').replace(/\/$/, '')}/api/session/${sessionId}`
        );
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          console.log('📊 Session data:', sessionData);
          if (sessionData.convexProject) {
            console.log('🎉 Found Convex project in session!');
            setConvexProject(sessionData.convexProject);
            return;
          }
        }

        // If no project found, show success message but don't treat it as an error
        console.log('⚠️ No project found in session, but OAuth completed successfully');
        // Don't set an error - just show a success state
        setConvexProject({
          deploymentName: 'Processing...',
          deploymentUrl: 'https://convex.dev',
          adminKey: 'processing',
        });
      } else if (result.type === 'cancel') {
        console.log('❌ User cancelled OAuth - but checking if project was created...');

        // Even if user cancelled, check if the project was created
        // (this handles the case where user closes the web view manually after OAuth completes)
        try {
          const sessionResponse = await fetch(
            `${(ENV.V0_API_URL || '').replace(/\/$/, '')}/api/session/${sessionId}`
          );
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            console.log('📊 Session data after cancel:', sessionData);
            if (sessionData.convexProject) {
              console.log('🎉 Found Convex project after cancel!');
              setConvexProject(sessionData.convexProject);
              return;
            }
          }
        } catch (error) {
          console.log('⚠️ Could not check session after cancel:', error);
        }

        setError('OAuth was cancelled. Please try again.');
      } else {
        console.log('❌ OAuth failed:', result.type);
        setError('OAuth failed. Please try again.');
      }
    } catch (err) {
      console.error('❌ Error:', err);
      setError('Failed to connect to Convex. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInBrowser = () => {
    if (convexProject) {
      const url = `https://dashboard.convex.dev/d/${convexProject.deploymentName}/data`;
      Linking.openURL(url);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <VibraCosmicBackground>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.projectInfo}>
                <View style={styles.projectIcon}>
                  <Database size={20} color="#FFFFFF" />
                </View>
                <View style={styles.projectDetails}>
                  <Text style={styles.projectName}>Convex Database</Text>
                  <Text style={styles.projectStatus}>
                    {convexProject ? 'Connected' : 'Not Connected'}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
                  <X size={20} color={VibraColors.neutral.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {isCheckingProject ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Loading Database...</Text>
              </View>
            ) : convexProject ? (
              <ConvexDashboard
                deploymentName={convexProject.deploymentName}
                deploymentUrl={convexProject.deploymentUrl}
                adminKey={convexProject.adminKey}
                onOpenInBrowser={handleOpenInBrowser}
              />
            ) : (
              <View style={styles.connectContainer}>
                <View style={styles.iconContainer}>
                  <Database size={64} color="#FFFFFF" />
                </View>

                <Text style={styles.connectTitle}>Connect to Convex</Text>
                <Text style={styles.connectDescription}>
                  Connect your Convex database to view and manage your data in real-time.
                </Text>

                {error && (
                  <View style={styles.errorContainer}>
                    <AlertCircle size={20} color="#FF6B6B" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleConnectConvex}
                    disabled={isLoading}
                    activeOpacity={0.8}>
                    <LinearGradient
                      colors={
                        isLoading
                          ? ['#666666', '#555555']
                          : [VibraColors.neutral.text, VibraColors.neutral.textSecondary]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}>
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#000000" />
                      ) : (
                        <Link size={20} color="#000000" />
                      )}
                      <Text style={styles.buttonText}>
                        {isLoading ? 'Connecting...' : 'Connect Database'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </VibraCosmicBackground>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header Section - matches VibraHeader.tsx
  header: {
    backgroundColor: 'transparent',
    paddingTop: VibraSpacing.xl,
    paddingBottom: VibraSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
    height: 64,
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.md,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  projectDetails: {
    flex: 1,
  },
  projectName: {
    color: VibraColors.neutral.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  projectStatus: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VibraSpacing.sm,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.button,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },

  content: {
    flex: 1,
    paddingHorizontal: VibraSpacing['2xl'],
    paddingTop: VibraSpacing.lg,
    paddingBottom: VibraSpacing['6xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: VibraSpacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: VibraSpacing.xl,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  connectTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: VibraSpacing.sm,
    textAlign: 'center',
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  connectDescription: {
    color: '#CCCCCC',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: VibraSpacing.xl,
    fontWeight: '400',
    opacity: 0.9,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    paddingHorizontal: VibraSpacing.md,
    paddingVertical: VibraSpacing.sm,
    borderRadius: 16,
    marginBottom: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginLeft: VibraSpacing.sm,
    flex: 1,
    fontWeight: '400',
  },
  buttonContainer: {
    width: '100%',
    gap: VibraSpacing.md,
  },
  button: {
    borderRadius: 16,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    gap: VibraSpacing.sm,
  },
  buttonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
