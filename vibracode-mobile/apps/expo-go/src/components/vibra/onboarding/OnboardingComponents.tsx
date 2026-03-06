import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { ChevronLeft, Check } from 'lucide-react-native';
import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';

import {
  OnboardingColors,
  OnboardingLayout,
  OnboardingTypography,
  OnboardingHaptics,
  OnboardingAnimations,
} from './OnboardingConstants';

// ============================================================================
// ANIMATED BUTTON
// ============================================================================

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'text';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: OnboardingAnimations.buttonPress.scale,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;

    // Haptic feedback based on variant
    if (variant === 'primary') {
      OnboardingHaptics.medium();
    } else {
      OnboardingHaptics.light();
    }

    onPress();
  }, [disabled, loading, variant, onPress]);

  const isPrimary = variant === 'primary';
  const isText = variant === 'text';

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          isPrimary && styles.buttonPrimary,
          !isPrimary && !isText && styles.buttonSecondary,
          isText && styles.buttonText,
          disabled && (isPrimary ? styles.buttonPrimaryDisabled : styles.buttonSecondaryDisabled),
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1}>
        <Text
          style={[
            styles.buttonLabel,
            isPrimary && styles.buttonLabelPrimary,
            !isPrimary && !isText && styles.buttonLabelSecondary,
            isText && styles.buttonLabelText,
            disabled &&
              (isPrimary ? styles.buttonLabelPrimaryDisabled : styles.buttonLabelSecondaryDisabled),
            textStyle,
          ]}>
          {loading ? 'Loading...' : title}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// GLASS BACK BUTTON
// ============================================================================

interface GlassBackButtonProps {
  onPress: () => void;
  color?: string;
}

export const GlassBackButton: React.FC<GlassBackButtonProps> = ({ onPress, color = '#FFFFFF' }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    OnboardingHaptics.light();
    onPress();
  }, [onPress]);

  if (useGlass) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}>
          <GlassView style={styles.glassBackButton} isInteractive>
            <View style={styles.glassBackButtonInner}>
              <ChevronLeft size={22} color={color} />
            </View>
          </GlassView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        <View style={styles.blurBackButton}>
          <BlurView intensity={40} tint="dark" style={styles.blurBackButtonContent}>
            <ChevronLeft size={22} color={color} />
          </BlurView>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// SIMPLE BACK BUTTON (no glass, just icon with animation)
// ============================================================================

interface SimpleBackButtonProps {
  onPress: () => void;
  color?: string;
}

export const SimpleBackButton: React.FC<SimpleBackButtonProps> = ({
  onPress,
  color = '#FFFFFF',
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.85,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    OnboardingHaptics.light();
    onPress();
  }, [onPress]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.simpleBackButton}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        <ChevronLeft size={24} color={color} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// ANIMATED PROGRESS BAR
// ============================================================================

interface AnimatedProgressBarProps {
  progress: number; // 0-100
  animated?: boolean;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  progress,
  animated = true,
}) => {
  const widthAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: progress,
        duration: OnboardingAnimations.timing.medium,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(progress);
    }
  }, [progress, animated, widthAnim]);

  const width = animated
    ? widthAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
      })
    : `${progress}%`;

  return (
    <View style={styles.progressBarBackground}>
      <Animated.View
        style={[styles.progressBarFill, { width: animated ? width : `${progress}%` }]}
      />
    </View>
  );
};

// ============================================================================
// SELECTABLE OPTION CARD
// ============================================================================

interface SelectableOptionProps {
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  style?: ViewStyle;
}

export const SelectableOption: React.FC<SelectableOptionProps> = ({
  label,
  subtitle,
  icon,
  selected,
  onSelect,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    OnboardingHaptics.selection();
    onSelect();
  }, [onSelect]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[styles.optionCard, selected && styles.optionCardSelected]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        <View style={styles.optionContent}>
          {icon && <View style={styles.optionIcon}>{icon}</View>}
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionLabel}>{label}</Text>
            {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// GLASS BUTTON - Primary action button with glass effect
// ============================================================================

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'text';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  textStyle,
}) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: OnboardingAnimations.buttonPress.scale,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: OnboardingAnimations.buttonPress.duration,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;

    if (variant === 'primary') {
      OnboardingHaptics.medium();
    } else {
      OnboardingHaptics.light();
    }

    onPress();
  }, [disabled, loading, variant, onPress]);

  const isPrimary = variant === 'primary';
  const isText = variant === 'text';

  // For primary buttons on iOS 26+, use glass effect
  if (useGlass && isPrimary && !disabled) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          activeOpacity={1}>
          <GlassView style={styles.glassButton} isInteractive>
            <View style={styles.glassButtonContent}>
              <Text style={[styles.glassButtonLabel, textStyle]}>
                {loading ? 'Loading...' : title}
              </Text>
            </View>
          </GlassView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Fallback to regular button
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          isPrimary && styles.buttonPrimary,
          !isPrimary && !isText && styles.buttonSecondary,
          isText && styles.buttonText,
          disabled && (isPrimary ? styles.buttonPrimaryDisabled : styles.buttonSecondaryDisabled),
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1}>
        <Text
          style={[
            styles.buttonLabel,
            isPrimary && styles.buttonLabelPrimary,
            !isPrimary && !isText && styles.buttonLabelSecondary,
            isText && styles.buttonLabelText,
            disabled &&
              (isPrimary ? styles.buttonLabelPrimaryDisabled : styles.buttonLabelSecondaryDisabled),
            textStyle,
          ]}>
          {loading ? 'Loading...' : title}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// GLASS CARD - Container with glass effect
// ============================================================================

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  interactive?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, interactive = false }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (useGlass) {
    return (
      <GlassView style={[styles.glassCard, style]} isInteractive={interactive}>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.blurCardContainer, style]}>
      <BlurView intensity={40} tint="dark" style={styles.blurCard}>
        {children}
      </BlurView>
    </View>
  );
};

// ============================================================================
// GLASS PROMPT CARD - Interactive prompt display with glass effect
// ============================================================================

interface GlassPromptCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassPromptCard: React.FC<GlassPromptCardProps> = ({ children, style }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  if (useGlass) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <GlassView style={styles.glassPromptCard} isInteractive>
            <View style={styles.glassPromptCardContent}>{children}</View>
          </GlassView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Fallback with blur for non-glass devices
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <View style={styles.blurPromptCardContainer}>
          <BlurView intensity={40} tint="dark" style={styles.blurPromptCard}>
            {children}
          </BlurView>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// GLASS TEXT INPUT - Text input with glass effect
// ============================================================================

interface GlassTextInputProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassTextInput: React.FC<GlassTextInputProps> = ({ children, style }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (useGlass) {
    return (
      <GlassView style={[styles.glassTextInput, style]} isInteractive>
        <View style={styles.glassTextInputContent}>{children}</View>
      </GlassView>
    );
  }

  // Fallback
  return <View style={[styles.fallbackTextInput, style]}>{children}</View>;
};

// ============================================================================
// GLASS CONTINUE BUTTON - Primary continue button with glass effect
// ============================================================================

interface GlassContinueButtonProps {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export const GlassContinueButton: React.FC<GlassContinueButtonProps> = ({
  title = 'Continue',
  onPress,
  disabled = false,
  loading = false,
  style,
}) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (disabled || loading) return;
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim, disabled, loading]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    OnboardingHaptics.medium();
    onPress();
  }, [disabled, loading, onPress]);

  if (useGlass && !disabled) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          activeOpacity={1}>
          <GlassView style={styles.glassContinueButton} isInteractive>
            <View style={styles.glassContinueButtonContent}>
              <Text style={styles.glassContinueButtonLabel}>{loading ? 'Loading...' : title}</Text>
            </View>
          </GlassView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Fallback to solid white button
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[styles.solidContinueButton, disabled && styles.solidContinueButtonDisabled]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1}>
        <Text
          style={[
            styles.solidContinueButtonLabel,
            disabled && styles.solidContinueButtonLabelDisabled,
          ]}>
          {loading ? 'Loading...' : title}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// GLASS OPTION CARD - Apple HIG Selectable option with glass effect
// ============================================================================

interface GlassOptionCardProps {
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  style?: ViewStyle;
}

export const GlassOptionCard: React.FC<GlassOptionCardProps> = ({
  label,
  subtitle,
  icon,
  selected,
  onSelect,
  style,
}) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 400,
      friction: 20,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 400,
      friction: 20,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    OnboardingHaptics.selection();
    onSelect();
  }, [onSelect]);

  const content = (
    <View style={styles.glassOptionContent}>
      {icon && (
        <View style={[styles.glassOptionIcon, selected && styles.glassOptionIconSelected]}>
          {icon}
        </View>
      )}
      <View style={styles.glassOptionTextContainer}>
        <Text style={[styles.glassOptionLabel, selected && styles.glassOptionLabelSelected]}>
          {label}
        </Text>
        {subtitle && (
          <Text
            style={[styles.glassOptionSubtitle, selected && styles.glassOptionSubtitleSelected]}>
            {subtitle}
          </Text>
        )}
      </View>
      {/* Selection indicator - Apple HIG checkmark circle */}
      <View
        style={[styles.glassOptionCheckCircle, selected && styles.glassOptionCheckCircleSelected]}>
        {selected && <Check size={14} color="#000000" strokeWidth={3} />}
      </View>
    </View>
  );

  if (useGlass) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          style={styles.glassOptionTouchable}>
          <GlassView
            style={[styles.glassOptionCard, selected && styles.glassOptionCardSelected]}
            isInteractive>
            {content}
          </GlassView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Fallback
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[styles.fallbackOptionCard, selected && styles.fallbackOptionCardSelected]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        {content}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// GLASS INPUT CONTAINER - Text input wrapper with glass effect
// ============================================================================

interface GlassInputContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassInputContainer: React.FC<GlassInputContainerProps> = ({ children, style }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (useGlass) {
    return (
      <GlassView style={[styles.glassInputContainer, style]} isInteractive>
        {children}
      </GlassView>
    );
  }

  // Fallback
  return <View style={[styles.fallbackInputContainer, style]}>{children}</View>;
};

// ============================================================================
// GLASS CHIP - Small chip/tag with glass effect
// ============================================================================

interface GlassChipProps {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
}

export const GlassChip: React.FC<GlassChipProps> = ({ label, icon, onPress, style }) => {
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 80,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 80,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    OnboardingHaptics.selection();
    onPress();
  }, [onPress]);

  const content = (
    <View style={styles.glassChipContent}>
      {icon}
      <Text style={styles.glassChipLabel}>{label}</Text>
    </View>
  );

  if (useGlass) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}>
          <GlassView style={styles.glassChip} isInteractive>
            {content}
          </GlassView>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Fallback
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={styles.fallbackChip}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}>
        {content}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Button styles
  button: {
    borderRadius: OnboardingLayout.button.borderRadius,
    paddingVertical: OnboardingLayout.button.paddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: OnboardingLayout.button.height,
  },
  buttonPrimary: {
    backgroundColor: OnboardingColors.button.primaryBg,
  },
  buttonPrimaryDisabled: {
    backgroundColor: OnboardingColors.button.disabledBg,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: OnboardingColors.border.subtle,
  },
  buttonSecondaryDisabled: {
    borderColor: OnboardingColors.border.subtle,
  },
  buttonText: {
    backgroundColor: 'transparent',
  },
  buttonLabel: {
    ...OnboardingTypography.button,
  },
  buttonLabelPrimary: {
    color: OnboardingColors.button.primaryText,
  },
  buttonLabelPrimaryDisabled: {
    color: OnboardingColors.button.disabledText,
  },
  buttonLabelSecondary: {
    color: OnboardingColors.text.primary,
  },
  buttonLabelSecondaryDisabled: {
    color: OnboardingColors.text.tertiary,
  },
  buttonLabelText: {
    color: OnboardingColors.text.tertiary,
  },

  // Glass back button styles
  glassBackButton: {
    width: OnboardingLayout.glassBackButton.size,
    height: OnboardingLayout.glassBackButton.size,
    borderRadius: OnboardingLayout.glassBackButton.borderRadius,
  },
  glassBackButtonInner: {
    width: OnboardingLayout.glassBackButton.size,
    height: OnboardingLayout.glassBackButton.size,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurBackButton: {
    width: OnboardingLayout.glassBackButton.size,
    height: OnboardingLayout.glassBackButton.size,
    borderRadius: OnboardingLayout.glassBackButton.borderRadius,
    overflow: 'hidden',
  },
  blurBackButtonContent: {
    width: OnboardingLayout.glassBackButton.size,
    height: OnboardingLayout.glassBackButton.size,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: OnboardingLayout.glassBackButton.borderRadius,
  },

  // Simple back button
  simpleBackButton: {
    width: OnboardingLayout.backButton.width,
    height: OnboardingLayout.backButton.height,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Progress bar styles
  progressBarBackground: {
    height: OnboardingLayout.progressBar.height,
    backgroundColor: OnboardingColors.progressBar.background,
    borderRadius: OnboardingLayout.progressBar.borderRadius,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: OnboardingColors.progressBar.fill,
    borderRadius: OnboardingLayout.progressBar.borderRadius,
  },

  // Selectable option styles
  optionCard: {
    backgroundColor: OnboardingColors.background.secondary,
    borderRadius: OnboardingLayout.card.borderRadius,
    paddingVertical: OnboardingLayout.card.paddingVertical,
    paddingHorizontal: OnboardingLayout.card.paddingHorizontal,
    borderWidth: 1.5,
    borderColor: OnboardingColors.border.default,
  },
  optionCardSelected: {
    backgroundColor: OnboardingColors.accent.secondary,
    borderColor: OnboardingColors.accent.primary,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: OnboardingColors.text.primary,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: OnboardingColors.text.tertiary,
  },

  // Glass prompt card styles
  glassPromptCard: {
    borderRadius: 16,
    minHeight: 56,
  },
  glassPromptCardContent: {
    padding: 16,
    paddingHorizontal: 18,
  },
  blurPromptCardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  blurPromptCard: {
    padding: 16,
    paddingHorizontal: 18,
    minHeight: 56,
  },

  // Glass text input styles
  glassTextInput: {
    borderRadius: 16,
    minHeight: 56,
  },
  glassTextInputContent: {
    flex: 1,
    padding: 16,
    paddingHorizontal: 18,
  },
  fallbackTextInput: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    minHeight: 56,
    padding: 16,
    paddingHorizontal: 18,
  },

  // Glass card styles
  glassCard: {
    borderRadius: 16,
    padding: 16,
  },
  blurCardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  blurCard: {
    padding: 16,
  },

  // Glass button styles
  glassButton: {
    borderRadius: 30,
    minHeight: 56,
  },
  glassButtonContent: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  glassButtonLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Glass continue button styles
  glassContinueButton: {
    borderRadius: 30,
    minHeight: 56,
  },
  glassContinueButtonContent: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  glassContinueButtonLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  solidContinueButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  solidContinueButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  solidContinueButtonLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  solidContinueButtonLabelDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },

  // Glass option card styles - Apple HIG compliant
  glassOptionTouchable: {
    minHeight: 64, // Apple HIG minimum touch target
  },
  glassOptionCard: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  glassOptionCardSelected: {
    // Selected state is indicated by checkmark and subtle visual feedback
  },
  glassOptionCardSelectedBorder: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fallbackOptionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 64,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  fallbackOptionCardSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  glassOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glassOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  glassOptionIconSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassOptionTextContainer: {
    flex: 1,
  },
  glassOptionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  glassOptionLabelSelected: {
    color: '#FFFFFF',
  },
  glassOptionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  glassOptionSubtitleSelected: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  // Apple HIG checkmark circle - always visible, filled when selected
  glassOptionCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  glassOptionCheckCircleSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  glassOptionCheckInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Legacy styles for backward compatibility
  glassOptionCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  glassOptionCheckmarkInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },

  // Glass input container styles
  glassInputContainer: {
    borderRadius: 16,
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  fallbackInputContainer: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },

  // Glass chip styles
  glassChip: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  fallbackChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  glassChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glassChipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
