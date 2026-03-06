import { Image } from 'expo-dev-client-components';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';

import { ProductionGiftIcon } from '../Icons';
import { VibraGiftModal } from './VibraGiftModal';
import {
  VibraColors,
  VibraSpacing,
  VibraBorderRadius,
  TABLET_BREAKPOINT,
  VibraResponsive,
} from '../../constants/VibraColors';

interface VibraHeaderProps {
  // Props removed since we're using tab navigation now
}

export const VibraHeader: React.FC<VibraHeaderProps> = () => {
  const [showGiftModal, setShowGiftModal] = useState(false);

  // Responsive layout
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const maxContentWidth = isTablet ? VibraResponsive.maxContentWidth : width;

  // Responsive dimensions
  const responsiveStyles = {
    iconSize: isTablet ? 36 : 40,
    iconRadius: isTablet ? 10 : 12,
    buttonSize: isTablet ? 36 : 40,
    buttonRadius: isTablet ? 18 : 20,
    giftIconSize: isTablet ? 18 : 20,
    fontSize: isTablet ? 16 : 18,
    headerHeight: isTablet ? 56 : 64,
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { height: responsiveStyles.headerHeight },
          isTablet && { alignSelf: 'center', width: maxContentWidth },
        ]}>
        {/* Logo and Brand */}
        <View style={styles.brandSection}>
          <Image
            source={{ uri: 'https://i.imgur.com/fPrpRh3.png' }}
            style={[
              styles.appIcon,
              {
                width: responsiveStyles.iconSize,
                height: responsiveStyles.iconSize,
                borderRadius: responsiveStyles.iconRadius,
              },
            ]}
            resizeMode="contain"
          />
          <View style={styles.brandText}>
            <Text style={[styles.appName, { fontSize: responsiveStyles.fontSize }]}>
              Vibra Code
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                width: responsiveStyles.buttonSize,
                height: responsiveStyles.buttonSize,
                borderRadius: responsiveStyles.buttonRadius,
              },
            ]}
            onPress={() => setShowGiftModal(true)}
            activeOpacity={0.8}>
            <ProductionGiftIcon
              size={responsiveStyles.giftIconSize}
              color={VibraColors.neutral.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Gift Modal */}
      <VibraGiftModal visible={showGiftModal} onClose={() => setShowGiftModal(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent', // Let parent container background show through
    paddingTop: VibraSpacing.xl,
    paddingBottom: VibraSpacing.md,
    // No individual border or shadow - handled by parent container
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: VibraSpacing.xl,
    height: 64,
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: VibraSpacing.md,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  brandText: {
    flex: 1,
  },
  appName: {
    color: VibraColors.neutral.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VibraSpacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.button,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
});

export default VibraHeader;
