import * as Haptics from 'expo-haptics';
import { Platform, Easing } from 'react-native';

// ============================================================================
// COLORS
// ============================================================================

export const OnboardingColors = {
  // Background colors - dark gray instead of pure black
  background: {
    primary: '#0A0A0F', // Dark gray for most screens
    secondary: '#111111', // Slightly lighter for cards/inputs
    tertiary: '#1A1A1A', // For progress bars, disabled states
    input: '#111111', // Input backgrounds
  },

  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    disabled: '#666666',
    placeholder: 'rgba(255, 255, 255, 0.4)',
  },

  // Accent colors
  accent: {
    primary: '#00D4AA', // Teal/cyan for selections
    secondary: '#0A2A22', // Selected background
    success: '#34C759', // Success/ready states
    warning: '#FFA500', // Stars, ratings
    error: '#FF4444', // Recording, errors
  },

  // Button colors
  button: {
    primaryBg: '#FFFFFF',
    primaryText: '#000000',
    disabledBg: '#1A1A1A',
    disabledText: '#666666',
  },

  // Border colors
  border: {
    default: 'transparent',
    subtle: 'rgba(255, 255, 255, 0.1)',
    selected: '#00D4AA',
    input: 'rgba(255, 255, 255, 0.25)',
  },

  // Progress bar
  progressBar: {
    background: '#1A1A1A',
    fill: '#FFFFFF',
  },
};

// ============================================================================
// ANIMATION CONFIGURATIONS
// ============================================================================

export const OnboardingAnimations = {
  // Timing configurations - slower, more elegant transitions
  timing: {
    fast: 150,
    medium: 300,
    slow: 450,
    screenTransition: 550, // Slower screen transitions
    contentFade: 800, // Slower content fade-in
    logoAnimation: 900,
  },

  // Spring configurations
  spring: {
    default: {
      tension: 50,
      friction: 8,
    },
    bouncy: {
      tension: 100,
      friction: 8,
    },
    gentle: {
      tension: 40,
      friction: 10,
    },
  },

  // Easing functions
  easing: {
    standard: Easing.bezier(0.25, 0.1, 0.25, 1),
    smooth: Easing.bezier(0.45, 0, 0.55, 1),
    easeOut: Easing.bezier(0.33, 1, 0.68, 1),
    easeInOut: Easing.bezier(0.42, 0, 0.58, 1),
  },

  // Button press scale
  buttonPress: {
    scale: 0.95,
    duration: 100,
  },

  // Card hover/select animations
  card: {
    scaleSelected: 1.02,
    scaleNormal: 1,
  },
};

// ============================================================================
// HAPTIC FEEDBACK
// ============================================================================

export const OnboardingHaptics = {
  // Light impact - for selections, navigation
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  // Medium impact - for primary actions (continue, submit)
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  // Heavy impact - for important actions
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),

  // Selection feedback
  selection: () => Haptics.selectionAsync(),

  // Success notification
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  // Warning notification
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),

  // Error notification
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  // Typewriter effect - very soft haptic for each character
  typewriter: () => {
    // Use soft style on iOS for subtle typewriter feel
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    } else {
      // For Android, use light impact with reduced intensity
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },
};

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================

export const OnboardingLayout = {
  // Padding/margins
  padding: {
    horizontal: 24,
    headerHorizontal: 16,
    bottom: 32,
  },

  // Button dimensions
  button: {
    height: 56,
    borderRadius: 30,
    paddingVertical: 18,
  },

  // Progress bar
  progressBar: {
    height: 4,
    borderRadius: 2,
  },

  // Card dimensions
  card: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },

  // Input dimensions
  input: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1.5,
  },

  // Back button
  backButton: {
    width: 44,
    height: 44,
  },

  // Glass back button
  glassBackButton: {
    size: 44,
    borderRadius: 22,
  },
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const OnboardingTypography = {
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 36,
  },

  titleLarge: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 42,
  },

  subtitle: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 26,
  },

  body: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
  },

  label: {
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
  },

  button: {
    fontSize: 17,
    fontWeight: '600' as const,
  },

  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
  },

  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 15,
    lineHeight: 22,
  },
};

// ============================================================================
// PROGRESS BAR PERCENTAGES
// ============================================================================

export const ScreenProgress: { [key: number]: string } = {
  0: '0%', // Welcome/Login screen - no progress bar shown
  1: '7%',
  2: '14%',
  3: '21%', // No progress bar shown
  4: '28%',
  5: '35%', // No progress bar shown
  6: '42%',
  7: '50%',
  8: '57%',
  9: '64%', // No progress bar shown
  10: '71%',
  11: '78%', // No progress bar shown
  12: '85%',
  13: '92%',
  14: '100%', // No progress bar shown
  15: '100%', // No progress bar shown
};

// ============================================================================
// SCREEN TRANSITION TYPES
// ============================================================================

export type TransitionType = 'slide' | 'slideUp' | 'fade' | 'none';

export const ScreenTransitions: { [key: number]: TransitionType } = {
  0: 'fade', // Welcome/Login screen - fade transition
  1: 'slide',
  2: 'slide',
  3: 'slideUp', // Bottom to top
  4: 'slide',
  5: 'slideUp', // Bottom to top
  6: 'slide',
  7: 'slide',
  8: 'slide',
  9: 'slideUp', // Bottom to top
  10: 'slide',
  11: 'slide',
  12: 'slide',
  13: 'slide',
  14: 'slide',
  15: 'slide',
};

// ============================================================================
// SCREENS WITH SPECIAL BACKGROUNDS
// ============================================================================

// Screens that use mesh gradient or special backgrounds (not solid color)
export const ScreensWithSpecialBackground = [0, 3, 5, 9, 11, 15];

// Screens that don't show progress bar
export const ScreensWithoutProgressBar = [0, 3, 5, 9, 11, 14, 15];
