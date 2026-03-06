import { Canvas, Rect, Group, Blur, FractalNoise, Fill } from '@shopify/react-native-skia';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassContinueButton } from './OnboardingComponents';

// Mesh Gradient Background using Skia (matching mesh-gradient.svg portrait)
// SVG: 500x1000 portrait
const MeshGradientBackground = React.memo(
  ({ width, height }: { width: number; height: number }) => {
    // Scale factors from 500x1000 SVG
    const scaleX = width / 500;
    const scaleY = height / 1000;

    return (
      <Canvas style={StyleSheet.absoluteFillObject}>
        {/* Base blue background - fill="#0091FF" */}
        <Rect x={0} y={0} width={width} height={height} color="#0091FF" />

        {/* Blurred mesh blobs */}
        <Group>
          <Blur blur={100 * Math.min(scaleX, scaleY)} />
          {/* Deep blue #003CFF */}
          <Rect
            x={-165 * scaleX}
            y={313 * scaleY}
            width={593 * scaleX}
            height={503 * scaleY}
            color="#003CFF"
          />
          {/* Light blue #5DA6F0 */}
          <Rect
            x={141 * scaleX}
            y={-116 * scaleY}
            width={348 * scaleX}
            height={590 * scaleY}
            color="#5DA6F0"
          />
          {/* Black blob at top - gets blur effect like other mesh blobs */}
          <Rect
            x={-width * 0.3}
            y={-height * 0.4}
            width={width * 1.6}
            height={height * 0.55}
            color="#000000"
          />
          {/* Additional black blobs at corners for radial effect */}
          <Rect
            x={-width * 0.4}
            y={-height * 0.2}
            width={width * 0.5}
            height={height * 0.5}
            color="#000000"
          />
          <Rect
            x={width * 0.9}
            y={-height * 0.2}
            width={width * 0.5}
            height={height * 0.5}
            color="#000000"
          />
        </Group>

        {/* Noise grain overlay */}
        <Group blendMode="overlay" opacity={0.35}>
          <Fill>
            <FractalNoise freqX={0.6} freqY={0.6} octaves={3} />
          </Fill>
        </Group>
      </Canvas>
    );
  }
);

interface NewOnboardingScreen3Props {
  onNext: () => void;
  onBack: () => void;
}

export const NewOnboardingScreen3: React.FC<NewOnboardingScreen3Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Animations for floating cards
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Entry animations - cards slide in from sides (inversed: card1 from right, card2 from left)
  const card1SlideX = useRef(new Animated.Value(width)).current;
  const card2SlideX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Cards slide in from sides with smooth easing
    Animated.parallel([
      Animated.timing(card1SlideX, {
        toValue: 0,
        duration: 800,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(card2SlideX, {
        toValue: 0,
        duration: 800,
        delay: 100,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    ]).start();

    // Floating animation for cards (after entry)
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(card1Anim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
            useNativeDriver: true,
          }),
          Animated.timing(card1Anim, {
            toValue: 0,
            duration: 2500,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(card2Anim, {
            toValue: 1,
            duration: 3000,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
            useNativeDriver: true,
          }),
          Animated.timing(card2Anim, {
            toValue: 0,
            duration: 3000,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 800);
  }, []);

  const card1TranslateY = card1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const card2TranslateY = card2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const card1Rotate = card1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-12deg', '-8deg'],
  });

  const card2Rotate = card2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['8deg', '12deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Mesh Gradient Background with Skia */}
      <MeshGradientBackground width={width} height={height} />

      {/* Back Button */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />
      </View>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim, paddingTop: insets.top + 80 }]}>
        {/* Title */}
        <Text style={styles.title}>
          Vibra Code is the{'\n'}best place to share{'\n'}apps instantly
        </Text>

        {/* Floating Cards */}
        <View style={styles.cardsContainer}>
          {/* Card 1 - Yellow (left, tilted left) - slides from right */}
          <Animated.View
            style={[
              styles.card,
              styles.card1,
              {
                transform: [
                  { translateX: card1SlideX },
                  { translateY: card1TranslateY },
                  { rotate: card1Rotate },
                ],
              },
            ]}>
            <Text style={styles.cardEmoji}>🔗</Text>
            <Text style={styles.cardText}>
              Share instantly{'\n'}with your{'\n'}friends via{'\n'}
              <Text style={styles.cardTextBold}>Clips</Text>
            </Text>
          </Animated.View>

          {/* Card 2 - Orange (right, tilted right) - slides from left */}
          <Animated.View
            style={[
              styles.card,
              styles.card2,
              {
                transform: [
                  { translateX: card2SlideX },
                  { translateY: card2TranslateY },
                  { rotate: card2Rotate },
                ],
              },
            ]}>
            <Text style={styles.cardEmoji}>⚡</Text>
            <Text style={styles.cardText}>
              Instant updates{'\n'}— no lengthy{'\n'}App Store{'\n'}reviews
            </Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Bottom Button - Glass */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <GlassContinueButton onPress={onNext} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 38,
    marginBottom: 50,
    paddingHorizontal: 24,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: 155,
    height: 175,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  card1: {
    backgroundColor: '#FFDE59',
    marginRight: -15,
    zIndex: 2,
  },
  card2: {
    backgroundColor: '#FFB830',
    marginLeft: -15,
    marginTop: 50,
    zIndex: 1,
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 10,
  },
  cardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 21,
  },
  cardTextBold: {
    fontWeight: '700',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen3;
