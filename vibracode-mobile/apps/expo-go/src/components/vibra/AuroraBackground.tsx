import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface AuroraBackgroundProps {
  colorStops?: [string, string, string];
  speed?: number;
  children?: React.ReactNode;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  colorStops = ['#3A29FF', '#FF94B4', '#FF3232'],
  speed = 0.5,
  children,
}) => {
  const { width, height } = useWindowDimensions();

  // Animation values
  const progress = useSharedValue(0);
  const blob1Y = useSharedValue(0.3);
  const blob2Y = useSharedValue(0.6);

  useEffect(() => {
    // Color cycling animation
    progress.value = withRepeat(
      withTiming(1, { duration: 8000 / speed, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    // Blob movement
    blob1Y.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 6000 / speed, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 6000 / speed, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    blob2Y.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 7000 / speed, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.7, { duration: 7000 / speed, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [speed]);

  const gradientStyle = useAnimatedStyle(() => ({
    opacity: 0.9,
  }));

  const blob1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: blob1Y.value * height - height * 0.3 }, { scale: 1.2 }],
    opacity: 0.6,
  }));

  const blob2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: blob2Y.value * height - height * 0.5 }, { scale: 1.4 }],
    opacity: 0.5,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Base dark background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a0a' }]} />

      {/* Main gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, gradientStyle]}>
        <LinearGradient
          colors={[colorStops[0], colorStops[1], colorStops[2], '#0a0a0a']}
          locations={[0, 0.3, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Animated blob 1 */}
      <Animated.View style={[styles.blob, blob1Style]}>
        <LinearGradient
          colors={[colorStops[0], 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.blobGradient}
        />
      </Animated.View>

      {/* Animated blob 2 */}
      <Animated.View style={[styles.blob2, blob2Style]}>
        <LinearGradient
          colors={[colorStops[1], 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.blobGradient}
        />
      </Animated.View>

      {/* Content */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    top: 0,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    overflow: 'hidden',
  },
  blob2: {
    position: 'absolute',
    top: 0,
    right: -100,
    width: 500,
    height: 500,
    borderRadius: 250,
    overflow: 'hidden',
  },
  blobGradient: {
    flex: 1,
  },
});

export default AuroraBackground;
