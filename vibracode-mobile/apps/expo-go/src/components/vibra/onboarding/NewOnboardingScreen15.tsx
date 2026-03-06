import { useNavigation, CommonActions } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronDown, Check, Home } from 'lucide-react-native';
import React, { useEffect, useRef, useMemo, useState, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated as RNAnimated,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../../../convex/_generated/api';
import { useVibraAuth } from '../../../contexts/VibraAuthContext';
import { safeOpenProject } from '../../../utils/SafeProjectOpener';
import { ColorBendsBackground } from '../ColorBendsBackground';
import { TextShimmer } from '../TextShimmer';
import { NATIVE_ONBOARDING_ASSETS } from './OnboardingAssets';
import { OnboardingColors, OnboardingHaptics, OnboardingAnimations } from './OnboardingConstants';

// Static background configuration - defined outside component to prevent recreation
const BACKGROUND_COLORS = ['#FFA500', '#FFD700', '#90EE90', '#98FB98'];
const BACKGROUND_CONFIG = {
  rotation: -60,
  speed: 0.3,
  scale: 0.8,
  frequency: 1.2,
  warpStrength: 1.0,
  noise: 0.05,
};

// Memoized background - completely isolated from parent re-renders
const MemoizedBackground = memo(
  () => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ColorBendsBackground
        colors={BACKGROUND_COLORS}
        rotation={BACKGROUND_CONFIG.rotation}
        speed={BACKGROUND_CONFIG.speed}
        scale={BACKGROUND_CONFIG.scale}
        frequency={BACKGROUND_CONFIG.frequency}
        warpStrength={BACKGROUND_CONFIG.warpStrength}
        noise={BACKGROUND_CONFIG.noise}
      />
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  ),
  () => true
); // Always return true - never re-render

MemoizedBackground.displayName = 'MemoizedBackground';

// Simple markdown renderer for bold and code
const renderMarkdown = (text: string) => {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Check for inline code `code`
    const codeMatch = remaining.match(/`(.+?)`/);

    if (boldMatch && (!codeMatch || boldMatch.index! <= codeMatch.index!)) {
      if (boldMatch.index! > 0) {
        parts.push(<Text key={key++}>{remaining.slice(0, boldMatch.index)}</Text>);
      }
      parts.push(
        <Text key={key++} style={{ fontWeight: '700' }}>
          {boldMatch[1]}
        </Text>
      );
      remaining = remaining.slice(boldMatch.index! + boldMatch[0].length);
    } else if (codeMatch) {
      if (codeMatch.index! > 0) {
        parts.push(<Text key={key++}>{remaining.slice(0, codeMatch.index)}</Text>);
      }
      parts.push(
        <Text
          key={key++}
          style={{
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            backgroundColor: 'rgba(255,255,255,0.1)',
            paddingHorizontal: 4,
            borderRadius: 4,
          }}>
          {codeMatch[1]}
        </Text>
      );
      remaining = remaining.slice(codeMatch.index! + codeMatch[0].length);
    } else {
      parts.push(<Text key={key++}>{remaining}</Text>);
      break;
    }
  }

  return parts;
};

interface NewOnboardingScreen15Props {
  onComplete: () => void;
  onBack: () => void;
  sessionId?: string;
  prompt?: string;
  appName?: string;
}

// Type definitions for grouped items
type GroupedItem =
  | { type: 'read'; files: string[]; id: string }
  | { type: 'edit'; files: string[]; id: string }
  | { type: 'write'; files: string[]; id: string }
  | { type: 'bash'; commands: string[]; id: string }
  | { type: 'tool'; toolName: string; count: number; id: string }
  | {
      type: 'tasks';
      todos: { id: string; content: string; status: string; priority: string }[];
      id: string;
    }
  | { type: 'text'; content: string; id: string };

// Process messages into consecutive groups
function processMessagesIntoGroups(messages: any[]): GroupedItem[] {
  const groups: GroupedItem[] = [];

  for (const message of messages) {
    const lastGroup = groups[groups.length - 1];

    if (message.read) {
      if (lastGroup?.type === 'read') {
        lastGroup.files.push(message.read.filePath);
      } else {
        groups.push({ type: 'read', files: [message.read.filePath], id: message._id });
      }
      continue;
    }

    if (message.edits) {
      if (lastGroup?.type === 'edit') {
        lastGroup.files.push(message.edits.filePath);
      } else {
        groups.push({ type: 'edit', files: [message.edits.filePath], id: message._id });
      }
      continue;
    }

    if (message.bash) {
      if (lastGroup?.type === 'bash') {
        lastGroup.commands.push(message.bash.command);
      } else {
        groups.push({ type: 'bash', commands: [message.bash.command], id: message._id });
      }
      continue;
    }

    if (message.mcpTool || message.tool) {
      const toolName = message.mcpTool?.toolName || message.tool?.toolName || 'Tool';
      if (lastGroup?.type === 'tool' && lastGroup.toolName === toolName) {
        lastGroup.count += 1;
      } else {
        groups.push({ type: 'tool', toolName, count: 1, id: message._id });
      }
      continue;
    }

    if (message.todos) {
      groups.push({ type: 'tasks', todos: message.todos, id: message._id });
      continue;
    }

    if (message.content && message.role === 'assistant') {
      if (
        message.content.trim() &&
        !message.read &&
        !message.edits &&
        !message.bash &&
        !message.mcpTool &&
        !message.tool
      ) {
        groups.push({ type: 'text', content: message.content, id: message._id });
      }
      continue;
    }
  }

  return groups;
}

// Get filename from path
const getFileName = (path: string) => path.split('/').pop() || path;

// Command Log Row - Expandable with auto-open/close
interface CommandLogRowProps {
  label: string;
  items: string[];
  count: number;
  id: string;
  isLatest: boolean;
  groupType: 'read' | 'edit' | 'write' | 'bash';
}

const CommandLogRow: React.FC<CommandLogRowProps> = ({
  label,
  items,
  count,
  id,
  isLatest,
  groupType,
}) => {
  const [isExpanded, setIsExpanded] = useState(isLatest);
  const maxItems = Math.min(items.length, 8);
  const rotateAnim = useSharedValue(isLatest ? 180 : 0);

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  // Auto-expand latest, collapse when no longer latest
  useEffect(() => {
    setIsExpanded(isLatest);
  }, [isLatest]);

  useEffect(() => {
    rotateAnim.value = withTiming(isExpanded ? 180 : 0, { duration: 200 });
  }, [isExpanded]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateAnim.value}deg` }],
  }));

  return (
    <Animated.View
      style={styles.commandLogContainer}
      layout={LinearTransition.duration(250).easing(Easing.bezier(0.25, 0.1, 0.25, 1))}>
      <TouchableOpacity style={styles.commandLogRow} onPress={toggleExpand} activeOpacity={0.7}>
        <Text style={styles.commandStar}>✱</Text>
        <Text style={styles.commandLabel}>{label}</Text>
        <Text style={styles.commandMeta}>
          ({count} {count === 1 ? 'file' : 'files'})
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={16} color="#8E8E93" />
        </Animated.View>
      </TouchableOpacity>

      {isExpanded && (
        <Animated.View
          style={styles.expandedListL}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}>
          {/* L-shape: vertical line */}
          <View style={styles.lShapeLine} />

          {/* List items */}
          <View style={styles.expandedListItems}>
            {items.slice(0, 8).map((item, index) => (
              <Animated.View
                key={`${id}-${index}`}
                style={styles.commandLogItemRow}
                entering={FadeIn.duration(200).delay(index * 30)}
                layout={LinearTransition.duration(200)}>
                <Text style={styles.commandLogItem} numberOfLines={1}>
                  {getFileName(item)}
                </Text>
              </Animated.View>
            ))}
            {items.length > 8 && (
              <Animated.Text
                style={styles.commandLogMore}
                entering={FadeIn.duration(200).delay(8 * 30)}>
                +{items.length - 8} more
              </Animated.Text>
            )}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

// Todo Task Card Component - Glass effect with interactive
// Shows all tasks with shimmer on active tasks only if isLatest
const TaskCard: React.FC<{
  todos: { id: string; content: string; status: string }[];
  isLatest?: boolean;
}> = ({ todos, isLatest = false }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const content = (
    <>
      {/* Header */}
      <View style={styles.taskCardHeader}>
        <Text style={styles.taskCardTitle}>TASKS</Text>
        <View style={styles.taskCardDot} />
        <View style={{ flex: 1 }} />
        <Text style={styles.taskCardCount}>{todos.length}</Text>
      </View>

      {/* Task list */}
      <View style={styles.taskCardContent}>
        {todos.map((todo) => {
          const isCompleted = todo.status === 'completed';
          const isActive = todo.status === 'in_progress';

          return (
            <View key={todo.id} style={styles.taskItem}>
              {isCompleted ? (
                <Check
                  size={14}
                  color="rgba(255,255,255,0.35)"
                  strokeWidth={2.5}
                  style={styles.taskIcon}
                />
              ) : isActive ? (
                <View style={styles.taskDotActive} />
              ) : (
                <Text style={styles.taskBullet}>•</Text>
              )}
              {isActive && isLatest ? (
                <TextShimmer style={[styles.taskText, styles.taskTextActive]} duration={1500}>
                  {todo.content.length > 40 ? `${todo.content.slice(0, 40)}...` : todo.content}
                </TextShimmer>
              ) : (
                <Text
                  style={[
                    styles.taskText,
                    isCompleted && styles.taskTextCompleted,
                    isActive && styles.taskTextActive,
                  ]}
                  numberOfLines={1}>
                  {todo.content}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </>
  );

  if (useGlass) {
    return (
      <GlassView style={styles.taskCardGlass} isInteractive>
        {content}
      </GlassView>
    );
  }

  return (
    <View style={styles.taskCardContainer}>
      <BlurView intensity={40} tint="dark" style={styles.taskCardBlur}>
        {content}
      </BlurView>
    </View>
  );
};

// Circular Glass Back Button - with isInteractive
const GlassBackButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  const handlePressIn = () => {
    RNAnimated.timing(scaleAnim, {
      toValue: OnboardingAnimations.buttonPress.scale,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    RNAnimated.timing(scaleAnim, {
      toValue: 1,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    OnboardingHaptics.light();
    onPress();
  };

  if (useGlass) {
    return (
      <RNAnimated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}>
          <GlassView style={styles.glassBackButton} isInteractive>
            <View style={styles.glassBackButtonInner}>
              <ChevronLeft size={22} color="#FFFFFF" />
            </View>
          </GlassView>
        </TouchableOpacity>
      </RNAnimated.View>
    );
  }

  return (
    <RNAnimated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        <View style={styles.blurBackButton}>
          <BlurView intensity={40} tint="dark" style={styles.blurBackButtonContent}>
            <ChevronLeft size={22} color="#FFFFFF" />
          </BlurView>
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
};

// Home Button - Glass effect button for navigation to home
const GlassHomeButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    // Fade in with delay
    RNAnimated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 2000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressIn = () => {
    RNAnimated.timing(scaleAnim, {
      toValue: OnboardingAnimations.buttonPress.scale,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    RNAnimated.timing(scaleAnim, {
      toValue: 1,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    OnboardingHaptics.light();
    onPress();
  };

  const content = (
    <View style={styles.homeButtonContent}>
      <Home size={16} color="#FFFFFF" />
      <Text style={styles.homeButtonText}>Home</Text>
    </View>
  );

  if (useGlass) {
    return (
      <RNAnimated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}>
          <GlassView style={styles.glassHomeButton} isInteractive>
            {content}
          </GlassView>
        </TouchableOpacity>
      </RNAnimated.View>
    );
  }

  return (
    <RNAnimated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        <View style={styles.blurHomeButton}>
          <BlurView intensity={40} tint="dark" style={styles.blurHomeButtonContent}>
            {content}
          </BlurView>
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
};

// Status Message Component (in chat flow) with shimmer effect
const StatusMessage: React.FC<{ text: string; isReady: boolean }> = ({ text, isReady }) => {
  const pulseAnimation = useRef(new RNAnimated.Value(1)).current;

  // Truncate text strictly to prevent wrapping
  const displayText = text.length > 40 ? `${text.slice(0, 40)}...` : text;

  useEffect(() => {
    if (!isReady) {
      const pulse = () => {
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnimation, {
            toValue: 1.4,
            duration: 800,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    }
  }, [isReady, pulseAnimation]);

  return (
    <View style={styles.statusMessage}>
      <RNAnimated.View
        style={[
          styles.statusDot,
          isReady && styles.statusDotReady,
          { transform: [{ scale: pulseAnimation }] },
        ]}
      />
      {isReady ? (
        <Text style={[styles.statusText, styles.statusTextReady]} numberOfLines={1}>
          {displayText}
        </Text>
      ) : (
        <View style={styles.statusTextContainer}>
          <TextShimmer style={styles.statusText} duration={1500}>
            {displayText}
          </TextShimmer>
        </View>
      )}
    </View>
  );
};

export const NewOnboardingScreen15: React.FC<NewOnboardingScreen15Props> = ({
  onComplete,
  onBack,
  sessionId,
}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const navigation = useNavigation();
  const hasAutoOpened = useRef(false);
  const [autoOpenFailed, setAutoOpenFailed] = useState(false);
  const { user } = useVibraAuth();

  // SECURITY: Pass createdBy for ownership verification
  const session = useQuery(api.sessions.getById, sessionId && user?.id ? { id: sessionId as any, createdBy: user.id } : 'skip');
  const messages = useQuery(
    api.messages.getBySession,
    sessionId ? { sessionId: sessionId as any } : 'skip'
  );

  // Track if we've seen the CUSTOM status (AI agent working)
  const hasSeenCustomStatus = useRef(false);

  // Track when CUSTOM status is seen
  useEffect(() => {
    if (session?.status === 'CUSTOM') {
      hasSeenCustomStatus.current = true;
    }
  }, [session?.status]);

  const groups = useMemo(() => {
    if (!messages) return [];
    return processMessagesIntoGroups(messages);
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (groups.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [groups.length, session?.status]);

  // Auto-open the app when status changes to RUNNING after CUSTOM (agent finished)
  // The first RUNNING is just environment setup, the second RUNNING (after CUSTOM) means app is truly ready
  useEffect(() => {
    const isRunning = session?.status === 'RUNNING';
    const tunnelUrl = session?.tunnelUrl;

    // Only auto-open if:
    // 1. Status is RUNNING
    // 2. We have a tunnel URL
    // 3. We have a sessionId
    // 4. We haven't already auto-opened
    // 5. We've seen CUSTOM status (meaning AI agent has started/finished working)
    if (isRunning && tunnelUrl && sessionId && !hasAutoOpened.current && hasSeenCustomStatus.current) {
      hasAutoOpened.current = true;

      // Wait 1-2 seconds before auto-opening
      const delay = 1500 + Math.random() * 500; // 1.5-2 seconds

      const timeout = setTimeout(async () => {
        try {
          OnboardingHaptics.success();
          console.log('🚀 Auto-opening app after generation:', tunnelUrl);
          await safeOpenProject(tunnelUrl, sessionId);
          console.log('✅ App opened successfully');
        } catch (error) {
          console.error('❌ Failed to auto-open app:', error);
          setAutoOpenFailed(true);
          OnboardingHaptics.error();
        }
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [session?.status, session?.tunnelUrl, sessionId]);

  const handleBack = () => {
    OnboardingHaptics.light();
    onBack();
  };

  const handleGoHome = useCallback(() => {
    OnboardingHaptics.medium();
    // Navigate to home tab
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' as never }],
      })
    );
  }, [navigation]);

  const getStatusText = () => {
    if (!session) return 'Connecting...';

    if (session.status === 'RUNNING') {
      // Only show "App ready!" if we've seen CUSTOM status (AI has worked on it)
      // The first RUNNING is just environment setup
      if (hasSeenCustomStatus.current) {
        return 'App ready!';
      } else {
        return 'Starting AI agent...';
      }
    } else if (session.status === 'CUSTOM') {
      const text = session.statusMessage || 'Working on task';
      return text.length > 50 ? `${text.slice(0, 50)}...` : text;
    } else if (session.status === 'IN_PROGRESS') {
      return 'Initializing';
    } else if (session.status === 'CLONING_REPO') {
      return 'Cloning repository';
    } else if (session.status === 'INSTALLING_DEPENDENCIES') {
      return 'Installing dependencies';
    } else if (session.status === 'STARTING_DEV_SERVER') {
      return 'Starting development server';
    } else if (session.status === 'CREATING_TUNNEL') {
      return 'Creating tunnel';
    } else {
      const text = session.statusMessage || 'Working on task';
      return text.length > 50 ? `${text.slice(0, 50)}...` : text;
    }
  };

  // Find the latest expandable group (read, edit, write, bash)
  const latestExpandableId = useMemo(() => {
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g.type === 'read' || g.type === 'edit' || g.type === 'write' || g.type === 'bash') {
        return g.id;
      }
    }
    return null;
  }, [groups]);

  // Find the latest task card
  const latestTaskCardId = useMemo(() => {
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].type === 'tasks') {
        return groups[i].id;
      }
    }
    return null;
  }, [groups]);

  const renderGroupedItem = (group: GroupedItem) => {
    const isLatest = group.id === latestExpandableId;
    const isLatestTaskCard = group.id === latestTaskCardId;

    switch (group.type) {
      case 'read':
        return (
          <CommandLogRow
            key={group.id}
            id={group.id}
            label="Read file"
            items={group.files}
            count={group.files.length}
            isLatest={isLatest}
            groupType="read"
          />
        );
      case 'edit':
        return (
          <CommandLogRow
            key={group.id}
            id={group.id}
            label="Edit file"
            items={group.files}
            count={group.files.length}
            isLatest={isLatest}
            groupType="edit"
          />
        );
      case 'write':
        return (
          <CommandLogRow
            key={group.id}
            id={group.id}
            label="Wrote file"
            items={group.files}
            count={group.files.length}
            isLatest={isLatest}
            groupType="write"
          />
        );
      case 'bash':
        return (
          <CommandLogRow
            key={group.id}
            id={group.id}
            label="Ran command"
            items={group.commands}
            count={group.commands.length}
            isLatest={isLatest}
            groupType="bash"
          />
        );
      case 'tool':
        return (
          <View key={group.id} style={styles.commandLogRow}>
            <Text style={styles.commandStar}>✱</Text>
            <Text style={styles.commandLabel}>Executed tool: {group.toolName}</Text>
            <Text style={styles.commandMeta}>
              ({group.count} {group.count === 1 ? 'update' : 'updates'})
            </Text>
          </View>
        );
      case 'tasks':
        return <TaskCard key={group.id} todos={group.todos} isLatest={isLatestTaskCard} />;
      case 'text':
        return (
          <Text key={group.id} style={styles.statusTextBlock}>
            {renderMarkdown(group.content)}
          </Text>
        );
      default:
        return null;
    }
  };

  // App is truly ready only when:
  // 1. Status is RUNNING
  // 2. We've seen CUSTOM status (AI agent has worked on it)
  // The first RUNNING is just environment setup, the second RUNNING (after CUSTOM) means app is truly ready
  const isReady = session?.status === 'RUNNING' && hasSeenCustomStatus.current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Memoized Background - won't re-render on status change */}
      <MemoizedBackground />

      {/* Top fade gradient - at very top */}
      <LinearGradient
        colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']}
        locations={[0, 0.5, 1]}
        style={styles.topFade}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <GlassBackButton onPress={handleBack} />
        <Text style={[styles.exitHint, (autoOpenFailed || isReady) && styles.exitHintWithButton]}>
          You can exit — we'll notify you when it's ready
        </Text>
        {/* Show Home button if auto-open failed or app is ready */}
        {(autoOpenFailed || isReady) && <GlassHomeButton onPress={handleGoHome} />}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40, paddingTop: 16 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* App Icon - Native asset for instant loading */}
        <View style={styles.iconContainer}>
          <Image source={NATIVE_ONBOARDING_ASSETS.state2} style={styles.appIcon} resizeMode="cover" />
        </View>

        {/* Title */}
        <Text style={styles.title}>Generating your app</Text>

        {/* Messages List */}
        <View style={styles.messagesList}>
          {groups.map((group) => renderGroupedItem(group))}

          {/* Status message in chat flow */}
          <StatusMessage text={getStatusText()} isReady={isReady} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4a3520',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  exitHint: {
    flex: 1,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  exitHintWithButton: {
    marginRight: 0,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 5,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  glassBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  glassBackButtonInner: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  blurBackButtonContent: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  appIcon: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  messagesList: {
    gap: 8,
  },

  // Command Log Rows
  commandLogContainer: {
    marginVertical: 2,
  },
  commandLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  commandStar: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginRight: 10,
  },
  commandLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  commandMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    marginLeft: 8,
    flex: 1,
  },

  // L-shape expanded list
  expandedListL: {
    flexDirection: 'row',
    marginLeft: 6,
    marginTop: 4,
    paddingBottom: 4,
  },
  lShapeLine: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
    borderRadius: 1,
  },
  expandedListItems: {
    flex: 1,
  },
  commandLogItemRow: {
    paddingVertical: 5,
  },
  commandLogItem: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  commandLogMore: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    paddingVertical: 4,
    fontStyle: 'italic',
  },

  // Task Card - Glass effect for iOS 26+, Blur fallback for older
  taskCardGlass: {
    marginVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  taskCardContainer: {
    marginVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  taskCardBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  taskCardTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  taskCardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
    marginLeft: 6,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  taskCardCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
    marginRight: 4,
  },
  taskCardContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  taskIcon: {
    marginRight: 10,
  },
  taskDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 10,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  taskBullet: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    width: 14,
    textAlign: 'center',
    marginRight: 10,
  },
  taskText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  taskTextCompleted: {
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
  },
  taskTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Status Text Block
  statusTextBlock: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 24,
    paddingVertical: 12,
  },

  // Status message in chat flow
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  statusDotReady: {
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOpacity: 0.7,
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  statusTextContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  statusTextReady: {
    color: '#34C759',
  },

  // Glass Home Button styles
  glassHomeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
  },
  blurHomeButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurHomeButtonContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  homeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NewOnboardingScreen15;
