import { LinearGradient } from 'expo-linear-gradient';
import { Rocket, Clock, Brain, Star, ArrowRight, ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextShimmer } from './TextShimmer';
import { VibraCosmicBackground } from './VibraCosmicBackground';
import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface OnboardingScreen6Props {
  onGetStarted: () => void;
  onBack: () => void;
}

// Animated countdown component
const CountdownTimer: React.FC<{
  onComplete: () => void;
  screenHeight: number;
  screenWidth: number;
}> = ({ onComplete, screenHeight, screenWidth }) => {
  const [count, setCount] = useState(3);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  useEffect(() => {
    if (count > 0) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            tension: 100,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 0,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [count]);

  if (count === 0) return null;

  return (
    <Animated.View
      style={[
        styles.countdownContainer,
        {
          top: screenHeight * 0.4,
          left: screenWidth * 0.5 - 40,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}>
      <LinearGradient
        colors={[VibraColors.accent.amber, VibraColors.accent.red]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.countdownCircle}>
        <Text style={styles.countdownText}>{count}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

// Fireworks animation
const Firework: React.FC<{ delay: number; screenHeight: number; screenWidth: number }> = ({
  delay,
  screenHeight,
  screenWidth,
}) => {
  const particles = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      animation: new Animated.Value(0),
      angle: i * 30 * (Math.PI / 180),
    }))
  ).current;

  useEffect(() => {
    setTimeout(() => {
      const animations = particles.map((particle) =>
        Animated.timing(particle.animation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      );

      Animated.parallel(animations).start();
    }, delay);
  }, [delay]);

  return (
    <View style={[styles.fireworkContainer, { top: screenHeight * 0.3, left: screenWidth * 0.5 }]}>
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.fireworkParticle,
            {
              transform: [
                {
                  translateX: particle.animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.cos(particle.angle) * 80],
                  }),
                },
                {
                  translateY: particle.animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sin(particle.angle) * 80],
                  }),
                },
                {
                  scale: particle.animation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 0],
                  }),
                },
              ],
              opacity: particle.animation.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 1, 0],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
};

export const OnboardingScreen6: React.FC<OnboardingScreen6Props> = ({ onGetStarted, onBack }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [showFireworks, setShowFireworks] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const titleAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(50)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Initial entrance animations
    Animated.sequence([
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(contentAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(buttonAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Logo rotation animation
    Animated.loop(
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation for call to action
    setTimeout(() => {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    }, 2000);
  }, []);

  const handleGetStarted = () => {
    setShowCountdown(true);
  };

  const handleCountdownComplete = () => {
    setShowFireworks(true);
    setTimeout(() => {
      onGetStarted();
    }, 2000);
  };

  return (
    <VibraCosmicBackground>
      <StatusBar barStyle="light-content" />

      {/* Fireworks */}
      {showFireworks && (
        <>
          <Firework delay={0} screenHeight={height} screenWidth={width} />
          <Firework delay={300} screenHeight={height} screenWidth={width} />
          <Firework delay={600} screenHeight={height} screenWidth={width} />
        </>
      )}

      {/* Countdown */}
      {showCountdown && (
        <CountdownTimer
          onComplete={handleCountdownComplete}
          screenHeight={height}
          screenWidth={width}
        />
      )}

      <View style={[styles.container, { paddingTop: insets.top + VibraSpacing.lg }]}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Rotating Logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: titleAnim,
                transform: [
                  {
                    rotate: logoRotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}>
            <LinearGradient
              colors={[VibraColors.accent.purple, VibraColors.accent.blue, VibraColors.accent.teal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}>
              <Rocket size={48} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          {/* Title */}
          <Animated.View style={[styles.titleContainer, { opacity: titleAnim }]}>
            <TextShimmer style={styles.mainTitle} duration={3000}>
              You're All Set!
            </TextShimmer>
            <Text style={styles.subtitle}>Time to turn your wildest app ideas into reality</Text>
          </Animated.View>
        </View>

        {/* Content Section */}
        <Animated.View
          style={[styles.contentSection, { transform: [{ translateY: contentAnim }] }]}>
          {/* Motivation Cards */}
          <View style={styles.motivationCards}>
            <View style={styles.motivationCard}>
              <LinearGradient
                colors={[VibraColors.accent.teal, VibraColors.accent.emerald]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.motivationGradient}>
                <Clock size={22} color="#FFFFFF" />
                <Text style={styles.motivationTitle}>Lightning Fast</Text>
                <Text style={styles.motivationText}>Apps built in minutes</Text>
              </LinearGradient>
            </View>

            <View style={styles.motivationCard}>
              <LinearGradient
                colors={[VibraColors.accent.purple, VibraColors.accent.indigo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.motivationGradient}>
                <Brain size={22} color="#FFFFFF" />
                <Text style={styles.motivationTitle}>AI-Powered</Text>
                <Text style={styles.motivationText}>Smart code gen</Text>
              </LinearGradient>
            </View>

            <View style={styles.motivationCard}>
              <LinearGradient
                colors={[VibraColors.accent.amber, VibraColors.accent.red]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.motivationGradient}>
                <Star size={22} color="#FFFFFF" />
                <Text style={styles.motivationTitle}>Production Ready</Text>
                <Text style={styles.motivationText}>Deploy to stores</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Final Message */}
          <View style={styles.finalMessage}>
            <Text style={styles.messageTitle}>Your journey starts now! 🚀</Text>
            <Text style={styles.messageText}>
              Join thousands of developers who've built incredible apps. What will you create first?
            </Text>
          </View>
        </Animated.View>

        {/* CTA Section */}
        <Animated.View
          style={[
            styles.ctaSection,
            {
              opacity: buttonAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handleGetStarted}
            activeOpacity={0.9}>
            <LinearGradient
              colors={[VibraColors.accent.purple, VibraColors.accent.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}>
              <Text style={styles.buttonText}>Start Building My App!</Text>
              <ArrowRight size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerText}>Ready? Let's make some magic happen! ✨</Text>
        </Animated.View>

        {/* Navigation */}
        <View
          style={[styles.navigation, { paddingBottom: Math.max(insets.bottom, VibraSpacing.md) }]}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <ChevronLeft size={20} color={VibraColors.neutral.textSecondary} />
          </TouchableOpacity>

          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <View style={styles.skipContainer}>
            <Text style={styles.skipText}>Final step!</Text>
          </View>
        </View>
      </View>
    </VibraCosmicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Fireworks
  fireworkContainer: {
    position: 'absolute',
    zIndex: 10,
  },

  fireworkParticle: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: VibraColors.accent.amber,
    borderRadius: 2,
  },

  // Countdown
  countdownContainer: {
    position: 'absolute',
    zIndex: 10,
  },

  countdownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  countdownText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingTop: VibraSpacing['2xl'],
    paddingBottom: VibraSpacing.xl,
  },

  logoContainer: {
    marginBottom: VibraSpacing.xl,
  },

  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: VibraColors.accent.purple,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },

  titleContainer: {
    alignItems: 'center',
  },

  mainTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: VibraSpacing.sm,
    textShadowColor: 'rgba(139, 92, 246, 0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },

  subtitle: {
    fontSize: 16,
    color: VibraColors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: VibraSpacing.xl,
  },

  // Content Section
  contentSection: {
    flex: 1,
    paddingHorizontal: VibraSpacing.lg,
  },

  motivationCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: VibraSpacing.xl,
    gap: VibraSpacing.sm,
  },

  motivationCard: {
    flex: 1,
    borderRadius: VibraBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  motivationGradient: {
    padding: VibraSpacing.md,
    alignItems: 'center',
    minHeight: 100,
  },

  motivationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: VibraSpacing.sm,
    marginBottom: 2,
    textAlign: 'center',
  },

  motivationText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 14,
  },

  // Final Message
  finalMessage: {
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.lg,
    marginBottom: VibraSpacing.xl,
  },

  messageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: VibraColors.accent.teal,
    textAlign: 'center',
    marginBottom: VibraSpacing.sm,
    letterSpacing: -0.5,
  },

  messageText: {
    fontSize: 15,
    color: VibraColors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // CTA Section
  ctaSection: {
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
    paddingBottom: VibraSpacing.lg,
  },

  getStartedButton: {
    borderRadius: VibraBorderRadius['2xl'],
    shadowColor: VibraColors.accent.purple,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: VibraSpacing.md,
  },

  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['3xl'],
    paddingVertical: VibraSpacing.lg,
    gap: VibraSpacing.sm,
    borderRadius: VibraBorderRadius['2xl'],
    minHeight: 56,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  footerText: {
    color: VibraColors.neutral.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.9,
  },

  // Navigation
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: VibraSpacing.xl,
    paddingTop: VibraSpacing.md,
    borderTopWidth: 1,
    borderTopColor: VibraColors.neutral.border,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
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
    backgroundColor: VibraColors.accent.purple,
  },

  skipContainer: {
    alignItems: 'center',
  },

  skipText: {
    color: VibraColors.accent.teal,
    fontSize: 13,
    fontWeight: '600',
  },
});
