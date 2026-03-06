import { CommonActions } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Hourglass,
  GitBranch,
  Download,
  Play,
  Globe,
  CheckCircle,
  Settings,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  Linking,
} from 'react-native';

import { api } from '../../convex/_generated/api';
import { TextShimmer } from '../components/vibra/TextShimmer';
import { VibraCosmicBackground } from '../components/vibra/VibraCosmicBackground';
import { VibraColors, VibraSpacing } from '../constants/VibraColors';
import { useVibraAuth } from '../contexts/VibraAuthContext';
import { safeOpenProject } from '../utils/SafeProjectOpener';

interface VibraAppLoadingScreenProps {
  route: {
    params: {
      sessionId: string;
      prompt: string;
    };
  };
  navigation: any;
}

// Removed local functions - now using safeOpenProject from SafeProjectOpener

// Pulsing dot component for in-progress todos
const PulsingDot: React.FC<{ style: any }> = ({ style }) => {
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  }, [pulseAnimation]);

  return (
    <Animated.View style={[style, { transform: [{ scale: pulseAnimation }] }]}>
      <TextShimmer style={styles.stepDotShimmer} duration={1500}>
        {' '}
      </TextShimmer>
    </Animated.View>
  );
};

export const VibraAppLoadingScreen: React.FC<VibraAppLoadingScreenProps> = ({
  route,
  navigation,
}) => {
  const { sessionId, prompt } = route.params;
  const { user } = useVibraAuth();
  // SECURITY: Pass createdBy for ownership verification
  const session = useQuery(api.sessions.getById, user?.id ? { id: sessionId as any, createdBy: user.id } : 'skip');
  const [hasOpenedProject, setHasOpenedProject] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Debug logging
  useEffect(() => {
    console.log('📱 App Loading Debug:', {
      sessionId,
      sessionStatus: session?.status,
      tunnelUrl: session?.tunnelUrl,
      user: user?.id,
    });
  }, [session, sessionId, user]);

  // Auto-open project when status becomes RUNNING
  useEffect(() => {
    if (
      session?.status === 'RUNNING' &&
      session?.tunnelUrl &&
      !hasOpenedProject &&
      !isOpeningProject
    ) {
      setHasOpenedProject(true);
      setIsOpeningProject(true);

      const openProject = async () => {
        try {
          console.log('🚀 Opening project safely:', session.tunnelUrl);
          await safeOpenProject(session.tunnelUrl!, sessionId);

          // Navigate to home screen after opening (not back to loading screen)
          setTimeout(() => {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              })
            );
          }, 2000);
        } catch (error) {
          console.error('Error opening project:', error);
          Alert.alert('Error', 'Could not open project in Expo Go');
        } finally {
          setIsOpeningProject(false);
        }
      };

      openProject();
    }
  }, [
    session?.status,
    session?.tunnelUrl,
    hasOpenedProject,
    isOpeningProject,
    navigation,
    sessionId,
  ]);

  // Pulsing animation for status dot
  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };

    if (session && session.status !== 'RUNNING') {
      pulse();
    }
  }, [session?.status, pulseAnimation]);

  const getStatusText = () => {
    if (!session) return 'Initializing...';

    switch (session.status) {
      case 'IN_PROGRESS':
        return 'Initializing...';
      case 'CLONING_REPO':
        return 'Cloning repository...';
      case 'INSTALLING_DEPENDENCIES':
        return 'Installing dependencies...';
      case 'STARTING_DEV_SERVER':
        return 'Starting development server...';
      case 'CREATING_TUNNEL':
        return 'Creating tunnel...';
      case 'RUNNING':
        return 'Opening your app...';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    if (!session) return <Hourglass size={24} color={getStatusColor()} />;

    switch (session.status) {
      case 'IN_PROGRESS':
        return <Hourglass size={24} color={getStatusColor()} />;
      case 'CLONING_REPO':
        return <GitBranch size={24} color={getStatusColor()} />;
      case 'INSTALLING_DEPENDENCIES':
        return <Download size={24} color={getStatusColor()} />;
      case 'STARTING_DEV_SERVER':
        return <Play size={24} color={getStatusColor()} />;
      case 'CREATING_TUNNEL':
        return <Globe size={24} color={getStatusColor()} />;
      case 'RUNNING':
        return <CheckCircle size={24} color={getStatusColor()} />;
      default:
        return <Settings size={24} color={getStatusColor()} />;
    }
  };

  const getStatusColor = () => {
    if (!session) return VibraColors.neutral.textSecondary;

    switch (session.status) {
      case 'RUNNING':
        return VibraColors.accent.emerald;
      default:
        return VibraColors.neutral.textSecondary;
    }
  };

  const handleBack = () => {
    // Go back to VibraCreateAppScreen
    navigation.goBack();
  };

  const handleOpenProject = async () => {
    if (!session?.tunnelUrl) {
      Alert.alert('Error', 'No tunnel URL available yet');
      return;
    }

    if (isOpeningProject) {
      console.log('⏳ Project opening already in progress, skipping...');
      return;
    }

    setIsOpeningProject(true);
    try {
      console.log('🚀 Opening project manually:', session.tunnelUrl);
      await safeOpenProject(session.tunnelUrl, sessionId);

      // Navigate to home screen after opening (not back to loading screen)
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }, 2000);
    } catch (error) {
      console.error('Error opening project:', error);
      Alert.alert('Error', 'Could not open project in Expo Go');
    } finally {
      setIsOpeningProject(false);
    }
  };

  return (
    <VibraCosmicBackground>
      {/* Main content */}
      <View style={styles.contentWrapper}>
        {/* Header Container */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ChevronLeft size={20} color={VibraColors.neutral.textTertiary} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>Building Your App</Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {prompt}
              </Text>
            </View>
          </View>
        </View>

        {/* Loading Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Status Card - VibraChatMessage Style */}
          <View style={styles.statusCard}>
            <View style={styles.statusIconContainer}>{getStatusIcon()}</View>

            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>{getStatusText()}</Text>
              {session?.statusMessage && (
                <Text style={styles.statusSubtitle}>{session.statusMessage}</Text>
              )}
            </View>

            {/* Animated Status Dot */}
            {session && session.status !== 'RUNNING' && (
              <View style={styles.statusDotContainer}>
                <Animated.View
                  style={[styles.statusDot, { transform: [{ scale: pulseAnimation }] }]}
                />
                <TextShimmer style={styles.statusDotText} duration={1500}>
                  Working...
                </TextShimmer>
              </View>
            )}
          </View>

          {/* Progress Steps - VibraChatMessage Todo Style */}
          <View style={styles.progressSteps}>
            <View style={styles.progressHeader}>
              <CheckCircle size={16} color={VibraColors.neutral.textSecondary} />
              <Text style={styles.progressTitle}>Progress</Text>
              <View style={styles.progressStats}>
                <Text style={styles.progressStatsText}>
                  {(() => {
                    const completedSteps =
                      session?.status === 'RUNNING'
                        ? 6
                        : (session &&
                            [
                              'IN_PROGRESS',
                              'CLONING_REPO',
                              'INSTALLING_DEPENDENCIES',
                              'STARTING_DEV_SERVER',
                              'CREATING_TUNNEL',
                            ].indexOf(session.status) + 1) ||
                          0;
                    return `${completedSteps}/6`;
                  })()}
                </Text>
              </View>
            </View>

            <View style={styles.progressItems}>
              {[
                { key: 'IN_PROGRESS', label: 'Initialize', icon: 'hourglass-outline' },
                { key: 'CLONING_REPO', label: 'Clone Repository', icon: 'git-branch-outline' },
                {
                  key: 'INSTALLING_DEPENDENCIES',
                  label: 'Install Dependencies',
                  icon: 'download-outline',
                },
                { key: 'STARTING_DEV_SERVER', label: 'Start Server', icon: 'play-outline' },
                { key: 'CREATING_TUNNEL', label: 'Create Tunnel', icon: 'globe-outline' },
                { key: 'RUNNING', label: 'Ready!', icon: 'checkmark-circle' },
              ].map((step, index) => {
                const isActive = session?.status === step.key;
                const isCompleted =
                  session?.status === 'RUNNING' ||
                  (session &&
                    [
                      'IN_PROGRESS',
                      'CLONING_REPO',
                      'INSTALLING_DEPENDENCIES',
                      'STARTING_DEV_SERVER',
                      'CREATING_TUNNEL',
                    ].indexOf(session.status) > index);

                return (
                  <View
                    key={step.key}
                    style={[styles.progressStep, isCompleted && styles.progressStepCompleted]}>
                    {isActive ? (
                      <PulsingDot style={[styles.stepDot, styles.stepDotInProgress]} />
                    ) : (
                      <View style={[styles.stepDot, isCompleted && styles.stepDotCompleted]} />
                    )}
                    <Text
                      style={[
                        styles.stepLabel,
                        isCompleted && styles.stepLabelCompleted,
                        isActive && styles.stepLabelActive,
                      ]}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Action Button - VibraCreateAppScreen Style */}
          {session?.status === 'RUNNING' && session?.tunnelUrl && (
            <TouchableOpacity style={styles.openButton} onPress={handleOpenProject}>
              <LinearGradient
                colors={[VibraColors.neutral.text, VibraColors.neutral.textSecondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.openButtonGradient}>
                <ExternalLink size={20} color="#000000" />
                <Text style={styles.openButtonText}>Open in Expo Go</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </VibraCosmicBackground>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: VibraSpacing.xl,
    paddingBottom: VibraSpacing.md,
    minHeight: 64,
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
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.9,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: VibraSpacing['2xl'],
    paddingTop: VibraSpacing.lg,
    paddingBottom: VibraSpacing['6xl'],
    flexGrow: 1,
  },
  statusCard: {
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 12,
    padding: VibraSpacing.lg,
    marginBottom: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  statusIconContainer: {
    alignItems: 'center',
    marginBottom: VibraSpacing.md,
  },
  statusTextContainer: {
    alignItems: 'center',
    marginBottom: VibraSpacing.md,
  },
  statusTitle: {
    color: VibraColors.neutral.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: VibraSpacing.xs,
    letterSpacing: -0.2,
  },
  statusSubtitle: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '400',
    opacity: 0.9,
    lineHeight: 20,
  },
  statusDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: VibraSpacing.sm,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: VibraColors.neutral.textSecondary,
    shadowColor: VibraColors.neutral.textSecondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  statusDotText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  progressSteps: {
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 12,
    padding: VibraSpacing.lg,
    marginBottom: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VibraSpacing.md,
    paddingBottom: VibraSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
  },
  progressTitle: {
    color: VibraColors.neutral.text,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: VibraSpacing.md,
    flex: 1,
    letterSpacing: -0.2,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressStatsText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  progressItems: {
    gap: VibraSpacing.md,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VibraSpacing.sm,
    paddingHorizontal: VibraSpacing.xs,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  progressStepCompleted: {
    opacity: 0.7,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: VibraSpacing.md,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepDotCompleted: {
    backgroundColor: VibraColors.neutral.textSecondary,
    borderColor: VibraColors.neutral.textSecondary,
  },
  stepDotInProgress: {
    backgroundColor: VibraColors.accent.amber,
    borderColor: VibraColors.accent.amber,
    borderWidth: 0,
  },
  stepDotShimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: VibraColors.accent.amber,
    borderRadius: 6,
  },
  stepLabel: {
    color: VibraColors.neutral.text,
    fontSize: 14,
    flex: 1,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  stepLabelCompleted: {
    textDecorationLine: 'line-through',
    color: VibraColors.neutral.textSecondary,
    opacity: 0.7,
  },
  stepLabelActive: {
    color: VibraColors.accent.amber,
  },
  openButton: {
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
  openButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    gap: VibraSpacing.sm,
  },
  openButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
