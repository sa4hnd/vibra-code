import { useQuery } from 'convex/react';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import {
  Mic,
  MessageCircle,
  Heart,
  Image as ImageIcon,
  Music,
  Calculator,
  BookOpen,
  Dumbbell,
  ShoppingCart,
  Utensils,
} from 'lucide-react-native';
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassBackButton,
  GlassChip,
  GlassInputContainer,
  GlassContinueButton,
} from './OnboardingComponents';
import { OnboardingColors, OnboardingHaptics, OnboardingAnimations } from './OnboardingConstants';
import { api } from '../../../../convex/_generated/api';
import { useVibraAuth } from '../../../contexts/VibraAuthContext';
import { useVoiceRecording } from '../../../hooks/useVoiceRecording';
import { useCreateSession } from '../../../services/VibraSessionService';

interface NewOnboardingScreen12Props {
  onNext: (sessionId: string, prompt: string) => void;
  onBack: () => void;
}

const APP_IDEAS = [
  {
    id: 'ai-chat',
    label: 'AI chat',
    icon: MessageCircle,
    prompt:
      'Build an AI chat app where users can have conversations with an AI assistant. Include chat history, markdown support, and a clean modern interface.',
  },
  {
    id: 'mood-tracker',
    label: 'Mood Tracker',
    icon: Heart,
    prompt:
      'Create a mood tracking app where users can log their daily mood, add notes, and view their mood history over time with simple charts.',
  },
  {
    id: 'social-app',
    label: 'Social app',
    icon: ImageIcon,
    prompt:
      'Build a simple social app where users can post updates, share photos, and interact with others through likes and comments.',
  },
  {
    id: 'music-player',
    label: 'Music Player',
    icon: Music,
    prompt:
      'Create a music player app with playlists, play/pause controls, shuffle, and a beautiful now playing screen.',
  },
  {
    id: 'calculator',
    label: 'Calculator',
    icon: Calculator,
    prompt:
      'Build a calculator app with basic arithmetic operations, history of calculations, and a clean minimal design.',
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: BookOpen,
    prompt:
      'Create a notes app where users can write, organize, and search through their notes with folders and tags.',
  },
  {
    id: 'fitness',
    label: 'Fitness',
    icon: Dumbbell,
    prompt:
      'Build a fitness tracking app with workout logging, exercise library, and progress tracking with visual charts.',
  },
  {
    id: 'shopping',
    label: 'Shopping List',
    icon: ShoppingCart,
    prompt:
      'Create a shopping list app where users can add items, check them off, organize by category, and save favorite lists.',
  },
  {
    id: 'recipes',
    label: 'Recipes',
    icon: Utensils,
    prompt:
      'Build a recipe app where users can browse recipes, save favorites, and follow step-by-step cooking instructions.',
  },
];

export const NewOnboardingScreen12: React.FC<NewOnboardingScreen12Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useVibraAuth();
  const { createSession } = useCreateSession();
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

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

  // Token management
  const userTokens = useQuery(api.usage.getUserMessages, { clerkId: user?.id || '' });
  const hasTokens = useQuery(api.usage.hasMessages, { clerkId: user?.id || '' });
  const canCreateApp = hasTokens === true;

  const handleBack = useCallback(() => {
    if (isRecording) {
      cancelRecording();
    }
    onBack();
  }, [isRecording, cancelRecording, onBack]);

  const handleChipPress = (idea: (typeof APP_IDEAS)[0]) => {
    OnboardingHaptics.selection();
    setPrompt(idea.prompt);
    inputRef.current?.focus();
  };

  // Handle mic button press
  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      const transcribedText = await stopRecording();
      if (transcribedText) {
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

  const handleContinue = useCallback(async () => {
    if (isRecording) {
      cancelRecording();
    }

    if (!prompt.trim()) {
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
      OnboardingHaptics.medium();
      setIsCreating(true);
      Keyboard.dismiss();

      // Always use expo template for mobile apps
      const template = 'expo';

      // Create session using the Convex hook
      const sessionId = await createSession({
        message: prompt.trim(),
        template,
      });

      // Pass sessionId and prompt to next screen
      onNext(sessionId, prompt.trim());
    } catch (error) {
      console.error('Error creating app:', error);
      Alert.alert('Error', 'Failed to create app. Please try again.');
      setIsCreating(false);
    }
  }, [
    prompt,
    isAuthenticated,
    canCreateApp,
    userTokens,
    createSession,
    onNext,
    isRecording,
    cancelRecording,
  ]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const isButtonEnabled =
    prompt.trim().length > 0 && !isCreating && !isRecording && !isTranscribing;

  const handleButtonPressIn = useCallback(() => {
    Animated.timing(buttonScaleAnim, {
      toValue: OnboardingAnimations.buttonPress.scale,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  }, [buttonScaleAnim]);

  const handleButtonPressOut = useCallback(() => {
    Animated.timing(buttonScaleAnim, {
      toValue: 1,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  }, [buttonScaleAnim]);

  // Render waveform bars for recording visualization
  const renderWaveform = () => {
    const bars = 5;
    return (
      <View style={styles.waveformContainer}>
        {Array.from({ length: bars }).map((_, i) => {
          const variation = Math.sin((i / bars) * Math.PI) * 0.3 + 0.7;
          const height = 8 + audioLevel * 20 * variation;
          return <View key={i} style={[styles.waveformBar, { height }]} />;
        })}
      </View>
    );
  };

  // Render input content (shared between glass and fallback)
  const renderInputContent = () => {
    if (isRecording) {
      return (
        <View style={styles.recordingContainer}>
          {renderWaveform()}
          <Text style={styles.recordingText}>Recording {formatDuration(duration)}</Text>
          <View style={styles.recordingControls}>
            <TouchableOpacity style={styles.cancelRecordingButton} onPress={cancelRecording}>
              <Text style={styles.cancelRecordingText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopRecordingButton} onPress={handleMicPress}>
              <View style={styles.stopIcon} />
              <Text style={styles.stopRecordingText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (isTranscribing) {
      return (
        <View style={styles.transcribingContainer}>
          <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.6)" />
          <Text style={styles.transcribingText}>Transcribing...</Text>
        </View>
      );
    }

    return (
      <View style={styles.inputContentWrapper}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          placeholder="Start typing"
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          textAlignVertical="top"
          editable={!isCreating}
        />
        {isVoiceSupported && (
          <TouchableOpacity style={styles.micButton} onPress={handleMicPress} activeOpacity={0.7}>
            <Mic size={20} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header with Progress Bar */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={handleBack} />

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: '75%' }]} />
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Describe your app idea</Text>

        {/* App Ideas - Glass Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          style={styles.chipsScroll}
          keyboardShouldPersistTaps="handled">
          {APP_IDEAS.map((idea) => {
            const IconComponent = idea.icon;
            return (
              <GlassChip
                key={idea.id}
                label={idea.label}
                icon={<IconComponent size={16} color="#FFFFFF" />}
                onPress={() => handleChipPress(idea)}
              />
            );
          })}
        </ScrollView>

        {/* Text Input - Glass Container */}
        <View style={styles.inputContainer}>
          {useGlass ? (
            <GlassView style={styles.glassTextInputWrapper} isInteractive>
              {renderInputContent()}
            </GlassView>
          ) : (
            <View style={styles.blurTextInputContainer}>
              <BlurView intensity={40} tint="dark" style={styles.blurTextInput}>
                {renderInputContent()}
              </BlurView>
            </View>
          )}
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Continue Button */}
        <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
            <TouchableOpacity
              style={[styles.continueButton, !isButtonEnabled && styles.continueButtonDisabled]}
              onPress={handleContinue}
              onPressIn={isButtonEnabled ? handleButtonPressIn : undefined}
              onPressOut={isButtonEnabled ? handleButtonPressOut : undefined}
              disabled={!isButtonEnabled}
              activeOpacity={1}>
              {isCreating ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#666666" />
                  <Text style={styles.loadingText}>Creating your app...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.continueButtonText,
                    !isButtonEnabled && styles.continueButtonTextDisabled,
                  ]}>
                  Continue
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OnboardingColors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressBarContainer: {
    flex: 1,
    marginLeft: 8,
    marginRight: 16,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: OnboardingColors.progressBar.background,
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: OnboardingColors.progressBar.fill,
    borderRadius: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 20,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 16,
  },
  chipsContainer: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 8,
  },
  inputContainer: {
    flex: 1,
    paddingHorizontal: 24,
    maxHeight: 220,
  },
  // Glass text input styles
  glassTextInputWrapper: {
    flex: 1,
    borderRadius: 16,
    minHeight: 120,
  },
  blurTextInputContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  blurTextInput: {
    flex: 1,
    borderRadius: 16,
  },
  inputContentWrapper: {
    flex: 1,
    position: 'relative',
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: OnboardingColors.background.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    padding: 18,
    paddingTop: 18,
    paddingBottom: 50,
    lineHeight: 24,
  },
  micButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Recording UI
  recordingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
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
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  cancelRecordingButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelRecordingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  stopRecordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FF4444',
    gap: 8,
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
  transcribingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  transcribingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  continueButton: {
    backgroundColor: OnboardingColors.button.primaryBg,
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  continueButtonDisabled: {
    backgroundColor: OnboardingColors.button.disabledBg,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: OnboardingColors.button.primaryText,
  },
  continueButtonTextDisabled: {
    color: OnboardingColors.button.disabledText,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
});

export default NewOnboardingScreen12;
