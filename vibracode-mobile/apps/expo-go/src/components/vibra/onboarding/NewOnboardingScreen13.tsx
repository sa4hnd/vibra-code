import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  StatusBar,
  Keyboard,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassContinueButton, GlassInputContainer } from './OnboardingComponents';
import { OnboardingColors, OnboardingHaptics, OnboardingAnimations } from './OnboardingConstants';

interface NewOnboardingScreen13Props {
  onNext: (appName: string) => void;
  onBack: () => void;
  sessionId?: string;
  prompt?: string;
}

export const NewOnboardingScreen13: React.FC<NewOnboardingScreen13Props> = ({
  onNext,
  onBack,
  sessionId,
  prompt,
}) => {
  const insets = useSafeAreaInsets();
  const [appName, setAppName] = useState('');
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  const handleContinue = useCallback(() => {
    if (appName.trim()) {
      OnboardingHaptics.medium();
      Keyboard.dismiss();
      onNext(appName.trim());
    }
  }, [appName, onNext]);

  // Don't auto-advance on keyboard return - just dismiss the keyboard
  const handleKeyboardSubmit = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

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

  const isButtonEnabled = appName.trim().length > 0;

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header with Progress Bar */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <GlassBackButton onPress={onBack} />

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: '87%' }]} />
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>Now, give your app{'\n'}a name</Text>

          {/* App Name Input */}
          <TextInput
            style={styles.textInput}
            placeholder="My Awesome App"
            placeholderTextColor={OnboardingColors.text.placeholder}
            value={appName}
            onChangeText={setAppName}
            autoFocus={false}
            maxLength={50}
            textAlign="center"
            returnKeyType="done"
            onSubmitEditing={handleKeyboardSubmit}
          />
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Continue Button - Glass */}
        <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <GlassContinueButton onPress={handleContinue} disabled={!isButtonEnabled} />
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
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
  content: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 42,
    marginBottom: 48,
  },
  textInput: {
    fontSize: 24,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
  },
  spacer: {
    flex: 1,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen13;
