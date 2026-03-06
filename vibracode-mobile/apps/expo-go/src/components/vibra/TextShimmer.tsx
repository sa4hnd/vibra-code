import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, TextStyle, LayoutChangeEvent } from 'react-native';

import { VibraColors } from '../../constants/VibraColors';

interface TextShimmerProps {
  children: string;
  style?: TextStyle;
  duration?: number;
}

export const TextShimmer: React.FC<TextShimmerProps> = ({ children, style, duration = 1500 }) => {
  const shimmerAnimation = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(200);

  const handleLayout = (event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  };

  useEffect(() => {
    const animate = () => {
      shimmerAnimation.setValue(0);
      Animated.timing(shimmerAnimation, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start(() => animate());
    };

    animate();

    return () => {
      shimmerAnimation.stopAnimation();
    };
  }, [shimmerAnimation, duration]);

  // Shimmer travels from left edge to right edge (full width)
  const shimmerWidth = 80;
  const translateX = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, textWidth + shimmerWidth],
  });

  return (
    <MaskedView
      style={{ flexDirection: 'row' }}
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]} onLayout={handleLayout}>
          {children}
        </Text>
      }>
      {/* Base text - professional grey */}
      <Text style={[style, { color: VibraColors.neutral.textSecondary, opacity: 0.8 }]}>
        {children}
      </Text>

      {/* Animated shimmer overlay - travels full width */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: shimmerWidth,
          transform: [{ translateX }],
        }}>
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0)',
            'rgba(255, 255, 255, 0.3)',
            'rgba(255, 255, 255, 0.8)',
            'rgba(255, 255, 255, 0.3)',
            'rgba(255, 255, 255, 0)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flex: 1,
            width: shimmerWidth,
          }}
        />
      </Animated.View>
    </MaskedView>
  );
};
