import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

import { VibraColors } from '../../constants/VibraColors';

const { width, height } = Dimensions.get('window');

interface VibraCosmicBackgroundProps {
  children: React.ReactNode;
}

export const VibraCosmicBackground: React.FC<VibraCosmicBackgroundProps> = ({ children }) => {
  return (
    <View style={styles.container}>
      {/* Cosmic Grid Pattern */}
      <View style={styles.gridContainer}>
        {/* Vertical lines */}
        {Array.from({ length: Math.floor(width / 40) }).map((_, i) => (
          <View
            key={`v-${i}`}
            style={[
              styles.gridLine,
              styles.verticalLine,
              { left: i * 40, opacity: 0.03 + (i % 3) * 0.01 },
            ]}
          />
        ))}
        {/* Horizontal lines */}
        {Array.from({ length: Math.floor(height / 40) }).map((_, i) => (
          <View
            key={`h-${i}`}
            style={[
              styles.gridLine,
              styles.horizontalLine,
              { top: i * 40, opacity: 0.03 + (i % 3) * 0.01 },
            ]}
          />
        ))}
      </View>

      {/* Star Field */}
      <View style={styles.starField}>
        {Array.from({ length: 50 }).map((_, i) => (
          <View
            key={`star-${i}`}
            style={[
              styles.star,
              {
                left: Math.random() * width,
                top: Math.random() * height,
                opacity: Math.random() * 0.3 + 0.1,
                transform: [{ scale: Math.random() * 0.5 + 0.5 }],
              },
            ]}
          />
        ))}
      </View>

      {/* Main Gradient Overlay */}
      <LinearGradient
        colors={[
          '#000000', // Pure black
          '#0A0A0A', // Very dark grey
          '#111111', // Dark charcoal with subtle warmth
          '#0A0A0A', // Back to very dark
          '#000000', // Pure black again
        ]}
        locations={[0, 0.2, 0.5, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientOverlay}
      />

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  verticalLine: {
    width: 1,
    height: '100%',
  },
  horizontalLine: {
    height: 1,
    width: '100%',
  },
  starField: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  star: {
    position: 'absolute',
    width: 1,
    height: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 0.5,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 3,
  },
});

export default VibraCosmicBackground;
