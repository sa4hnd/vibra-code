import { CommonActions } from '@react-navigation/native';

import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, ChevronLeft, Rocket, Mic, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  InteractionManager,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { api } from '../../convex/_generated/api';
import { VibraCosmicBackground } from '../components/vibra/VibraCosmicBackground';
import { VibraUpgradeButton } from '../components/vibra/VibraUpgradeButton';
import { OFFERINGS } from '../config/revenuecat';
import { VibraColors, VibraSpacing } from '../constants/VibraColors';
import { useVibraAuth } from '../contexts/VibraAuthContext';
import { useImagePicker } from '../hooks/useImagePicker';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { useCreateSession } from '../services/VibraSessionService';

interface VibraCreateAppScreenProps {
  navigation: any;
}

// Function to get sophisticated gradients that match our dark theme - same as project cards

const SUGGESTED_APPS = [
  {
    title: 'Todo List App',
    desc: 'Create, edit, and organize your daily tasks with categories and due dates',
    prompt:
      'Build a simple todo list app where users can create, edit, and delete tasks. Include features like marking tasks as complete, adding due dates, organizing tasks by categories, and filtering by status. Use React state or local storage only - no databases, no authentication, no backend. Keep it simple and intuitive with a clean interface. All data should be stored locally in the browser or app state.',
  },
  {
    title: 'Expense Tracker',
    desc: 'Track your spending by category and see where your money goes',
    prompt:
      'Create a simple expense tracker app that helps users track their daily spending. Include features to add expenses with amount, category, and date. Show a summary of spending by category with simple charts, and allow users to view their spending history. Use React state or local storage only - no databases, no authentication, no backend. All data should be stored locally in the browser or app state.',
  },
  {
    title: 'Notes App',
    desc: 'Write and organize notes with categories, search, and formatting',
    prompt:
      'Build a simple notes app where users can create, edit, and delete notes. Include features like organizing notes into categories or folders, searching through notes, and basic text formatting. Use React state or local storage only - no databases, no authentication, no backend. Make it easy to quickly capture and find information. All data should be stored locally in the browser or app state.',
  },
  {
    title: 'Habit Tracker',
    desc: 'Build good habits by tracking daily activities and viewing progress',
    prompt:
      'Create a simple habit tracker app that helps users build good habits by tracking their daily activities. Include features to add habits, mark them as done each day, view progress over time with visual charts. Show streaks and statistics to motivate users. Use React state or local storage only - no databases, no authentication, no backend. All data should be stored locally in the browser or app state.',
  },
  {
    title: 'Shopping List',
    desc: 'Create multiple lists, check off items, and organize by store or category',
    prompt:
      'Build a simple shopping list app where users can create multiple shopping lists, add items to each list, check off items as they shop, and delete items. Include features to organize items by store or category. Use React state or local storage only - no databases, no authentication, no backend. All data should be stored locally in the browser or app state.',
  },
  {
    title: 'Recipe Book',
    desc: 'Save recipes with ingredients, instructions, and organize by meal type',
    prompt:
      'Create a simple recipe book app where users can save their favorite recipes. Include features to add recipe name, ingredients list, step-by-step instructions, cooking time, and meal type. Allow users to organize recipes by categories like breakfast, lunch, dinner, or dessert. Use React state or local storage only - no databases, no authentication, no backend. All data should be stored locally in the browser or app state.',
  },
  {
    title: 'Daily Journal',
    desc: 'Write daily entries with photos and look back at your memories',
    prompt:
      'Build a simple daily journal app where users can write daily entries with text. Include features to add entries with date, view entries in a calendar, search through past entries, and look back at memories. Use React state or local storage only - no databases, no authentication, no backend. Make it private and personal with a simple, calming interface. All data should be stored locally in the browser or app state.',
  },
  {
    title: 'Goal Tracker',
    desc: 'Set goals, track progress with milestones, and celebrate achievements',
    prompt:
      'Create a simple goal tracker app where users can set personal goals, track their progress, and celebrate achievements. Include features to add goals with descriptions, set milestones, update progress, and visualize progress with progress bars. Show completed goals and motivate users to achieve more. Use React state or local storage only - no databases, no authentication, no backend. All data should be stored locally in the browser or app state.',
  },
];

export const VibraCreateAppScreen: React.FC<VibraCreateAppScreenProps> = ({ navigation }) => {
  const { isAuthenticated, user } = useVibraAuth();
  const { createSession } = useCreateSession();
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isScreenReady, setIsScreenReady] = useState(false);

  // Voice recording hook
  const {
    isRecording,
    isTranscribing,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    isSupported: isVoiceSupported,
  } = useVoiceRecording();

  // Image picker hook
  const { images, pickImages, removeImage, clearImages, isPicking } = useImagePicker(5);

  // Token management
  const userTokens = useQuery(api.usage.getUserMessages, { clerkId: user?.id || '' });
  const hasTokens = useQuery(api.usage.hasMessages, { clerkId: user?.id || '' });
  const canCreateApp = hasTokens === true;

  const handleUpgrade = async () => {
    try {
      await RevenueCatUI.presentPaywall({
        offeringIdentifier: OFFERINGS.DEFAULT,
        displayCloseButton: true,
      });
    } catch (error) {
      console.error('Error presenting paywall:', error);
      Alert.alert('Error', 'Failed to load payment options. Please try again.');
    }
  };

  // Defer heavy operations until after navigation transition
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setIsScreenReady(true);
      }, 100);
    });

    return () => task.cancel();
  }, []);

  // Handle mic button press
  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      const transcribedText = await stopRecording();
      if (transcribedText) {
        // Append transcribed text to existing prompt
        setPrompt((prev) => {
          if (prev.trim()) {
            return `${prev} ${transcribedText}`;
          }
          return transcribedText;
        });
      }
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Format recording duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateApp = useCallback(async () => {
    // Cancel any ongoing recording
    if (isRecording) {
      cancelRecording();
    }

    const hasText = prompt.trim().length > 0;
    const hasImages = images.length > 0;

    if (!hasText && !hasImages) {
      Alert.alert('Error', 'Please describe your app idea or attach an image');
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Error', 'Please sign in to create an app');
      return;
    }

    if (!canCreateApp) {
      Alert.alert(
        'No Tokens',
        userTokens?.subscriptionPlan === 'pro'
          ? 'Monthly tokens exhausted. Upgrade your plan or wait for reset.'
          : 'Free tokens exhausted. Upgrade to Pro for unlimited access.'
      );
      return;
    }

    try {
      setIsCreating(true);

      // Prepare images for upload
      const imagesToUpload = images.map((img) => ({
        fileName: img.fileName,
        uri: img.uri,
      }));

      // Always use expo template for mobile apps
      const template = 'expo';

      // Create session using the Convex hook with images
      const sessionId = await createSession({
        message: prompt.trim() || 'Create an app based on these images',
        template, // Use selected template based on project type
        images: imagesToUpload.length > 0 ? imagesToUpload : undefined,
      });

      // Clear images after successful creation
      clearImages();

      // Navigate directly to loading screen (both screens are in the same HomeStack)
      navigation.navigate('VibraAppLoading', {
        sessionId,
        prompt: prompt.trim(),
      });
    } catch (error) {
      console.error('Error creating app:', error);
      Alert.alert('Error', 'Failed to create app. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [
    prompt,
    images,
    isAuthenticated,
    canCreateApp,
    userTokens,
    createSession,
    navigation,
    isRecording,
    cancelRecording,
    clearImages,
  ]);

  const handleSuggestionPress = useCallback((suggestion: any) => {
    setPrompt(suggestion.prompt);
  }, []);

  const handleBack = useCallback(() => {
    // Cancel any ongoing recording when leaving
    if (isRecording) {
      cancelRecording();
    }
    navigation.goBack();
  }, [navigation, isRecording, cancelRecording]);

  const suggestionItems = useMemo(() => {
    if (!isScreenReady) return [];

    return SUGGESTED_APPS.map((suggestion, index) => {
      return (
        <TouchableOpacity
          key={index}
          style={styles.suggestionCard}
          onPress={() => handleSuggestionPress(suggestion)}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.suggestionGradientOverlay}
          />
          <View style={styles.suggestionContent}>
            <View style={styles.suggestionInfo}>
              <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
              <Text style={styles.suggestionDesc}>{suggestion.desc}</Text>
            </View>
            <View style={styles.suggestionArrow}>
              <ChevronRight size={20} color={VibraColors.neutral.textTertiary} />
            </View>
          </View>
        </TouchableOpacity>
      );
    });
  }, [handleSuggestionPress, isScreenReady]);

  // Render waveform bars for recording visualization
  const renderWaveform = () => {
    const bars = 5;
    return (
      <View style={styles.waveformContainer}>
        {Array.from({ length: bars }).map((_, i) => {
          // Create variation in bar heights based on audio level
          const variation = Math.sin((i / bars) * Math.PI) * 0.3 + 0.7;
          const height = 8 + audioLevel * 20 * variation;
          return <View key={i} style={[styles.waveformBar, { height }]} />;
        })}
      </View>
    );
  };

  return (
    <VibraCosmicBackground>
      {/* Main content */}
      <View style={styles.contentWrapper}>
        {/* Header Container - matches home page exactly */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ChevronLeft size={24} color={VibraColors.neutral.text} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>Create New App</Text>
              <Text style={styles.headerSubtitle}>Describe your app idea and let AI build it</Text>
            </View>
          </View>
        </View>

        {/* Main Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Input Section */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>What would you like to build?</Text>

            {/* Image Preview Container */}
            {images.length > 0 && (
              <View style={styles.imagePreviewContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imagePreviewScroll}>
                  {images.map((image) => (
                    <View key={image.id} style={styles.imagePreviewWrapper}>
                      <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(image.id)}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <X size={10} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                {images.length > 1 && (
                  <TouchableOpacity style={styles.clearAllButton} onPress={clearImages}>
                    <Text style={styles.clearAllText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Text Input with Buttons */}
            <View style={styles.textInputContainer}>
              {/* Recording state indicator */}
              {isRecording && (
                <View style={styles.recordingIndicator}>
                  {renderWaveform()}
                  <Text style={styles.recordingText}>Recording {formatDuration(duration)}</Text>
                </View>
              )}

              {/* Transcribing indicator */}
              {isTranscribing && (
                <View style={styles.transcribingIndicator}>
                  <ActivityIndicator size="small" color={VibraColors.neutral.textSecondary} />
                  <Text style={styles.transcribingText}>Transcribing...</Text>
                </View>
              )}

              {/* Normal input view */}
              {!isRecording && !isTranscribing && (
                <View style={styles.inputRow}>
                  {/* Image button - left side */}
                  <TouchableOpacity
                    style={styles.inputIconButton}
                    onPress={pickImages}
                    disabled={!canCreateApp || isPicking}>
                    <ImageIcon
                      size={20}
                      color={canCreateApp ? VibraColors.neutral.textSecondary : '#666666'}
                    />
                    {images.length > 0 && (
                      <View style={styles.imageBadge}>
                        <Text style={styles.imageBadgeText}>{images.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Text input */}
                  <TextInput
                    style={styles.textInputWithButtons}
                    placeholder={
                      !canCreateApp
                        ? userTokens?.subscriptionPlan === 'pro'
                          ? 'Monthly tokens exhausted.'
                          : 'Free tokens exhausted.'
                        : 'Describe your app idea...'
                    }
                    placeholderTextColor={!canCreateApp ? '#FF6B6B' : 'rgba(255, 255, 255, 0.5)'}
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    textAlignVertical="top"
                    editable={canCreateApp && !isRecording && !isTranscribing}
                  />

                  {/* Mic button - right side (iOS only) */}
                  {isVoiceSupported && (
                    <TouchableOpacity
                      style={[
                        styles.inputIconButton,
                        styles.micButton,
                        isRecording && styles.micButtonRecording,
                      ]}
                      onPress={handleMicPress}
                      disabled={!canCreateApp || isTranscribing}>
                      <Mic
                        size={20}
                        color={
                          isRecording
                            ? '#FFFFFF'
                            : canCreateApp
                              ? VibraColors.neutral.textSecondary
                              : '#666666'
                        }
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Recording controls overlay */}
              {isRecording && (
                <View style={styles.recordingControls}>
                  <TouchableOpacity style={styles.cancelRecordingButton} onPress={cancelRecording}>
                    <Text style={styles.cancelRecordingText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stopRecordingButton} onPress={handleMicPress}>
                    <View style={styles.stopIcon} />
                    <Text style={styles.stopRecordingText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Build Button */}
            <TouchableOpacity
              style={[
                styles.buildButton,
                (isCreating || !canCreateApp || isRecording || isTranscribing) &&
                  styles.buildButtonDisabled,
              ]}
              onPress={handleCreateApp}
              disabled={isCreating || !canCreateApp || isRecording || isTranscribing}
              activeOpacity={0.8}>
              <LinearGradient
                colors={
                  isCreating || !canCreateApp || isRecording || isTranscribing
                    ? ['#666666', '#555555']
                    : [VibraColors.neutral.text, VibraColors.neutral.textSecondary]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buildButtonGradient}>
                {isCreating ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Rocket size={20} color="#000000" />
                )}
                <Text style={styles.buildButtonText}>
                  {isCreating ? 'Creating...' : !canCreateApp ? 'No Tokens' : 'Build App'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Upgrade Button - Show when tokens are exhausted */}
            {!canCreateApp && userTokens && (
              <VibraUpgradeButton
                onPress={handleUpgrade}
                isPro={userTokens.subscriptionPlan === 'pro'}
              />
            )}
          </View>

          {/* Suggestions Section - Only render when screen is ready */}
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Popular App Ideas</Text>
            <Text style={styles.suggestionsSubtitle}>
              Choose a template or describe your own app idea
            </Text>
            <View style={styles.suggestionsList}>
              {isScreenReady
                ? suggestionItems
                : // Loading skeleton for suggestions
                  Array.from({ length: 4 }).map((_, index) => (
                    <View key={index} style={styles.skeletonCard}>
                      <View style={styles.skeletonContent}>
                        <View style={styles.skeletonIcon} />
                        <View style={styles.skeletonInfo}>
                          <View style={styles.skeletonLine} />
                          <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
                        </View>
                        <View style={styles.skeletonChevron} />
                      </View>
                    </View>
                  ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by VibraCoder</Text>
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
  },

  // Main content
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

  // Input section
  inputContainer: {
    marginBottom: VibraSpacing['3xl'],
    gap: VibraSpacing.xl,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: VibraSpacing.lg,
    letterSpacing: -0.8,
    textAlign: 'center',
  },

  // Image preview
  imagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VibraSpacing.sm,
    paddingHorizontal: VibraSpacing.sm,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  imagePreviewScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VibraSpacing.sm,
  },
  imagePreviewWrapper: {
    position: 'relative',
  },
  imagePreview: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearAllButton: {
    marginLeft: 'auto',
    paddingHorizontal: VibraSpacing.md,
    paddingVertical: VibraSpacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  clearAllText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },

  // Text input container
  textInputContainer: {
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
    minHeight: 120,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: VibraSpacing.sm,
    paddingTop: VibraSpacing.sm,
  },
  inputIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  micButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  micButtonRecording: {
    backgroundColor: '#FF4444',
  },
  textInputWithButtons: {
    flex: 1,
    color: VibraColors.neutral.text,
    fontSize: 16,
    minHeight: 100,
    maxHeight: 180,
    paddingHorizontal: VibraSpacing.md,
    paddingVertical: VibraSpacing.sm,
    textAlignVertical: 'top',
    lineHeight: 24,
    fontWeight: '400',
  },
  imageBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: VibraColors.accent.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },

  // Recording UI
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: VibraSpacing['2xl'],
    gap: VibraSpacing.md,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  waveformBar: {
    width: 4,
    backgroundColor: '#FF4444',
    borderRadius: 2,
    minHeight: 8,
  },
  recordingText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: VibraSpacing.lg,
    gap: VibraSpacing.xl,
  },
  cancelRecordingButton: {
    paddingHorizontal: VibraSpacing.xl,
    paddingVertical: VibraSpacing.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelRecordingText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  stopRecordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
    paddingVertical: VibraSpacing.sm,
    borderRadius: 20,
    backgroundColor: '#FF4444',
    gap: VibraSpacing.sm,
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  stopRecordingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Transcribing UI
  transcribingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: VibraSpacing['2xl'],
    gap: VibraSpacing.sm,
  },
  transcribingText: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Suggestions section
  suggestionsContainer: {
    marginBottom: VibraSpacing['3xl'],
  },
  suggestionsTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: VibraSpacing.xs,
    letterSpacing: -0.5,
  },
  suggestionsSubtitle: {
    color: '#CCCCCC',
    fontSize: 15,
    marginBottom: VibraSpacing.xl,
    fontWeight: '400',
    opacity: 0.9,
    lineHeight: 20,
  },
  suggestionsList: {
    gap: VibraSpacing.md,
  },
  suggestionCard: {
    marginBottom: 16,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  suggestionGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    position: 'relative',
  },
  suggestionInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  suggestionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  suggestionDesc: {
    color: '#CCCCCC',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16,
    opacity: 0.8,
  },
  suggestionArrow: {
    width: 36,
    height: 36,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  // Footer
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
    color: VibraColors.neutral.textSecondary,
    fontSize: 11,
    fontWeight: '300',
    fontFamily: 'System',
    textAlign: 'center',
    opacity: 0.7,
    letterSpacing: 0.5,
  },
  buildButton: {
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
  buildButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    gap: VibraSpacing.sm,
  },
  buildButtonDisabled: {
    backgroundColor: '#666666',
    shadowOpacity: 0,
    elevation: 0,
  },
  buildButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Skeleton loading styles
  skeletonCard: {
    marginBottom: 16,
    position: 'relative',
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    opacity: 0.6,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
  },
  skeletonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    position: 'relative',
    zIndex: 1,
  },
  skeletonInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    backgroundColor: VibraColors.accent.blue + '20',
    borderRadius: 12,
    marginRight: 20,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: VibraColors.accent.blue + '20',
    borderRadius: 4,
    marginBottom: VibraSpacing.xs,
  },
  skeletonLineShort: {
    width: '60%',
  },
  skeletonChevron: {
    width: 32,
    height: 32,
    backgroundColor: VibraColors.accent.blue + '20',
    borderRadius: 16,
  },
});

export default VibraCreateAppScreen;
