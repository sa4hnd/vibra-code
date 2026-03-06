import { LinearGradient } from 'expo-linear-gradient';
import {
  Zap,
  Eye,
  MessageCircle,
  Rocket,
  ChevronRight,
  Star,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextShimmer } from './TextShimmer';
import { VibraCosmicBackground } from './VibraCosmicBackground';
import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface OnboardingScreen5Props {
  onNext: () => void;
  onBack: () => void;
}

interface Feature {
  id: number;
  title: string;
  description: string;
  icon: string;
  gradient: string[];
  benefits: string[];
  highlight: string;
}

const features: Feature[] = [
  {
    id: 1,
    title: 'AI-Powered Development',
    description: 'Just describe your app in plain English and watch VibraCoder build it for you',
    icon: 'zap',
    gradient: [VibraColors.accent.purple, VibraColors.accent.indigo],
    benefits: ['Natural language input', 'Intelligent code generation', 'Auto bug fixes'],
    highlight: 'No coding required!',
  },
  {
    id: 2,
    title: 'Real-Time Preview',
    description: 'See your app come to life instantly with live preview in Expo Go',
    icon: 'eye',
    gradient: [VibraColors.accent.teal, VibraColors.accent.emerald],
    benefits: ['Instant previews', 'Live updates', 'Cross-platform testing'],
    highlight: 'Test on any device',
  },
  {
    id: 3,
    title: 'Smart Conversations',
    description: 'VibraCoder understands context and learns from your preferences',
    icon: 'message-circle',
    gradient: [VibraColors.accent.blue, VibraColors.accent.teal],
    benefits: ['Context awareness', 'Learning preferences', 'Natural dialogue'],
    highlight: 'Gets smarter over time',
  },
  {
    id: 4,
    title: 'Production Ready',
    description: 'Apps built with modern React Native, ready for App Store deployment',
    icon: 'rocket',
    gradient: [VibraColors.accent.amber, VibraColors.accent.red],
    benefits: ['Modern React Native', 'App Store ready', 'Professional code'],
    highlight: 'Publish immediately',
  },
];

const FeatureCard: React.FC<{
  feature: Feature;
  index: number;
  isActive: boolean;
  onPress: () => void;
}> = ({ feature, index, isActive, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const delay = index * 150;
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
  }, [index]);

  useEffect(() => {
    if (isActive) {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    }
  }, [isActive]);

  return (
    <Animated.View
      style={[
        styles.featureCard,
        isActive && styles.featureCardActive,
        {
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim },
            { scale: isActive ? pulseAnim : 1 },
          ],
        },
      ]}>
      <TouchableOpacity style={styles.cardContent} onPress={onPress} activeOpacity={0.8}>
        {/* Icon */}
        <LinearGradient
          colors={feature.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featureIcon}>
          {feature.icon === 'zap' && <Zap size={32} color="#FFFFFF" />}
          {feature.icon === 'eye' && <Eye size={32} color="#FFFFFF" />}
          {feature.icon === 'message-circle' && <MessageCircle size={32} color="#FFFFFF" />}
          {feature.icon === 'rocket' && <Rocket size={32} color="#FFFFFF" />}
        </LinearGradient>

        {/* Content */}
        <View style={styles.featureContent}>
          <View style={styles.featureHeader}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            {isActive && (
              <View style={styles.highlightBadge}>
                <TextShimmer style={styles.highlightText} duration={1500}>
                  {feature.highlight}
                </TextShimmer>
              </View>
            )}
          </View>

          <Text style={styles.featureDescription}>{feature.description}</Text>

          {isActive && (
            <Animated.View style={styles.benefitsList}>
              {feature.benefits.map((benefit, idx) => (
                <View key={idx} style={styles.benefitItem}>
                  <View style={styles.benefitDot} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </Animated.View>
          )}
        </View>

        {/* Arrow */}
        <Animated.View
          style={[
            styles.arrowContainer,
            {
              transform: [
                {
                  rotate: isActive ? '90deg' : '0deg',
                },
              ],
            },
          ]}>
          <ChevronRight size={20} color={VibraColors.neutral.textSecondary} />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const FloatingParticle: React.FC<{ delay: number; screenWidth: number }> = ({
  delay,
  screenWidth,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    setTimeout(() => {
      const animate = () => {
        Animated.parallel([
          Animated.loop(
            Animated.sequence([
              Animated.timing(translateY, {
                toValue: -20,
                duration: 3000,
                useNativeDriver: true,
              }),
              Animated.timing(translateY, {
                toValue: 0,
                duration: 3000,
                useNativeDriver: true,
              }),
            ])
          ),
          Animated.loop(
            Animated.sequence([
              Animated.timing(opacity, {
                toValue: 0.6,
                duration: 1500,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0.1,
                duration: 1500,
                useNativeDriver: true,
              }),
            ])
          ),
        ]).start();
      };
      animate();
    }, delay);
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.floatingParticle,
        {
          left: Math.random() * screenWidth,
          top: 100 + Math.random() * 300,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    />
  );
};

export const OnboardingScreen5: React.FC<OnboardingScreen5Props> = ({ onNext, onBack }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [activeFeature, setActiveFeature] = useState<number | null>(null);
  const titleAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.spring(ctaAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, 2000);
  }, []);

  const handleFeaturePress = (featureId: number) => {
    setActiveFeature(activeFeature === featureId ? null : featureId);
  };

  return (
    <VibraCosmicBackground>
      <StatusBar barStyle="light-content" />

      {/* Floating Particles */}
      {Array.from({ length: 8 }).map((_, i) => (
        <FloatingParticle key={i} delay={i * 500} screenWidth={width} />
      ))}

      <View style={[styles.container, { paddingTop: insets.top + VibraSpacing.lg }]}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: titleAnim }]}>
          <Text style={styles.title}>Why Developers Love Us</Text>
          <Text style={styles.subtitle}>
            Powerful features that make app development effortless
          </Text>
        </Animated.View>

        {/* Features List */}
        <ScrollView
          style={styles.featuresContainer}
          contentContainerStyle={styles.featuresContent}
          showsVerticalScrollIndicator={false}>
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              index={index}
              isActive={activeFeature === feature.id}
              onPress={() => handleFeaturePress(feature.id)}
            />
          ))}

          {/* Bottom CTA */}
          <Animated.View style={[styles.bottomCTA, { transform: [{ translateY: ctaAnim }] }]}>
            <LinearGradient
              colors={[VibraColors.accent.purple, VibraColors.accent.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}>
              <Star size={24} color="#FFFFFF" />
              <Text style={styles.ctaTitle}>Ready to Build?</Text>
              <Text style={styles.ctaDescription}>
                Join thousands of developers who've already built amazing apps with VibraCode
              </Text>
              <View style={styles.ctaStats}>
                <View style={styles.ctaStat}>
                  <Text style={styles.ctaStatNumber}>4.9</Text>
                  <Text style={styles.ctaStatLabel}>★ Rating</Text>
                </View>
                <View style={styles.ctaStatDivider} />
                <View style={styles.ctaStat}>
                  <Text style={styles.ctaStatNumber}>50K+</Text>
                  <Text style={styles.ctaStatLabel}>Apps Built</Text>
                </View>
                <View style={styles.ctaStatDivider} />
                <View style={styles.ctaStat}>
                  <Text style={styles.ctaStatNumber}>2min</Text>
                  <Text style={styles.ctaStatLabel}>Avg Build</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </ScrollView>

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
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <TouchableOpacity style={styles.nextButton} onPress={onNext}>
            <Text style={styles.nextButtonText}>Let's Start!</Text>
            <ArrowRight size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </VibraCosmicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Floating Particles
  floatingParticle: {
    position: 'absolute',
    width: 3,
    height: 3,
    backgroundColor: VibraColors.accent.purple,
    borderRadius: 2,
    zIndex: 1,
  },

  // Header
  header: {
    paddingHorizontal: VibraSpacing.xl,
    paddingBottom: VibraSpacing.lg,
    alignItems: 'center',
    zIndex: 2,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: VibraSpacing.sm,
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 15,
    color: VibraColors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Features
  featuresContainer: {
    flex: 1,
    paddingHorizontal: VibraSpacing.lg,
    zIndex: 2,
  },

  featuresContent: {
    paddingBottom: VibraSpacing['3xl'],
  },

  featureCard: {
    marginBottom: VibraSpacing.md,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: VibraBorderRadius.xl,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  featureCardActive: {
    borderColor: VibraColors.accent.purple,
    shadowColor: VibraColors.accent.purple,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },

  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: VibraSpacing.md,
  },

  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: VibraBorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.md,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  featureContent: {
    flex: 1,
  },

  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VibraSpacing.xs,
  },

  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: VibraColors.neutral.text,
    flex: 1,
    letterSpacing: -0.3,
  },

  highlightBadge: {
    backgroundColor: VibraColors.accent.purple,
    paddingHorizontal: VibraSpacing.sm,
    paddingVertical: 2,
    borderRadius: VibraBorderRadius.lg,
    marginLeft: VibraSpacing.sm,
  },

  highlightText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  featureDescription: {
    fontSize: 14,
    color: VibraColors.neutral.textSecondary,
    lineHeight: 20,
    marginBottom: VibraSpacing.sm,
  },

  benefitsList: {
    gap: VibraSpacing.xs,
  },

  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  benefitDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: VibraColors.accent.teal,
    marginRight: VibraSpacing.sm,
  },

  benefitText: {
    fontSize: 13,
    color: VibraColors.neutral.text,
    fontWeight: '500',
  },

  arrowContainer: {
    marginLeft: VibraSpacing.sm,
    alignSelf: 'flex-start',
    marginTop: VibraSpacing.xs,
  },

  // Bottom CTA
  bottomCTA: {
    marginTop: VibraSpacing.lg,
    borderRadius: VibraBorderRadius.xl,
    overflow: 'hidden',
    shadowColor: VibraColors.accent.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  ctaGradient: {
    alignItems: 'center',
    padding: VibraSpacing.xl,
  },

  ctaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: VibraSpacing.sm,
    marginBottom: VibraSpacing.xs,
  },

  ctaDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: VibraSpacing.lg,
  },

  ctaStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },

  ctaStat: {
    alignItems: 'center',
  },

  ctaStatNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },

  ctaStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },

  ctaStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
    zIndex: 2,
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

  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VibraColors.accent.purple,
    paddingHorizontal: VibraSpacing.lg,
    paddingVertical: VibraSpacing.sm,
    borderRadius: VibraBorderRadius.lg,
    gap: VibraSpacing.sm,
  },

  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
