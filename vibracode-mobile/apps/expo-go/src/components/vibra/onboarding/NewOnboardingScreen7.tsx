import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassPromptCard, GlassContinueButton } from './OnboardingComponents';
import { OnboardingColors, OnboardingHaptics, OnboardingAnimations } from './OnboardingConstants';

interface NewOnboardingScreen7Props {
  onNext: () => void;
  onBack: () => void;
}

const PROMPT_LEVELS = [
  {
    id: 0,
    label: 'New',
    subtitle: "I'm just getting started with AI",
    prompt: 'recipe app',
  },
  {
    id: 1,
    label: 'Learning',
    subtitle: "I've tried a few prompts but still experiment",
    prompt: 'Easy pasta for lazy cook',
  },
  {
    id: 2,
    label: 'Comfortable',
    subtitle: 'I know how to get good results most of the time',
    prompt: 'A recipe app with ingredient search, step-by-step cooking mode, and save favorites',
  },
  {
    id: 3,
    label: 'Expert',
    subtitle: 'I can write detailed prompts for complex tasks',
    prompt:
      'Build a recipe management app with: 1) Search by ingredients 2) Step-by-step cooking mode with timers 3) Nutritional info 4) Social sharing 5) Offline support',
  },
];

export const NewOnboardingScreen7: React.FC<NewOnboardingScreen7Props> = ({ onNext, onBack }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const selectedLevelRef = useRef(0);
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cursor blink effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  // Typewriter effect with haptic feedback
  useEffect(() => {
    const targetText = PROMPT_LEVELS[selectedLevel].prompt;
    setDisplayedText('');
    setIsTyping(true);

    // Clear any existing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    let currentIndex = 0;
    typingIntervalRef.current = setInterval(() => {
      if (currentIndex < targetText.length) {
        setDisplayedText(targetText.substring(0, currentIndex + 1));
        // Typewriter haptic feedback - light vibration for each character
        OnboardingHaptics.typewriter();
        currentIndex++;
      } else {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        setIsTyping(false);
      }
    }, 35);

    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      setIsTyping(false);
    };
  }, [selectedLevel]);

  const animateLevelChange = useCallback(
    (newLevel: number) => {
      if (newLevel !== selectedLevelRef.current && newLevel >= 0 && newLevel <= 3) {
        OnboardingHaptics.selection();
        selectedLevelRef.current = newLevel;

        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.5,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        setSelectedLevel(newLevel);
      }
    },
    [fadeAnim]
  );

  const handleDotPress = (index: number) => {
    animateLevelChange(index);
  };

  const handleContinue = useCallback(() => {
    OnboardingHaptics.medium();
    onNext();
  }, [onNext]);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header with Progress Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '50%' }]} />
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>How comfortable are you{'\n'}writing AI prompts?</Text>

      {/* Glass Prompt Display */}
      <View style={styles.inputContainer}>
        <GlassPromptCard>
          <Text style={styles.inputText}>
            {displayedText}
            <Text style={[styles.cursor, !showCursor && styles.cursorHidden]}>|</Text>
          </Text>
        </GlassPromptCard>
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Level Label */}
      <Animated.View style={[styles.levelLabelContainer, { opacity: fadeAnim }]}>
        <Text style={styles.levelLabel}>{PROMPT_LEVELS[selectedLevel].label}</Text>
        <Text style={styles.levelSubtitle}>{PROMPT_LEVELS[selectedLevel].subtitle}</Text>
      </Animated.View>

      {/* Dot Slider - 4 individual pill buttons */}
      <View style={styles.sliderContainer}>
        <View style={styles.sliderTrack}>
          {PROMPT_LEVELS.map((level, index) => {
            const isSelected = selectedLevel === index;
            return (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.dotButton,
                  index === 0 && styles.dotButtonFirst,
                  index === 3 && styles.dotButtonLast,
                ]}
                onPress={() => handleDotPress(index)}
                activeOpacity={0.7}>
                <View style={[styles.dotInner, isSelected && styles.dotInnerSelected]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Labels below slider */}
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabelText}>New</Text>
          <Text style={styles.sliderLabelText}>Expert</Text>
        </View>
      </View>

      {/* Continue Button - Glass */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <GlassContinueButton onPress={handleContinue} />
      </View>
    </View>
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
    marginBottom: 48,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  inputContainer: {
    paddingHorizontal: 24,
  },
  inputText: {
    fontFamily: 'Menlo',
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  cursor: {
    color: '#FFFFFF',
    fontWeight: '300',
  },
  cursorHidden: {
    opacity: 0,
  },
  spacer: {
    flex: 1,
  },
  levelLabelContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  levelLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  levelSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  sliderContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sliderTrack: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: OnboardingColors.background.tertiary,
    borderRadius: 28,
    overflow: 'hidden',
  },
  dotButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotButtonFirst: {
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  dotButtonLast: {
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dotInnerSelected: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  sliderLabelText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen7;
