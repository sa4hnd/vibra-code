import { useWindowDimensions } from 'react-native';

import { TABLET_BREAKPOINT, VibraResponsive } from '../constants/VibraColors';

/**
 * Hook for responsive design - detects tablet vs phone and provides responsive values
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const isLandscape = width > height;

  return {
    width,
    height,
    isTablet,
    isLandscape,
    // Content max width - constrain on tablets for better readability
    maxContentWidth: isTablet ? VibraResponsive.maxContentWidth : width,
    // Scale for UI elements - slightly smaller on tablets to fit more content
    scale: isTablet ? VibraResponsive.tabletScale : 1,
    // Grid columns
    gridColumns: isTablet ? VibraResponsive.gridColumns.tablet : VibraResponsive.gridColumns.phone,
  };
}

/**
 * Get responsive value based on device type
 */
export function useResponsiveValue<T>(phoneValue: T, tabletValue: T): T {
  const { isTablet } = useResponsive();
  return isTablet ? tabletValue : phoneValue;
}
