import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';

import { api } from '../../convex/_generated/api';
import { TextShimmer } from '../components/vibra/TextShimmer';
import { VibraActionButtons } from '../components/vibra/VibraActionButtons';
import { VibraChatMessage } from '../components/vibra/VibraChatMessage';
import { VibraCosmicBackground } from '../components/vibra/VibraCosmicBackground';
import { VibraColors, VibraSpacing, VibraBorderRadius } from '../constants/VibraColors';
import { useVibraAuth } from '../contexts/VibraAuthContext';
import { safeOpenProject } from '../utils/SafeProjectOpener';

interface VibraChatScreenProps {
  route: {
    params: {
      sessionId: string;
    };
  };
  navigation: any;
}

export const VibraChatScreen: React.FC<VibraChatScreenProps> = ({ route, navigation }) => {
  const { sessionId } = route.params;
  const { user } = useVibraAuth();
  // SECURITY: Pass createdBy for ownership verification
  const session = useQuery(api.sessions.getById, user?.id ? { id: sessionId as any, createdBy: user.id } : 'skip');
  const messages = useQuery(api.messages.getBySession, { sessionId: sessionId as any });
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Hide tab bar when this screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Hide tab bar
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' },
      });

      // Cleanup: show tab bar when leaving
      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: { display: 'flex' },
        });
      };
    }, [navigation])
  );

  const proTips = [
    'You can leave the app, you will get notifications',
    'Swipe to navigate between different screens easily',
    'Tap and hold messages to copy them quickly',
    'Your projects auto-save as you build them',
    'Pull down to refresh and see latest updates',
    'Share your app with friends using the tunnel URL',
  ];

  // Rotate tips every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % proTips.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [proTips.length]);

  // Debug logging
  useEffect(() => {
    console.log('📱 Chat Screen Debug:', {
      sessionId,
      sessionStatus: session?.status,
      messagesCount: messages?.length || 0,
      user: user?.id,
    });
  }, [session, messages, sessionId, user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current && messages) {
      // Delay scroll to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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

  const handleBack = () => {
    navigation.navigate('HomeScreen');
  };

  const handleOpenProject = async () => {
    if (!session?.tunnelUrl) {
      Alert.alert('Error', 'No tunnel URL available');
      return;
    }

    try {
      console.log('🚀 Opening project from chat:', session.tunnelUrl);
      await safeOpenProject(session.tunnelUrl, sessionId);
    } catch (error) {
      console.error('Error opening project:', error);
      Alert.alert('Error', 'Could not open project in Expo Go');
    }
  };

  return (
    <VibraCosmicBackground>
      {/* Main content */}
      <View style={styles.contentWrapper}>
        {/* Header Container - matches other screens exactly */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ChevronLeft size={20} color={VibraColors.neutral.textTertiary} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>Building Your App</Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {proTips[currentTipIndex]}
              </Text>
            </View>
          </View>
        </View>

        {/* Chat Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.messagesContainer}>
            {/* Welcome message if no messages */}
            {(!messages || messages.length === 0) && (
              <VibraChatMessage
                message={{
                  _id: 'welcome',
                  role: 'assistant',
                  content:
                    "Hello! I'm VibraCoder. I'm building your app experience - this might take a few moments.",
                }}
              />
            )}

            {/* Render messages */}
            {messages &&
              messages.map((message, index) => {
                return <VibraChatMessage key={message._id || index} message={message} />;
              })}

            {/* Status indicator with shimmer effect - v0 style */}
            {session && (session.status === 'CUSTOM' || session.status !== 'RUNNING') && (
              <View style={styles.statusContainer}>
                <Animated.View
                  style={[styles.statusDot, { transform: [{ scale: pulseAnimation }] }]}
                />
                <TextShimmer style={styles.statusText} duration={1500}>
                  {(() => {
                    let statusText = '';
                    if (session.status === 'CUSTOM') {
                      statusText = session.statusMessage || 'Working';
                    } else if (session.status === 'IN_PROGRESS') {
                      statusText = 'Initializing';
                    } else if (session.status === 'CLONING_REPO') {
                      statusText = 'Cloning repository';
                    } else if (session.status === 'INSTALLING_DEPENDENCIES') {
                      statusText = 'Installing dependencies';
                    } else if (session.status === 'STARTING_DEV_SERVER') {
                      statusText = 'Starting development server';
                    } else if (session.status === 'CREATING_TUNNEL') {
                      statusText = 'Creating tunnel';
                    } else {
                      statusText = session.statusMessage || 'Processing';
                    }

                    // Always truncate to 45 characters and add "..." like v0
                    return statusText.length > 45 ? `${statusText.slice(0, 45)}...` : statusText;
                  })()}
                </TextShimmer>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer with consistent styling */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            VibraCoder never makes mistakes. Like the other ones do.
          </Text>
        </View>
      </View>
    </VibraCosmicBackground>
  );
};

const styles = StyleSheet.create({
  // Content wrapper - matches home page
  contentWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  // Header Container - matches home page exactly
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
    numberOfLines: 2,
    lineHeight: 20,
    letterSpacing: -0.2,
  },

  // Full-width scroll area
  scrollArea: {
    flex: 1,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: VibraSpacing.xl,
    paddingTop: VibraSpacing.lg,
    paddingBottom: VibraSpacing['6xl'],
    flexGrow: 1,
  },
  messagesContainer: {
    flex: 1,
    gap: VibraSpacing.lg,
    paddingBottom: VibraSpacing.xl,
  },

  // Status indicator with consistent styling
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: VibraSpacing.xl,
    marginTop: VibraSpacing.sm,
    gap: VibraSpacing.sm,
    backgroundColor: 'transparent',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 8,
    backgroundColor: VibraColors.neutral.textSecondary,
    shadowColor: VibraColors.neutral.textSecondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  statusText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Footer with consistent styling
  footer: {
    paddingHorizontal: VibraSpacing.xl,
    paddingVertical: VibraSpacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: VibraColors.neutral.border,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  footerText: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.8,
    letterSpacing: 0.3,
  },
});
