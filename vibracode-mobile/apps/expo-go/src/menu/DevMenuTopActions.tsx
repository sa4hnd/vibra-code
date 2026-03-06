import { HomeFilledIcon, RefreshIcon, iconSize } from '@expo/styleguide-native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import { VibraColors, VibraSpacing, VibraBorderRadius } from '../constants/VibraColors';

interface DevMenuTopActionsProps {
  onAppReload: () => void;
  onGoToHome: () => void;
}

export const DevMenuTopActions: React.FC<DevMenuTopActionsProps> = ({
  onAppReload,
  onGoToHome,
}) => {
  return (
    <View style={styles.container}>
      {/* Home Button - Top Left */}
      <TouchableOpacity
        style={[styles.actionButton, styles.homeButton]}
        onPress={onGoToHome}
        activeOpacity={0.8}>
        <LinearGradient
          colors={[VibraColors.accent.purple, VibraColors.accent.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}>
          <HomeFilledIcon size={iconSize.small} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Refresh Button - Top Right */}
      <TouchableOpacity
        style={[styles.actionButton, styles.refreshButton]}
        onPress={onAppReload}
        activeOpacity={0.8}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}>
          <RefreshIcon size={iconSize.small} color="#000000" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, // Below status bar
    left: 0,
    right: 0,
    height: 60,
    zIndex: 10000,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    pointerEvents: 'box-none', // Allow touches to pass through to buttons
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: VibraColors.accent.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  homeButton: {
    // Background handled by gradient
  },
  refreshButton: {
    // Background handled by gradient
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
});

export default DevMenuTopActions;
