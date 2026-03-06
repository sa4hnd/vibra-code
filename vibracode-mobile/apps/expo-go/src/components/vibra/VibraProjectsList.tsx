import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { UserCircle, LogIn, Search, FolderOpen, Trash2 } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

import { TextShimmer } from './TextShimmer';
import { VibraAuthModal } from './VibraAuthModal';
import { VibraProjectCard } from './VibraProjectCard';
import { VibraSortModal } from './VibraSortModal';
import { api } from '../../../convex/_generated/api';
import {
  VibraColors,
  VibraSpacing,
  VibraBorderRadius,
  VibraTypography,
  TABLET_BREAKPOINT,
  VibraResponsive,
} from '../../constants/VibraColors';
import { useVibraAuth } from '../../contexts/VibraAuthContext';
import { useVibraRestartDevServer } from '../../hooks/useVibraRestartDevServer';
import { useVibraResumeSession } from '../../hooks/useVibraResumeSession';
import { safeOpenProject } from '../../utils/SafeProjectOpener';

// Session type is inferred from Convex query

// Pulsing dot component for loading animation
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
      <View style={styles.pulsingDotInner} />
    </Animated.View>
  );
};

interface VibraProjectsListProps {
  searchQuery?: string;
  sortBy?: 'newest' | 'oldest' | 'name' | 'status';
  onSearchChange?: (text: string) => void;
  onSortPress?: () => void;
  getSortDisplayText?: () => string;
}

export const VibraProjectsList: React.FC<VibraProjectsListProps> = ({
  searchQuery = '',
  sortBy = 'newest',
  onSearchChange,
  onSortPress,
  getSortDisplayText,
}) => {
  // Responsive layout
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const maxContentWidth = isTablet ? VibraResponsive.maxContentWidth : width;

  // Removed local convertToExpoUrl - now using safeOpenProject from SafeProjectOpener
  const { isAuthenticated, isLoading } = useVibraAuth();
  const { user } = useUser();
  const { resumeSession, isResuming, error: resumeError } = useVibraResumeSession();
  const { restartServer, isRestarting, error: restartError } = useVibraRestartDevServer();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [refreshing, setRefreshing] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
  const [restartingProjectId, setRestartingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  // Fetch sessions from Convex database
  // Skip query if user.id is not available yet (returns undefined, which triggers loading state)
  const sessions = useQuery(api.sessions.list, user?.id ? { createdBy: user.id } : 'skip');

  // Delete session mutation
  const deleteSession = useMutation(api.sessions.remove);

  // Track swipeable refs to close them when needed
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  // Render right swipe actions (delete button)
  const renderRightActions = (
    session: { id: string; _id: any; name: string },
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    const opacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    return (
      <Animated.View
        style={[
          styles.swipeDeleteContainer,
          {
            opacity,
            transform: [{ translateX: trans }],
          },
        ]}>
        <TouchableOpacity
          style={styles.swipeDeleteButton}
          onPress={() => {
            // Close the swipeable first
            swipeableRefs.current[session.id]?.close();

            // Then show confirmation
            Alert.alert(
              'Delete Project',
              `Are you sure you want to delete "${session.name}"? This action cannot be undone.`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingProjectId(session.id);
                    console.log('🗑️ Deleting project (swipe):', session.name);

                    try {
                      await deleteSession({ id: session._id });
                      console.log('✅ Project deleted successfully');
                    } catch (error) {
                      console.error('❌ Failed to delete project:', error);
                      Alert.alert('Error', 'Failed to delete project. Please try again.');
                    } finally {
                      setDeletingProjectId(null);
                    }
                  },
                },
              ]
            );
          }}
          activeOpacity={0.8}>
          <Trash2 size={22} color="#FFFFFF" />
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Shimmer animation for skeleton loading
  useEffect(() => {
    const shimmer = () => {
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]).start(() => shimmer());
    };

    if (isLoading || sessions === undefined) {
      shimmer();
    }
  }, [isLoading, sessions, shimmerAnimation]);

  // Debug logging (only in dev mode)
  if (__DEV__) {
    console.log('🔍 VibraProjectsList Debug:', {
      isAuthenticated,
      isLoading,
      userId: user?.id,
      userLoaded: !!user,
      sessionsState: sessions === undefined ? 'undefined (loading/skipped)' : sessions === null ? 'null' : `loaded (${sessions.length})`,
      sessionsCount: sessions?.length || 0,
    });
  }

  const onRefresh = () => {
    setRefreshing(true);
    // The useQuery will automatically refetch when refreshing changes
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Filter and sort sessions
  const filteredAndSortedSessions = React.useMemo(() => {
    if (!sessions) return [];

    // First filter by search query
    const filtered = sessions.filter((session) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return (
        session.name?.toLowerCase().includes(query) ||
        session.repository?.toLowerCase().includes(query) ||
        session.statusMessage?.toLowerCase().includes(query)
      );
    });

    // Then sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b._creationTime || 0) - (a._creationTime || 0);
        case 'oldest':
          return (a._creationTime || 0) - (b._creationTime || 0);
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'status':
          // Order: RUNNING > IN_PROGRESS > others
          const statusOrder = { RUNNING: 0, IN_PROGRESS: 1, CUSTOM: 2 };
          const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
          const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
          return aOrder - bOrder;
        default:
          return 0;
      }
    });

    return filtered;
  }, [sessions, searchQuery, sortBy]);

  const handleSortPress = () => {
    setShowSortModal(true);
  };

  const handleSortSelect = (newSortBy: typeof sortBy) => {
    // This will be handled by the parent component
    setShowSortModal(false);
  };

  // Check authentication FIRST - if not authenticated, show sign in prompt
  // (Don't show loading skeleton when query is simply skipped due to no user)
  if (!isAuthenticated) {
    return (
      <>
        <View style={styles.signInContainer}>
          <View style={[styles.signInPrompt, isTablet && { maxWidth: maxContentWidth * 0.85 }]}>
            <View style={styles.signInIcon}>
              <UserCircle size={isTablet ? 64 : 80} color={VibraColors.neutral.textTertiary} />
            </View>
            <Text style={[styles.signInTitle, isTablet && { fontSize: 20 }]}>
              Sign in to your account
            </Text>
            <Text style={[styles.signInSubtitle, isTablet && { fontSize: 14 }]}>
              Access your projects and build amazing apps with AI
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => {
                setAuthMode('signin');
                setShowAuthModal(true);
              }}
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

        <VibraAuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  // Show loading only when authenticated but sessions still loading
  if (isLoading || sessions === undefined) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.scrollContent,
            isTablet && { alignSelf: 'center', width: maxContentWidth },
          ]}>
          {/* Skeleton loading cards */}
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={styles.skeletonCard}>
              <View style={styles.skeletonHeader}>
                <View style={styles.skeletonIcon} />
                <View style={styles.skeletonHeaderContent}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonSubtitle} />
                </View>
                <View style={styles.skeletonStatus} />
              </View>
              <View style={styles.skeletonFooter}>
                <View style={styles.skeletonFooterLine} />
                <View style={[styles.skeletonFooterLine, styles.skeletonFooterLineShort]} />
              </View>
            </View>
          ))}
        </View>

        {/* Loading indicator overlay */}
        <View style={styles.loadingOverlay}>
          <TextShimmer style={styles.loadingText} duration={1500}>
            Loading Projects
          </TextShimmer>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && { alignSelf: 'center', width: maxContentWidth },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {filteredAndSortedSessions && filteredAndSortedSessions.length > 0 ? (
            filteredAndSortedSessions.map((session) => (
              <Swipeable
                key={session.id}
                ref={(ref) => {
                  swipeableRefs.current[session.id] = ref;
                }}
                renderRightActions={(progress, dragX) =>
                  renderRightActions(session, progress, dragX)
                }
                overshootRight={false}
                friction={2}
                rightThreshold={40}>
                <VibraProjectCard
                project={{
                  id: session.id,
                  name: session.name,
                  icon: session.name.charAt(0).toUpperCase(),
                  lastModified: new Date(session._creationTime).toLocaleDateString(),
                  expoUrl: session.tunnelUrl || 'exp://localhost:8081',
                  status: session.status,
                  statusMessage: session.statusMessage,
                  repository: session.repository,
                }}
                isLoading={openingProjectId === session.id}
                isRestarting={restartingProjectId === session.id}
                isDeleting={deletingProjectId === session.id}
                onDelete={async () => {
                  if (deletingProjectId === session.id) {
                    console.log('⏳ Already deleting this project, skipping...');
                    return;
                  }

                  // Show confirmation dialog
                  Alert.alert(
                    'Delete Project',
                    `Are you sure you want to delete "${session.name}"? This action cannot be undone.`,
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                      },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          setDeletingProjectId(session.id);
                          console.log('🗑️ Deleting project:', session.name);

                          try {
                            await deleteSession({ id: session._id });
                            console.log('✅ Project deleted successfully');
                            // No need to show success alert - the project will disappear from the list
                          } catch (error) {
                            console.error('❌ Failed to delete project:', error);
                            Alert.alert('Error', 'Failed to delete project. Please try again.');
                          } finally {
                            setDeletingProjectId(null);
                          }
                        },
                      },
                    ]
                  );
                }}
                onRestartServer={async () => {
                  const sessionIdToUse = session.sessionId || session.id;
                  if (restartingProjectId === session.id) {
                    console.log('⏳ Already restarting this project, skipping...');
                    return;
                  }

                  setRestartingProjectId(session.id);
                  console.log('🔄 Restarting dev server for session:', sessionIdToUse);

                  try {
                    const result = await restartServer(sessionIdToUse);

                    if (result.success) {
                      console.log('✅ Dev server restarted successfully');
                      Alert.alert('Success', 'Dev server restarted successfully!');
                    } else {
                      console.error('❌ Failed to restart dev server:', result.error);
                      Alert.alert('Error', result.error || 'Failed to restart dev server');
                    }
                  } catch (error) {
                    console.error('❌ Failed to restart dev server:', error);
                    Alert.alert('Error', 'Failed to restart dev server');
                  } finally {
                    setRestartingProjectId(null);
                  }
                }}
                onPress={async () => {
                  if (session.tunnelUrl && openingProjectId !== session.id) {
                    setOpeningProjectId(session.id);
                    console.log('🔄 Starting project opening process:', session.tunnelUrl);

                    try {
                      // Call resume API before opening project (same as v0-clone behavior)
                      // SECURITY: Pass clerkId for ownership verification
                      console.log('🔄 Resuming session before opening project:', session.sessionId);
                      const resumeResult = await resumeSession(session.sessionId || session.id, user?.id);

                      if (resumeResult.success) {
                        console.log('✅ Session resumed successfully, now opening project');
                      } else {
                        console.warn(
                          '⚠️ Session resume failed, but continuing with project opening:',
                          resumeResult.error
                        );
                      }

                      // Then open the project
                      console.log('📱 Opening project URL:', session.tunnelUrl);
                      await safeOpenProject(session.tunnelUrl, session.id);
                      console.log('✅ Project opened successfully');
                    } catch (error) {
                      console.error('❌ Failed to open project:', error);
                    } finally {
                      // Reset the opening state after a delay
                      setTimeout(() => setOpeningProjectId(null), 2000);
                    }
                  } else if (openingProjectId === session.id) {
                    console.log('⏳ Project opening already in progress, skipping...');
                  }
                }}
              />
              </Swipeable>
            ))
          ) : (
            <View style={styles.emptyState}>
              {searchQuery.trim() ? (
                <>
                  <Search size={48} color="#666666" />
                  <Text style={styles.emptyStateTitle}>No matching projects</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Try adjusting your search or create a new project
                  </Text>
                </>
              ) : (
                <>
                  <FolderOpen size={48} color="#666666" />
                  <Text style={styles.emptyStateTitle}>No projects yet</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Create your first project to get started
                  </Text>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Sort Modal */}
      <VibraSortModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        currentSort={sortBy}
        onSortSelect={handleSortSelect}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Remove background to let parent gradient show through
    backgroundColor: 'transparent',
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: VibraSpacing['2xl'],
    paddingTop: VibraSpacing.lg,
    paddingBottom: VibraSpacing['6xl'], // More bottom padding
  },
  sectionTitle: {
    color: VibraColors.neutral.text,
    fontSize: 24,
    fontWeight: '700' as any,
    marginBottom: VibraSpacing.xl,
    marginTop: VibraSpacing.sm,
    letterSpacing: -0.5,
    lineHeight: 28,
    textAlign: 'left',
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  signInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing['2xl'],
  },
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
  versionSection: {
    alignItems: 'center',
    paddingTop: VibraSpacing.xl,
    paddingBottom: VibraSpacing.lg,
  },
  versionText: {
    fontSize: 13,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    backgroundColor: VibraColors.surface.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: VibraColors.neutral.text,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: VibraColors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },

  // Skeleton loading styles
  skeletonCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
    padding: 20,
    opacity: 0.6,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 16,
  },
  skeletonHeaderContent: {
    flex: 1,
  },
  skeletonTitle: {
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    marginBottom: 8,
    width: '70%',
  },
  skeletonSubtitle: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    width: '50%',
  },
  skeletonStatus: {
    width: 80,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  skeletonFooter: {
    gap: 8,
  },
  skeletonFooterLine: {
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 7,
  },
  skeletonFooterLineShort: {
    width: '60%',
  },

  // Loading overlay styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 210,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pulsingDotInner: {
    width: '100%',
    height: '100%',
    backgroundColor: VibraColors.accent.amber,
    borderRadius: 6,
  },
  // Swipe to delete styles
  swipeDeleteContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  swipeDeleteButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 12,
    flexDirection: 'column',
    gap: 4,
  },
  swipeDeleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as any,
  },
});

export default VibraProjectsList;
