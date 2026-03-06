import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface OnboardingScreen2Props {
  onNext: () => void;
  onBack: () => void;
}

export const OnboardingScreen2: React.FC<OnboardingScreen2Props> = ({ onNext, onBack }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Responsive breakpoints
  const isTablet = width > 768;
  const isLandscape = width > height;
  const isCompact = height < 700;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleSlide = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  // Responsive styles
  const responsiveStyles = {
    headerHeight: isLandscape
      ? height * 0.35
      : isTablet
        ? height * 0.32
        : isCompact
          ? height * 0.28
          : height * 0.35,
    titleSize: isTablet ? 36 : isCompact ? 32 : 36,
    titleLineHeight: isTablet ? 44 : isCompact ? 38 : 44,
    subtitleSize: isTablet ? 17 : isCompact ? 16 : 18,
    subtitleLineHeight: isTablet ? 24 : isCompact ? 22 : 26,
    contentPadding: isTablet ? VibraSpacing['3xl'] : VibraSpacing.xl,
    buttonWidth: isTablet ? Math.min(400, width * 0.5) : width * 0.75,
  };

  useEffect(() => {
    // Smooth entrance sequence
    Animated.sequence([
      // Title fade in
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),

      // Subtitle entrance
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(subtitleSlide, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),

      // Button entrance
      Animated.delay(200),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Back Button */}
      <View style={[styles.header, { top: insets.top + VibraSpacing.md }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ChevronLeft size={20} color={VibraColors.neutral.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Header with Cosmic Background */}
      <View style={[styles.headerSection, { height: responsiveStyles.headerHeight }]}>
        <ImageBackground
          source={{ uri: 'https://i.imgur.com/aUVBWTd.png' }}
          style={styles.cosmicOverlay}
          resizeMode="cover"
        />

        {/* Fade Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'transparent', VibraColors.neutral.background]}
          locations={[0, 0.6, 1]}
          style={styles.fadeGradient}
        />
      </View>

      {/* Main Content Area */}
      <View style={[styles.contentSection, { paddingHorizontal: responsiveStyles.contentPadding }]}>
        {/* Title */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              fontSize: responsiveStyles.titleSize,
              lineHeight: responsiveStyles.titleLineHeight,
            },
          ]}>
          See your app{'\n'}come to life{'\n'}before your eyes
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleSlide }],
              fontSize: responsiveStyles.subtitleSize,
              lineHeight: responsiveStyles.subtitleLineHeight,
            },
          ]}>
          From concept to code{'\n'}in seconds, not months
        </Animated.Text>
      </View>

      {/* CTA Section */}
      <Animated.View
        style={[
          styles.ctaSection,
          {
            opacity: buttonOpacity,
            paddingBottom: Math.max(insets.bottom, VibraSpacing.md),
          },
        ]}>
        <TouchableOpacity
          style={[styles.nextButton, { minWidth: responsiveStyles.buttonWidth }]}
          onPress={onNext}
          activeOpacity={0.9}>
          <LinearGradient
            colors={[VibraColors.neutral.text, VibraColors.neutral.textSecondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}>
            <Text style={styles.buttonText}>Try It Now</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VibraColors.neutral.background,
  },

  // Header Section with Cosmic Background
  headerSection: {
    position: 'relative',
    overflow: 'hidden',
  },

  // Cosmic Landscape Overlay
  cosmicOverlay: {
    position: 'absolute',
    top: -50,
    left: 0,
    right: 0,
    bottom: -50,
    zIndex: 1,
  },

  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },

  // Content Section - uses flex to prevent overlap
  contentSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Typography
  title: {
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: VibraSpacing.xl,
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  subtitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    opacity: 0.85,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // CTA Section - no longer absolute positioned
  ctaSection: {
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
    paddingTop: VibraSpacing.lg,
  },

  nextButton: {
    borderRadius: VibraBorderRadius['2xl'],
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },

  buttonGradient: {
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    borderRadius: VibraBorderRadius['2xl'],
    alignItems: 'center',
  },

  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.3,
  },

  // Progress Dots
  progressContainer: {
    alignItems: 'center',
    marginTop: VibraSpacing.xl,
  },

  dots: {
    flexDirection: 'row',
    gap: VibraSpacing.sm,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VibraColors.neutral.border,
  },

  dotActive: {
    backgroundColor: VibraColors.neutral.text,
    width: 24,
  },

  // Header and Back Button
  header: {
    position: 'absolute',
    left: VibraSpacing.lg,
    zIndex: 10,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
});

export default OnboardingScreen2;
