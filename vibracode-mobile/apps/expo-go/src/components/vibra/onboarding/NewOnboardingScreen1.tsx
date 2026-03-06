import {
  User,
  Users,
  Monitor,
  Heart,
  Sparkles,
  DollarSign,
  MessageCircle,
} from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassOptionCard, GlassContinueButton } from './OnboardingComponents';
import { OnboardingColors } from './OnboardingConstants';

interface NewOnboardingScreen1Props {
  onNext: () => void;
  onBack: () => void;
}

const MOTIVATION_OPTIONS = [
  { id: 'personal', label: 'Solve a personal problem', icon: User },
  { id: 'others', label: 'Solve a problem for others', icon: Users },
  { id: 'showcase', label: 'Showcase my work or services', icon: Monitor },
  { id: 'social', label: 'Create social impact', icon: Heart },
  { id: 'creativity', label: 'Express creativity and have fun', icon: Sparkles },
  { id: 'income', label: 'Earn income', icon: DollarSign },
  { id: 'other', label: 'Other', icon: MessageCircle },
];

export const NewOnboardingScreen1: React.FC<NewOnboardingScreen1Props> = ({ onNext, onBack }) => {
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
            <View style={[styles.progressBarFill, { width: '14%' }]} />
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>What motivates you to build an app????</Text>

      {/* Options - Glass Cards */}
      <ScrollView
        style={styles.optionsContainer}
        contentContainerStyle={styles.optionsContent}
        showsVerticalScrollIndicator={false}>
        {MOTIVATION_OPTIONS.map((option) => {
          const IconComponent = option.icon;
          const isSelected = selectedOption === option.id;

          return (
            <GlassOptionCard
              key={option.id}
              label={option.label}
              icon={<IconComponent size={22} color={OnboardingColors.accent.primary} />}
              selected={isSelected}
              onSelect={() => handleSelect(option.id)}
              style={styles.optionCard}
            />
          );
        })}
      </ScrollView>

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
    marginBottom: 24,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  optionsContainer: {
    flex: 1,
  },
  optionsContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  optionCard: {
    marginBottom: 12,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen1;
