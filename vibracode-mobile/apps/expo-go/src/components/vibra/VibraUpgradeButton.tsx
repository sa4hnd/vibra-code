import { LinearGradient } from 'expo-linear-gradient';
import { Star, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { VibraColors, VibraSpacing } from '../../constants/VibraColors';

interface VibraUpgradeButtonProps {
  onPress: () => void;
  isPro?: boolean;
  style?: any;
}

export const VibraUpgradeButton: React.FC<VibraUpgradeButtonProps> = ({
  onPress,
  isPro = false,
  style,
}) => {
  return (
    <TouchableOpacity style={[styles.container, style]} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={[VibraColors.neutral.text, VibraColors.neutral.textSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}>
        <View style={styles.iconContainer}>
          <Star size={18} color="#000000" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.mainText}>{isPro ? 'Get More Tokens' : 'Upgrade to Pro'}</Text>
          <Text style={styles.subText}>
            {isPro ? 'Purchase additional tokens' : 'Unlock unlimited access'}
          </Text>
        </View>
        <View style={styles.arrowContainer}>
          <ChevronRight size={16} color="rgba(0, 0, 0, 0.6)" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: VibraSpacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VibraSpacing.xl,
    paddingHorizontal: VibraSpacing.xl,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.lg,
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  textContainer: {
    flex: 1,
  },
  mainText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.7)',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
});
