/**
 * Vibra Design System Colors
 * Grok-style cosmic theme with futuristic elements
 * Dark, minimalist aesthetic with cosmic grid patterns
 */

export const VibraColors = {
  // Grok-style cosmic palette
  primary: {
    black: '#000000', // Pure black
    dark: '#0A0A0A', // Very dark grey
    charcoal: '#111111', // Dark charcoal with subtle warmth
    grey: '#1A1A1A', // Medium dark grey
    lightGrey: '#2A2A2A', // Light dark grey
  },

  // Cosmic neutrals - futuristic and minimal
  neutral: {
    background: '#000000', // Pure black background
    backgroundSecondary: '#0A0A0A', // Very dark secondary
    backgroundTertiary: '#111111', // Dark tertiary with subtle warmth
    text: '#FFFFFF', // Pure white text
    textSecondary: '#CCCCCC', // Brighter secondary text
    textTertiary: '#888888', // Medium grey text
    border: '#1A1A1A', // Subtle dark border
    borderLight: '#0F0F0F', // Very subtle border
  },

  // Card and surface colors - cosmic and futuristic
  surface: {
    card: '#111111', // Dark cards with subtle warmth
    cardHover: '#1A1A1A', // Slightly lighter on hover
    shadow: 'rgba(0, 0, 0, 0.5)', // Deeper cosmic shadow
    shadowHover: 'rgba(0, 0, 0, 0.6)', // Stronger shadow
  },

  // Status colors - minimal and professional
  status: {
    success: '#00D4AA', // Teal success
    warning: '#F59E0B', // Amber warning
    error: '#EF4444', // Red error
    info: '#00A8FF', // Blue info
    running: '#00D4AA', // Teal running
    pending: '#F59E0B', // Amber pending
  },
  accent: {
    blue: '#00A8FF', // Professional blue
    teal: '#00D4AA', // Sophisticated teal
    purple: '#8B5CF6', // Elegant purple
    amber: '#F59E0B', // Premium amber
    red: '#EF4444', // Refined red
    emerald: '#10B981', // Modern emerald
    indigo: '#6366F1', // Deep indigo
  },

  // Interactive elements - professional
  interactive: {
    buttonPrimary: '#FFFFFF',
    buttonSecondary: '#2A2A2A',
    buttonHover: '#3A3A3A',
    buttonPressed: '#1A1A1A',
    link: '#00A8FF',
    linkHover: '#0088CC',
  },

  // Shadow colors - professional depth
  shadow: {
    card: 'rgba(0, 0, 0, 0.3)',
    cardHover: 'rgba(0, 0, 0, 0.4)',
    button: 'rgba(0, 0, 0, 0.2)',
    text: 'rgba(0, 0, 0, 0.1)',
    primary: 'rgba(0, 0, 0, 0.3)',
  },

  // Glass effect colors - cosmic and futuristic
  glass: {
    primary: 'rgba(17, 17, 17, 0.8)',
    secondary: 'rgba(26, 26, 26, 0.8)',
    tertiary: 'rgba(42, 42, 42, 0.8)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
} as const;

// Gradient definitions - professional black/white gradients
export const VibraGradients = {
  primary: 'linear-gradient(135deg, #000000 0%, #1A1A1A 100%)',
  primaryReverse: 'linear-gradient(315deg, #000000 0%, #1A1A1A 100%)',
  background: 'linear-gradient(180deg, #000000 0%, #0A0A0A 100%)',
  card: 'linear-gradient(145deg, #1A1A1A 0%, #2A2A2A 100%)',

  // Professional accent gradients
  accentBlue: 'linear-gradient(135deg, #00A8FF 0%, #0088CC 100%)',
  accentTeal: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
  accentPurple: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
  accentAmber: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  accentRed: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
  accentEmerald: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  accentIndigo: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',

  // Legacy monochrome gradients for compatibility
  iconDark: 'linear-gradient(135deg, #2A2A2A 0%, #3A3A3A 100%)', // Dark gradient
  iconCharcoal: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)', // Charcoal gradient
  iconGrey: 'linear-gradient(135deg, #3A3A3A 0%, #4A4A4A 100%)', // Grey gradient
  iconLight: 'linear-gradient(135deg, #4A4A4A 0%, #5A5A5A 100%)', // Light gradient
  iconWhite: 'linear-gradient(135deg, #FFFFFF 0%, #F0F0F0 100%)', // White gradient
  iconAccent: 'linear-gradient(135deg, #00A8FF 0%, #0088CC 100%)', // Blue accent
  iconSuccess: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)', // Teal success
} as const;

// Typography weights
export const VibraTypography = {
  weight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
} as const;

// Spacing system
export const VibraSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

// Border radius
export const VibraBorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// Tablet breakpoint (768px is standard iPad width in portrait)
export const TABLET_BREAKPOINT = 768;

// Responsive layout constants for tablets
export const VibraResponsive = {
  // Max content width on tablets (centered content)
  maxContentWidth: 600,
  // Scale factor for UI elements on tablets
  tabletScale: 0.92,
  // Grid columns
  gridColumns: {
    phone: 1,
    tablet: 2,
  },
} as const;
