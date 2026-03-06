import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, Extrapolation } from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassContinueButton } from './OnboardingComponents';
import { OnboardingColors, OnboardingHaptics } from './OnboardingConstants';

interface NewOnboardingScreen8Props {
  onNext: () => void;
  onBack: () => void;
}

// Experience level cards data
const EXPERIENCE_CARDS = [
  {
    id: 'beginner',
    emoji: '👶',
    title: 'Beginner',
    subtitle: 'Just starting out\nwith app development',
  },
  {
    id: 'curious',
    emoji: '🤔',
    title: 'Curious explorer',
    subtitle: "Learning about apps\nbut haven't built one yet",
  },
  {
    id: 'seasoned',
    emoji: '👩‍💻',
    title: 'Seasoned coder',
    subtitle: 'Have built apps\nusing code',
  },
  {
    id: 'nocoder',
    emoji: '🧩',
    title: 'No-coder',
    subtitle: 'Built apps using\nno-code tools',
  },
  {
    id: 'designer',
    emoji: '🎨',
    title: 'Designer',
    subtitle: 'Focus on UI/UX\nbut want to build',
  },
  {
    id: 'entrepreneur',
    emoji: '🚀',
    title: 'Entrepreneur',
    subtitle: 'Have ideas but need\nhelp building them',
  },
];

interface CardItemProps {
  item: (typeof EXPERIENCE_CARDS)[0];
  index: number;
  animationValue: Animated.SharedValue<number>;
}

const CardItem: React.FC<CardItemProps> = ({ item, animationValue }) => {
  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      animationValue.value,
      [-1, 0, 1],
      [0.85, 1, 0.85],
      Extrapolation.CLAMP
    );
    const rotateZ = interpolate(animationValue.value, [-1, 0, 1], [8, 0, -8], Extrapolation.CLAMP);
    const opacity = interpolate(
      animationValue.value,
      [-1, 0, 1],
      [0.6, 1, 0.6],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }, { rotateZ: `${rotateZ}deg` }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.cardWrapper, cardStyle]}>
      <View style={styles.card}>
        {/* Emoji Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>{item.emoji}</Text>
          </View>
        </View>

        {/* Card Title */}
        <Text style={styles.cardTitle}>{item.title}</Text>

        {/* Card Subtitle */}
        <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
      </View>
    </Animated.View>
  );
};

export const NewOnboardingScreen8: React.FC<NewOnboardingScreen8Props> = ({ onNext, onBack }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isScrolling, setIsScrolling] = useState(false);

  const CARD_WIDTH = width;
  const CARD_HEIGHT = 320;

  const handleContinue = useCallback(() => {
    onNext();
  }, [onNext]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header with Progress Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '50%' }]} />
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>What's your experience{'\n'}building apps so far?</Text>

      {/* Card Carousel */}
      <View style={styles.carouselContainer}>
        <Carousel
          data={EXPERIENCE_CARDS}
          renderItem={({ item, index, animationValue }) => (
            <CardItem item={item} index={index} animationValue={animationValue} />
          )}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          style={{
            width,
            justifyContent: 'center',
          }}
          loop
          mode="parallax"
          modeConfig={{
            parallaxScrollingScale: 0.9,
            parallaxScrollingOffset: 160,
            parallaxAdjacentItemScale: 0.85,
          }}
          onScrollStart={() => {
            setIsScrolling(true);
          }}
          onScrollEnd={() => {
            setIsScrolling(false);
            OnboardingHaptics.light();
          }}
        />
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
    marginBottom: 40,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 260,
    backgroundColor: OnboardingColors.background.secondary,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#B8E6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarEmoji: {
    fontSize: 44,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen8;
