import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { VibraColors, VibraSpacing } from '../../constants/VibraColors';
import { useUsage } from '../../hooks/useUsage';

export const VibraUsageDisplay: React.FC = () => {
  const {
    userTokens,
    isPro,
    remainingMessages,
    usedMessages,
    totalMessages,
    planName,
    isLoading,
    billingMode,
  } = useUsage();

  if (isLoading || !userTokens) {
    return null;
  }

  const isCreditsMode = billingMode === 'credits';
  const usagePercentage = totalMessages > 0 ? (usedMessages / totalMessages) * 100 : 0;

  const formatValue = (value: number) => {
    if (value === undefined || value === null) {
      return isCreditsMode ? '$0.00' : '0';
    }
    if (isCreditsMode) {
      return `$${value.toFixed(2)}`;
    }
    return Math.floor(value).toString();
  };

  return (
    <View style={styles.container}>
      {/* Plan + Balance Row */}
      <View style={styles.mainRow}>
        <View style={styles.leftSection}>
          <Text style={styles.balanceValue}>{formatValue(remainingMessages)}</Text>
          <Text style={styles.balanceLabel}>
            {isCreditsMode ? 'credits left' : 'messages left'}
          </Text>
        </View>

        <View style={[styles.planBadge, isPro && styles.proBadge]}>
          <Text style={[styles.planText, isPro && styles.proText]}>{planName}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${Math.max(100 - usagePercentage, 0)}%` }]}
          />
        </View>
        <Text style={styles.usageText}>
          {formatValue(usedMessages)} used of {formatValue(totalMessages)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    padding: VibraSpacing.lg,
    marginVertical: VibraSpacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: VibraSpacing.md,
  },
  leftSection: {
    flex: 1,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: VibraColors.neutral.text,
    letterSpacing: -0.5,
  },
  balanceLabel: {
    fontSize: 13,
    color: VibraColors.neutral.textSecondary,
    marginTop: 2,
  },
  planBadge: {
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  proBadge: {
    backgroundColor: VibraColors.accent.purple,
  },
  planText: {
    fontSize: 13,
    fontWeight: '600',
    color: VibraColors.neutral.textSecondary,
  },
  proText: {
    color: '#fff',
  },
  progressContainer: {
    gap: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: VibraColors.accent.purple,
    borderRadius: 3,
  },
  usageText: {
    fontSize: 12,
    color: VibraColors.neutral.textTertiary,
  },
});
