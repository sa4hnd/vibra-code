import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as StoreReview from 'expo-store-review';
import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { GlassBackButton, GlassContinueButton } from './OnboardingComponents';
import { OnboardingColors, OnboardingHaptics, OnboardingAnimations } from './OnboardingConstants';

interface NewOnboardingScreen14Props {
  onComplete: () => void;
  onBack: () => void;
}

// Star Icon Component with animation support
const StarIcon = ({ size = 56, delay = 0 }: { size?: number; delay?: number }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-20deg', '0deg'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={OnboardingColors.accent.warning}
        />
      </Svg>
    </Animated.View>
  );
};

export const NewOnboardingScreen14: React.FC<NewOnboardingScreen14Props> = ({
  onComplete,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const notNowScaleAnim = useRef(new Animated.Value(1)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentFadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleNotNow = useCallback(() => {
    OnboardingHaptics.light();
    onComplete();
  }, [onComplete]);

  const handleLeaveRating = useCallback(async () => {
    OnboardingHaptics.medium();

    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      }
    } catch (error) {
      console.error('Error requesting store review:', error);
    }

    onComplete();
  }, [onComplete]);

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

  const handleNotNowPressIn = useCallback(() => {
    Animated.timing(notNowScaleAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [notNowScaleAnim]);

  const handleNotNowPressOut = useCallback(() => {
    Animated.timing(notNowScaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [notNowScaleAnim]);

  // Glass card content
  const cardContent = (
    <View style={styles.glassCardContent}>
      {/* Stars */}
      <View style={styles.starsContainer}>
        {[0, 1, 2, 3, 4].map((index) => (
          <StarIcon key={index} size={44} delay={index * 80} />
        ))}
      </View>

      {/* Title */}
      <Text style={styles.title}>Enjoying Vibracode?</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Your feedback helps us improve!{'\n'}Leave a quick rating.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Back Button */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />
      </View>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: contentFadeAnim }]}>
        {/* Glass Card */}
        {useGlass ? (
          <GlassView style={styles.glassCard}>{cardContent}</GlassView>
        ) : (
          <View style={styles.blurCardContainer}>
            <BlurView intensity={40} tint="dark" style={styles.blurCard}>
              {cardContent}
            </BlurView>
          </View>
        )}
      </Animated.View>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        {/* Not Now Button */}
        <Animated.View style={{ transform: [{ scale: notNowScaleAnim }] }}>
          <TouchableOpacity
            style={styles.notNowButton}
            onPress={handleNotNow}
            onPressIn={handleNotNowPressIn}
            onPressOut={handleNotNowPressOut}
            activeOpacity={1}>
            <Text style={styles.notNowButtonText}>Not now</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Leave a Rating Button - Glass */}
        <GlassContinueButton title="Leave a rating" onPress={handleLeaveRating} />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  glassCard: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  blurCardContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 340,
  },
  blurCard: {
    padding: 32,
    alignItems: 'center',
    borderRadius: 28,
  },
  glassCardContent: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: OnboardingColors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  notNowButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  notNowButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: OnboardingColors.text.tertiary,
  },
});

export default NewOnboardingScreen14;
