import { Canvas, Line, vec, Group, LinearGradient, Rect } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  Animated,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassContinueButton } from './OnboardingComponents';
import { NATIVE_ONBOARDING_ASSETS } from './OnboardingAssets';

interface NewOnboardingScreen11Props {
  onNext: () => void;
  onBack: () => void;
}

// Green Gradient Background using Skia
const GreenGradientBackground = React.memo(
  ({ width, height }: { width: number; height: number }) => {
    return (
      <Canvas style={StyleSheet.absoluteFillObject}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(width / 2, 0)}
            end={vec(width / 2, height)}
            colors={['#1a472a', '#2d5a3d', '#1a472a', '#0d2818']}
            positions={[0, 0.3, 0.7, 1]}
          />
        </Rect>
      </Canvas>
    );
  }
);

// Grid Background with radial fade from center
const GridBackground = React.memo(
  ({ width, height, centerY }: { width: number; height: number; centerY: number }) => {
    const gridColor = '#3d7a52';
    const gridCellSize = 38;
    const gridCols = 8;
    const gridRows = 10;

    const gridWidth = gridCols * gridCellSize;
    const gridHeight = gridRows * gridCellSize;
    const startX = (width - gridWidth) / 2;
    const startY = centerY - gridHeight / 2;

    const gridCenterX = width / 2;
    const gridCenterY = centerY;
    const maxDist = Math.sqrt((gridWidth / 2) ** 2 + (gridHeight / 2) ** 2);

    const segments: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];

    // Vertical line segments
    for (let i = 0; i <= gridCols; i++) {
      const x = startX + i * gridCellSize;
      for (let j = 0; j < gridRows; j++) {
        const y1 = startY + j * gridCellSize;
        const y2 = startY + (j + 1) * gridCellSize;
        const midY = (y1 + y2) / 2;
        const dist = Math.sqrt((x - gridCenterX) ** 2 + (midY - gridCenterY) ** 2) / maxDist;
        const opacity = Math.max(0, 1 - dist * 1.3) * 0.4;
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
        const opacity = Math.max(0, 1 - dist * 1.3) * 0.4;
        if (opacity > 0.03) {
          segments.push({ x1, y1: y, x2, y2: y, opacity });
        }
      }
    }

    return (
      <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
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

export const NewOnboardingScreen11: React.FC<NewOnboardingScreen11Props> = ({ onNext, onBack }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Animation values
  const iconScale = useRef(new Animated.Value(0.8)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  // Calculate center Y for grid positioning
  const headerHeight = insets.top + 60;
  const bottomHeight = 120;
  const contentHeight = height - headerHeight - bottomHeight;
  const gridCenterY = headerHeight + contentHeight / 2;

  useEffect(() => {
    // Animate icon and title
    Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStartBuilding = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNext();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Green Gradient Background */}
      <GreenGradientBackground width={width} height={height} />

      {/* Grid Background */}
      <GridBackground width={width} height={height} centerY={gridCenterY} />

      {/* Back Button */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />
      </View>

      {/* Title at top */}
      <View style={[styles.titleContainer, { paddingTop: insets.top + 60 }]}>
        <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>
          All set - now{'\n'}let's build your{'\n'}first app
        </Animated.Text>
      </View>

      {/* App Icon - Centered in screen */}
      <View style={styles.iconContainer}>
        <Animated.View
          style={{
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          }}>
          <View style={styles.appIconContainer}>
            <Image source={NATIVE_ONBOARDING_ASSETS.state2} style={styles.appIconImage} resizeMode="contain" />
          </View>
        </Animated.View>
      </View>

      {/* Start Building Button - Glass */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <GlassContinueButton title="Start building" onPress={handleStartBuilding} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a472a',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 16,
  },
  titleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  appIconContainer: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
  },
  appIconImage: {
    width: 240,
    height: 240,
    borderRadius: 52,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default NewOnboardingScreen11;
