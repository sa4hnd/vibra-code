import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

import { VibraColors, VibraBorderRadius } from '../../constants/VibraColors';

interface VibraGlassViewProps extends ViewProps {
  intensity?: 'light' | 'medium' | 'strong';
  variant?: 'primary' | 'secondary' | 'tertiary';
  borderRadius?: keyof typeof VibraBorderRadius;
  children?: React.ReactNode;
}

export const VibraGlassView: React.FC<VibraGlassViewProps> = ({
  intensity = 'medium',
  variant = 'primary',
  borderRadius = 'lg',
  style,
  children,
  ...props
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
        return VibraColors.glass.primary;
      case 'secondary':
        return VibraColors.glass.secondary;
      case 'tertiary':
        return VibraColors.glass.tertiary;
      default:
        return VibraColors.glass.primary;
    }
  };

  const getOpacity = () => {
    switch (intensity) {
      case 'light':
        return 0.6;
      case 'medium':
        return 0.8;
      case 'strong':
        return 1.0;
      default:
        return 0.8;
    }
  };

  const glassStyles = {
    backgroundColor: getBackgroundColor(),
    borderRadius: VibraBorderRadius[borderRadius],
    borderWidth: 1,
    borderColor: VibraColors.glass.border,
    opacity: getOpacity(),
    shadowColor: VibraColors.shadow.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  };

  return (
    <View style={[glassStyles, style]} {...props}>
      {children}
    </View>
  );
};

export default VibraGlassView;
