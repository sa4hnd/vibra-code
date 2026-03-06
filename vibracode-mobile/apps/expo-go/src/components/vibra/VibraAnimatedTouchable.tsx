import React, { useRef } from 'react';
import { TouchableOpacity, Animated, TouchableOpacityProps } from 'react-native';

interface VibraAnimatedTouchableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  scaleValue?: number;
}

export const VibraAnimatedTouchable: React.FC<VibraAnimatedTouchableProps> = ({
  children,
  scaleValue = 0.97,
  onPressIn,
  onPressOut,
  ...props
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (event: any) => {
    Animated.spring(scaleAnim, {
      toValue: scaleValue,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
    onPressOut?.(event);
  };

  return (
    <TouchableOpacity
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}>
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
        }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default VibraAnimatedTouchable;
