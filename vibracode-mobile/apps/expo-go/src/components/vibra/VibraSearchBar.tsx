import { Search, ChevronDown } from 'lucide-react-native';
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

import {
  VibraColors,
  VibraSpacing,
  VibraBorderRadius,
  TABLET_BREAKPOINT,
  VibraResponsive,
} from '../../constants/VibraColors';

interface VibraSearchBarProps {
  onSearchChange: (text: string) => void;
  onSortPress: () => void;
  sortText?: string;
  searchValue?: string;
}

export const VibraSearchBar: React.FC<VibraSearchBarProps> = ({
  onSearchChange,
  onSortPress,
  sortText = 'Newest',
  searchValue = '',
}) => {
  // Responsive layout
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const maxContentWidth = isTablet ? VibraResponsive.maxContentWidth : width;

  // Responsive dimensions
  const responsiveStyles = {
    searchIconSize: isTablet ? 14 : 16,
    chevronSize: isTablet ? 12 : 14,
    inputFontSize: isTablet ? 13 : 14,
    sortFontSize: isTablet ? 12 : 13,
    minHeight: isTablet ? 36 : 40,
    paddingHorizontal: isTablet ? 12 : 14,
    paddingVertical: isTablet ? 8 : 10,
    sortMinWidth: isTablet ? 80 : 90,
  };

  return (
    <View style={[styles.container, isTablet && { alignSelf: 'center', width: maxContentWidth }]}>
      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            minHeight: responsiveStyles.minHeight,
            paddingHorizontal: responsiveStyles.paddingHorizontal,
            paddingVertical: responsiveStyles.paddingVertical,
          },
        ]}>
        <Search
          size={responsiveStyles.searchIconSize}
          color="rgba(255, 255, 255, 0.7)"
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { fontSize: responsiveStyles.inputFontSize }]}
          placeholder="Search projects..."
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          value={searchValue}
          onChangeText={onSearchChange}
        />
      </View>

      {/* Sort Dropdown */}
      <TouchableOpacity
        style={[
          styles.sortButton,
          {
            minHeight: responsiveStyles.minHeight,
            paddingHorizontal: responsiveStyles.paddingHorizontal,
            paddingVertical: responsiveStyles.paddingVertical,
            minWidth: responsiveStyles.sortMinWidth,
          },
        ]}
        onPress={onSortPress}>
        <Text style={[styles.sortText, { fontSize: responsiveStyles.sortFontSize }]}>
          {sortText}
        </Text>
        <ChevronDown size={responsiveStyles.chevronSize} color="rgba(255, 255, 255, 0.7)" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: VibraSpacing.lg,
    paddingBottom: VibraSpacing.md,
    backgroundColor: 'transparent',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    // Premium dark background
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: VibraSpacing.sm,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    // Enhanced shadow
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    minHeight: 40,
  },
  searchIcon: {
    marginRight: 8,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    color: VibraColors.neutral.text,
    fontSize: 14,
    fontWeight: '500' as any,
    padding: 0,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    // Premium dark background
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: VibraSpacing.xs,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    // Enhanced shadow
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    minHeight: 40,
    minWidth: 90,
  },
  sortText: {
    color: VibraColors.neutral.text,
    fontSize: 13,
    fontWeight: '600' as any,
    letterSpacing: -0.1,
  },
});

export default VibraSearchBar;
