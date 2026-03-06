import {
  Canvas,
  Line,
  vec,
  Group,
  Rect,
  LinearGradient,
  Mask,
  RoundedRect,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Animated,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassContinueButton } from './OnboardingComponents';
import { NATIVE_ONBOARDING_ASSETS } from './OnboardingAssets';

interface NewOnboardingScreen4Props {
  onNext: () => void;
  onBack: () => void;
}

const SLIDER_STATES = [
  {
    id: 0,
    image: NATIVE_ONBOARDING_ASSETS.state1,
    label: "I'm looking for inspiration",
  },
  {
    id: 1,
    image: NATIVE_ONBOARDING_ASSETS.state2,
    label: 'I have a rough idea',
  },
  {
    id: 2,
    image: NATIVE_ONBOARDING_ASSETS.state3,
    label: 'I know what I want to build',
  },
];

// Grid Background using Skia - clean lines with radial fade
const GridBackground = React.memo(
  ({ width, height, centerY }: { width: number; height: number; centerY: number }) => {
    const gridColor = '#2a4a8a';
    const gridCellSize = 38; // Bigger gaps
    const gridCols = 8; // Less columns
    const gridRows = 10; // Less rows

    const gridWidth = gridCols * gridCellSize;
    const gridHeight = gridRows * gridCellSize;
    const startX = (width - gridWidth) / 2;
    const startY = centerY - gridHeight / 2;

    const gridCenterX = width / 2;
    const gridCenterY = centerY;
    const maxDist = Math.sqrt((gridWidth / 2) ** 2 + (gridHeight / 2) ** 2);

    // Generate line segments with radial fade from center
    const segments: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];

    // Vertical line segments
    for (let i = 0; i <= gridCols; i++) {
      const x = startX + i * gridCellSize;
      for (let j = 0; j < gridRows; j++) {
        const y1 = startY + j * gridCellSize;
        const y2 = startY + (j + 1) * gridCellSize;
        const midY = (y1 + y2) / 2;
        const dist = Math.sqrt((x - gridCenterX) ** 2 + (midY - gridCenterY) ** 2) / maxDist;
        const opacity = Math.max(0, 1 - dist * 1.3) * 0.55;
        if (opacity > 0.03) {
          segments.push({ x1: x, y1, x2: x, y2, opacity });
        }
      }
    }

    // Horizontal line segments
    for (let i = 0; i <= gridRows; i++) {
      const y = startY + i * gridCellSize;
      for (let j = 0; j < gridCols; j++) {
        const x1 = startX + j * gridCellSize;
        const x2 = startX + (j + 1) * gridCellSize;
        const midX = (x1 + x2) / 2;
        const dist = Math.sqrt((midX - gridCenterX) ** 2 + (y - gridCenterY) ** 2) / maxDist;
        const opacity = Math.max(0, 1 - dist * 1.3) * 0.55;
        if (opacity > 0.03) {
          segments.push({ x1, y1: y, x2, y2: y, opacity });
        }
      }
    }

    return (
      <Canvas style={[StyleSheet.absoluteFillObject]} pointerEvents="none">
        <Group>
          {segments.map((seg, index) => (
            <Line
              key={index}
              p1={vec(seg.x1, seg.y1)}
              p2={vec(seg.x2, seg.y2)}
              color={gridColor}
              style="stroke"
              strokeWidth={1}
              opacity={seg.opacity}
            />
          ))}
        </Group>
      </Canvas>
    );
  }
);

export const NewOnboardingScreen4: React.FC<NewOnboardingScreen4Props> = ({ onNext, onBack }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedState, setSelectedState] = useState(0);
  const selectedStateRef = useRef(0);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const sliderPosition = useRef(new Animated.Value(0)).current;
  const currentSliderPosition = useRef(0);
  const gestureStartPosition = useRef(0);

  // Slider dimensions
  const sliderWidth = width - 48;
  const thumbSize = 32;
  const trackPadding = 4;
  const usableWidth = sliderWidth - thumbSize - trackPadding * 2;
  const snapPoints = [0, usableWidth / 2, usableWidth];
  const snapPointsRef = useRef(snapPoints);

  // Calculate center Y for grid positioning
  const headerHeight = insets.top + 80;
  const bottomHeight = 220;
  const contentHeight = height - headerHeight - bottomHeight;
  const gridCenterY = headerHeight + contentHeight / 2;

  // Update slider position when state changes
  useEffect(() => {
    selectedStateRef.current = selectedState;
    const targetPosition = snapPoints[selectedState];
    currentSliderPosition.current = targetPosition;
    Animated.spring(sliderPosition, {
      toValue: targetPosition,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  }, [selectedState]);

  const animateStateChange = useCallback(
    (newState: number) => {
      if (newState !== selectedState && newState >= 0 && newState <= 2) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }),
        ]).start(() => {
          setSelectedState(newState);
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
          ]).start();
        });
      }
    },
    [selectedState, fadeAnim, scaleAnim]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Capture the starting position at the moment the gesture begins
        gestureStartPosition.current = snapPointsRef.current[selectedStateRef.current];
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        const startPosition = gestureStartPosition.current;
        const newPosition = Math.max(
          0,
          Math.min(snapPointsRef.current[2], startPosition + gestureState.dx)
        );
        sliderPosition.setValue(newPosition);
      },
      onPanResponderRelease: (_, gestureState) => {
        const startPosition = gestureStartPosition.current;
        const currentPosition = startPosition + gestureState.dx;
        const snaps = snapPointsRef.current;
        let closestIndex = 0;
        let minDistance = Infinity;
        snaps.forEach((point, index) => {
          const distance = Math.abs(currentPosition - point);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        });

        if (closestIndex !== selectedStateRef.current) {
          animateStateChange(closestIndex);
        } else {
          Animated.spring(sliderPosition, {
            toValue: snaps[selectedStateRef.current],
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const handleDotPress = (index: number) => {
    animateStateChange(index);
  };

  const handleContinuePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onNext();
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Grid Background - Skia */}
      <GridBackground width={width} height={height} centerY={gridCenterY} />

      {/* Header with Progress Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '42%' }]} />
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>How far along is your{'\n'}app idea?</Text>

      {/* Image Container */}
      <View style={styles.imageContainer}>
        <Animated.View
          style={[
            styles.imageWrapper,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}>
          <Image
            source={SLIDER_STATES[selectedState].image}
            style={styles.stateImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Label */}
      <Animated.Text style={[styles.stateLabel, { opacity: fadeAnim }]}>
        {SLIDER_STATES[selectedState].label}
      </Animated.Text>

      {/* Custom Draggable Slider */}
      <View style={styles.sliderContainer}>
        <View style={[styles.sliderTrack, { width: sliderWidth }]}>
          {SLIDER_STATES.map((state, index) => (
            <TouchableOpacity
              key={state.id}
              style={[
                styles.sliderDot,
                {
                  left: trackPadding + snapPoints[index] + thumbSize / 2 - 5,
                },
                selectedState === index && styles.sliderDotHidden,
              ]}
              onPress={() => handleDotPress(index)}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            />
          ))}

          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.sliderThumb,
              {
                left: Animated.add(sliderPosition, trackPadding),
              },
            ]}
          />
        </View>

        <View style={[styles.sliderLabels, { width: sliderWidth }]}>
          <Text style={styles.sliderLabelText}>Need inspiration</Text>
          <Text style={styles.sliderLabelText}>Know what to build</Text>
        </View>
      </View>

      {/* Continue Button - Glass */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <GlassContinueButton onPress={handleContinuePress} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f', // Dark charcoal like VibCode, not pure black
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
    backgroundColor: '#333333',
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 24,
    marginTop: 8,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateImage: {
    width: '70%',
    height: '70%',
  },
  stateLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
  },
  sliderContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sliderTrack: {
    height: 40,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555555',
  },
  sliderDotHidden: {
    opacity: 0,
  },
  sliderThumb: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 8,
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

export default NewOnboardingScreen4;
