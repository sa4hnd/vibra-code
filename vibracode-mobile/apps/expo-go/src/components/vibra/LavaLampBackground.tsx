import { BlurView } from 'expo-blur';
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// Vibra Code gradient colors - warm orange/yellow to green
const VIBRACODE_COLORS = [
  '#FF8C00', // Orange
  '#FFB800', // Amber/Yellow
  '#FFCC00', // Bright Yellow
  '#8BC34A', // Light Green
  '#7CB342', // Green
  '#689F38', // Darker Green
];

interface LavaLampBackgroundProps {
  children?: React.ReactNode;
  intensity?: number;
}

interface BlobData {
  id: number;
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  duration: number;
}

const AnimatedBlob: React.FC<{
  blob: BlobData;
  screenWidth: number;
  screenHeight: number;
}> = ({ blob, screenWidth, screenHeight }) => {
  const translateX = useSharedValue(blob.initialX);
  const translateY = useSharedValue(blob.initialY);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Very slow, smooth movement patterns
    const rangeX = screenWidth * 0.3;
    const rangeY = screenHeight * 0.25;

    const randomX1 = blob.initialX + (Math.random() - 0.5) * rangeX;
    const randomX2 = blob.initialX + (Math.random() - 0.5) * rangeX;
    const randomY1 = blob.initialY + (Math.random() - 0.5) * rangeY;
    const randomY2 = blob.initialY + (Math.random() - 0.5) * rangeY;

    // Very slow timing - 25-40 seconds per cycle
    const duration = blob.duration;

    translateX.value = withRepeat(
      withSequence(
        withTiming(randomX1, { duration: duration * 0.4, easing: Easing.inOut(Easing.sin) }),
        withTiming(randomX2, { duration: duration * 0.3, easing: Easing.inOut(Easing.sin) }),
        withTiming(blob.initialX, { duration: duration * 0.3, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(randomY1, { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) }),
        withTiming(randomY2, { duration: duration * 0.25, easing: Easing.inOut(Easing.sin) }),
        withTiming(blob.initialY, { duration: duration * 0.25, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    // Very subtle scale breathing
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.9, { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.blob,
        {
          width: blob.size,
          height: blob.size,
          borderRadius: blob.size / 2,
          backgroundColor: blob.color,
        },
        animatedStyle,
      ]}
    />
  );
};

export const LavaLampBackground: React.FC<LavaLampBackgroundProps> = ({
  children,
  intensity = 100,
}) => {
  const { width, height } = useWindowDimensions();

  // Generate large blob data - fewer but much bigger blobs
  const blobs = useMemo<BlobData[]>(() => {
    return [
      // Large orange/yellow blobs at top
      {
        id: 1,
        color: VIBRACODE_COLORS[0],
        size: 400,
        initialX: -100,
        initialY: height * 0.5,
        duration: 30000,
      },
      {
        id: 2,
        color: VIBRACODE_COLORS[1],
        size: 350,
        initialX: width * 0.3,
        initialY: height * 0.6,
        duration: 35000,
      },
      {
        id: 3,
        color: VIBRACODE_COLORS[2],
        size: 300,
        initialX: width * 0.6,
        initialY: height * 0.55,
        duration: 28000,
      },
      // Large green blobs at bottom
      {
        id: 4,
        color: VIBRACODE_COLORS[3],
        size: 450,
        initialX: width * 0.2,
        initialY: height * 0.75,
        duration: 32000,
      },
      {
        id: 5,
        color: VIBRACODE_COLORS[4],
        size: 380,
        initialX: width * 0.7,
        initialY: height * 0.8,
        duration: 38000,
      },
      {
        id: 6,
        color: VIBRACODE_COLORS[5],
        size: 320,
        initialX: width - 50,
        initialY: height * 0.65,
        duration: 26000,
      },
    ];
  }, [width, height]);

  return (
    <View style={styles.container}>
      {/* Dark base */}
      <View style={[styles.base, { backgroundColor: '#0a0a0a' }]} />

      {/* Animated blobs layer */}
      <View style={styles.blobsContainer}>
        {blobs.map((blob) => (
          <AnimatedBlob key={blob.id} blob={blob} screenWidth={width} screenHeight={height} />
        ))}
      </View>

      {/* Heavy blur overlay - makes blobs merge and look like gradients */}
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
  },
  blobsContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  blob: {
    position: 'absolute',
    opacity: 0.8,
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
});

export default LavaLampBackground;
