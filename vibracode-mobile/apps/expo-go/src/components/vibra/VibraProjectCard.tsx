import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCw, Play, MoreHorizontal, X, Trash2 } from 'lucide-react-native';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Easing,
} from 'react-native';

import { ProductionArrowRightIcon } from '../Icons';
import { VibraAnimatedTouchable } from './VibraAnimatedTouchable';
import { VibraColors, TABLET_BREAKPOINT } from '../../constants/VibraColors';

interface Project {
  id: string;
  name: string;
  icon: string;
  lastModified: string;
  expoUrl: string;
  status?: string;
  statusMessage?: string;
  repository?: string;
}

interface VibraProjectCardProps {
  project: Project;
  onPress: () => void;
  onRestartServer?: () => void;
  onDelete?: () => void;
  isLoading?: boolean;
  isRestarting?: boolean;
  isDeleting?: boolean;
}

// Function to get sophisticated gradients that match our dark theme
const getLetterGradient = (
  letter: string
): { colors: string[]; shadowColor: string; borderColor: string } => {
  const gradients = [
    { colors: ['#00A8FF', '#0088CC'], shadowColor: '#00A8FF', borderColor: '#00A8FF20' }, // A, H, O, V - Professional blue
    { colors: ['#00D4AA', '#00B894'], shadowColor: '#00D4AA', borderColor: '#00D4AA20' }, // B, I, P, W - Sophisticated teal
    { colors: ['#8B5CF6', '#7C3AED'], shadowColor: '#8B5CF6', borderColor: '#8B5CF620' }, // C, J, Q, X - Elegant purple
    { colors: ['#F59E0B', '#D97706'], shadowColor: '#F59E0B', borderColor: '#F59E0B20' }, // D, K, R, Y - Premium amber
    { colors: ['#EF4444', '#DC2626'], shadowColor: '#EF4444', borderColor: '#EF444420' }, // E, L, S, Z - Refined red
    { colors: ['#10B981', '#059669'], shadowColor: '#10B981', borderColor: '#10B98120' }, // F, M, T - Modern emerald
    { colors: ['#6366F1', '#4F46E5'], shadowColor: '#6366F1', borderColor: '#6366F120' }, // G, N, U - Deep indigo
  ];

  const charCode = letter.toUpperCase().charCodeAt(0);
  const index = (charCode - 65) % gradients.length; // A=0, B=1, etc.
  return gradients[index] || gradients[0];
};

export const VibraProjectCard: React.FC<VibraProjectCardProps> = ({
  project,
  onPress,
  onRestartServer,
  onDelete,
  isLoading = false,
  isRestarting = false,
  isDeleting = false,
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const [showMenu, setShowMenu] = useState(false);
  const menuAnimation = useRef(new Animated.Value(0)).current;
  const spinAnimation = useRef(new Animated.Value(0)).current;

  // Spin animation for restart icon
  React.useEffect(() => {
    if (isRestarting) {
      const spin = Animated.loop(
        Animated.timing(spinAnimation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    } else {
      spinAnimation.setValue(0);
      return undefined;
    }
  }, [isRestarting, spinAnimation]);

  const spinRotation = spinAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const openMenu = () => {
    setShowMenu(true);
    Animated.spring(menuAnimation, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowMenu(false));
  };

  const handlePress = () => {
    if (isLoading || isRestarting || isDeleting) {
      console.log('⏳ Project is already loading, restarting, or deleting, ignoring tap');
      return;
    }

    console.log('Project clicked:', project.name);
    console.log('Opening URL:', project.expoUrl);

    if (onPress) {
      onPress();
    }
  };

  const handleRestartPress = () => {
    if (isLoading || isRestarting || isDeleting) {
      console.log('⏳ Already in progress, ignoring restart tap');
      return;
    }

    console.log('🔄 Restart server clicked for:', project.name);
    closeMenu();
    if (onRestartServer) {
      onRestartServer();
    }
  };

  const handleDeletePress = () => {
    if (isLoading || isRestarting || isDeleting) {
      console.log('⏳ Already in progress, ignoring delete tap');
      return;
    }

    console.log('🗑️ Delete project clicked for:', project.name);
    closeMenu();
    if (onDelete) {
      onDelete();
    }
  };

  const handleMenuPress = (e: any) => {
    e.stopPropagation();
    if (!isLoading && !isRestarting && !isDeleting) {
      openMenu();
    }
  };

  // Get the gradient colors for this project's icon letter
  const iconGradient = getLetterGradient(project.icon);

  // Responsive styles
  const responsiveStyles = {
    contentPadding: isTablet ? 20 : 24,
    iconSize: isTablet ? 44 : 48,
    iconRadius: isTablet ? 10 : 12,
    iconMargin: isTablet ? 16 : 20,
    iconFontSize: isTablet ? 18 : 20,
    nameFontSize: isTablet ? 15 : 17,
    nameLineHeight: isTablet ? 20 : 22,
    arrowSize: isTablet ? 28 : 32,
    marginBottom: isTablet ? 12 : 16,
  };

  const menuScale = menuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <>
      <VibraAnimatedTouchable
        style={[
          styles.container,
          {
            opacity: isLoading || isRestarting || isDeleting ? 0.85 : 1,
            marginBottom: responsiveStyles.marginBottom,
          },
        ]}
        onPress={handlePress}
        scaleValue={0.98}
        disabled={isLoading || isRestarting || isDeleting}>
        {/* Content Container */}
        <View style={[styles.contentContainer, { padding: responsiveStyles.contentPadding }]}>
          {/* Project Icon */}
          <View
            style={[
              styles.iconContainer,
              {
                shadowColor: iconGradient.shadowColor,
                borderColor: iconGradient.borderColor,
                width: responsiveStyles.iconSize,
                height: responsiveStyles.iconSize,
                borderRadius: responsiveStyles.iconRadius,
                marginRight: responsiveStyles.iconMargin,
              },
            ]}>
            <LinearGradient
              colors={iconGradient.colors as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.iconGradient, { borderRadius: responsiveStyles.iconRadius }]}>
              <Text style={[styles.iconText, { fontSize: responsiveStyles.iconFontSize }]}>
                {project.icon}
              </Text>
            </LinearGradient>
          </View>

          {/* Project Info */}
          <View style={styles.projectInfo}>
            <Text
              style={[
                styles.projectName,
                {
                  fontSize: responsiveStyles.nameFontSize,
                  lineHeight: responsiveStyles.nameLineHeight,
                },
              ]}
              numberOfLines={1}>
              {project.name}
            </Text>
            {isLoading && (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, styles.statusDotBlue]} />
                <Text style={styles.loadingText}>Opening...</Text>
              </View>
            )}
            {isRestarting && (
              <View style={styles.statusRow}>
                <Animated.View style={{ transform: [{ rotate: spinRotation }] }}>
                  <RefreshCw size={10} color={VibraColors.accent.amber} />
                </Animated.View>
                <Text style={styles.restartingText}>Restarting... (may take a minute)</Text>
              </View>
            )}
            {isDeleting && (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, styles.statusDotRed]} />
                <Text style={styles.deletingText}>Deleting...</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {/* Menu Button - Elegant three dots */}
            {(onRestartServer || onDelete) && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={handleMenuPress}
                disabled={isLoading || isRestarting || isDeleting}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MoreHorizontal size={18} color={VibraColors.neutral.textTertiary} />
              </TouchableOpacity>
            )}

            {/* Arrow Icon or Loading Indicator */}
            <View
              style={[
                styles.arrowContainer,
                {
                  width: responsiveStyles.arrowSize,
                  height: responsiveStyles.arrowSize,
                  borderRadius: responsiveStyles.arrowSize / 2,
                },
              ]}>
              {isLoading ? (
                <ActivityIndicator size="small" color={VibraColors.accent.blue} />
              ) : (
                <ProductionArrowRightIcon
                  size={isTablet ? 16 : 18}
                  color={VibraColors.neutral.textTertiary}
                />
              )}
            </View>
          </View>
        </View>
      </VibraAnimatedTouchable>

      {/* Elegant Context Menu Modal */}
      <Modal visible={showMenu} transparent animationType="none" onRequestClose={closeMenu}>
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View
            style={[
              styles.menuContainer,
              {
                opacity: menuAnimation,
                transform: [{ scale: menuScale }],
              },
            ]}>
            {/* Menu Header */}
            <View style={styles.menuHeader}>
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: iconGradient.colors[0] + '20' },
                ]}>
                <Text style={[styles.menuIconText, { color: iconGradient.colors[0] }]}>
                  {project.icon}
                </Text>
              </View>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {project.name}
              </Text>
              <TouchableOpacity style={styles.menuCloseButton} onPress={closeMenu}>
                <X size={18} color={VibraColors.neutral.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.menuDivider} />

            {/* Menu Items */}
            <TouchableOpacity style={styles.menuItem} onPress={handlePress} activeOpacity={0.7}>
              <View style={[styles.menuItemIcon, styles.menuItemIconBlue]}>
                <Play size={16} color="#00A8FF" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Open Project</Text>
                <Text style={styles.menuItemSubtitle}>Launch in Expo Go</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleRestartPress}
              activeOpacity={0.7}>
              <View style={[styles.menuItemIcon, styles.menuItemIconAmber]}>
                <RefreshCw size={16} color="#F59E0B" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Restart Server</Text>
                <Text style={styles.menuItemSubtitle}>Fix stuck or crashed dev server</Text>
              </View>
            </TouchableOpacity>

            {/* Divider before destructive action */}
            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDeletePress}
              activeOpacity={0.7}>
              <View style={[styles.menuItemIcon, styles.menuItemIconRed]}>
                <Trash2 size={16} color="#EF4444" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, styles.menuItemTitleDestructive]}>Delete Project</Text>
                <Text style={styles.menuItemSubtitle}>Remove permanently</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    position: 'relative',
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'visible',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    position: 'relative',
    zIndex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800' as any,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  projectInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  projectName: {
    color: VibraColors.neutral.text,
    fontSize: 17,
    fontWeight: '600' as any,
    lineHeight: 22,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotBlue: {
    backgroundColor: VibraColors.accent.blue,
  },
  loadingText: {
    color: VibraColors.accent.blue,
    fontSize: 12,
    fontWeight: '500' as any,
    opacity: 0.9,
  },
  restartingText: {
    color: VibraColors.accent.amber,
    fontSize: 12,
    fontWeight: '500' as any,
    opacity: 0.9,
  },
  statusDotRed: {
    backgroundColor: '#EF4444',
  },
  deletingText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500' as any,
    opacity: 0.9,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.button,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIconText: {
    fontSize: 16,
    fontWeight: '700' as any,
  },
  menuTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as any,
    letterSpacing: -0.3,
  },
  menuCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 14,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemIconBlue: {
    backgroundColor: 'rgba(0, 168, 255, 0.15)',
  },
  menuItemIconAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  menuItemIconRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500' as any,
    letterSpacing: -0.2,
  },
  menuItemTitleDestructive: {
    color: '#EF4444',
  },
  menuItemSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '400' as any,
    marginTop: 2,
  },
});

export default VibraProjectCard;
