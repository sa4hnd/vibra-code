import { User, Users, Globe } from 'lucide-react-native';
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassOptionCard, GlassContinueButton } from './OnboardingComponents';
import { OnboardingColors } from './OnboardingConstants';

interface NewOnboardingScreen2Props {
  onNext: () => void;
  onBack: () => void;
}

const AUDIENCE_OPTIONS = [
  {
    id: 'just_me',
    label: 'Just me',
    subtitle: 'A personal tool',
    icon: User,
  },
  {
    id: 'small_circle',
    label: 'A small circle',
    subtitle: 'Friends, family, or a group',
    icon: Users,
  },
  {
    id: 'anyone',
    label: 'Anyone who needs it',
    subtitle: 'Release to the world',
    icon: Globe,
  },
];

export const NewOnboardingScreen2: React.FC<NewOnboardingScreen2Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedOption(id);
  };

  const handleContinue = useCallback(() => {
    if (selectedOption) {
      onNext();
    }
  }, [selectedOption, onNext]);

  const isButtonEnabled = selectedOption !== null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header with Progress Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '28%' }]} />
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>Who do you want to build apps for?</Text>

      {/* Options - Glass Cards */}
      <View style={styles.optionsContainer}>
        {AUDIENCE_OPTIONS.map((option) => {
          const IconComponent = option.icon;
          const isSelected = selectedOption === option.id;

          return (
            <GlassOptionCard
              key={option.id}
              label={option.label}
              subtitle={option.subtitle}
              icon={<IconComponent size={22} color={OnboardingColors.accent.primary} />}
              selected={isSelected}
              onSelect={() => handleSelect(option.id)}
              style={styles.optionCard}
            />
          );
        })}
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Continue Button - Glass */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <GlassContinueButton onPress={handleContinue} disabled={!isButtonEnabled} />
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
    marginBottom: 32,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  optionsContainer: {
    paddingHorizontal: 24,
  },
  optionCard: {
    marginBottom: 12,
  },
  spacer: {
    flex: 1,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen2;
