import * as Haptics from 'expo-haptics';
import { LayoutGrid, Wand2 } from 'lucide-react-native';
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBackButton, GlassContinueButton } from './OnboardingComponents';
import { NATIVE_ONBOARDING_ASSETS } from './OnboardingAssets';

interface NewOnboardingScreen5Props {
  onNext: () => void;
  onBack: () => void;
}

export const NewOnboardingScreen5: React.FC<NewOnboardingScreen5Props> = ({ onNext, onBack }) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleContinuePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onNext();
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Image - Native asset for instant loading */}
      <Image
        source={NATIVE_ONBOARDING_ASSETS.screen5}
        style={[StyleSheet.absoluteFillObject, { width, height }]}
        resizeMode="cover"
      />

      {/* Header - just back button, no progress bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <GlassBackButton onPress={onBack} />
      </View>

      {/* Content - positioned in middle */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Title */}
        <Text style={styles.title}>Build your{'\n'}idea in minutes</Text>

        {/* Feature List */}
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <LayoutGrid size={20} color="#FFFFFF" style={styles.featureIcon} />
            <Text style={styles.featureText}>
              Templates - a great way to get{'\n'}started for complex ideas
            </Text>
          </View>

          <View style={styles.featureItem}>
            <Wand2 size={20} color="#FFFFFF" style={styles.featureIcon} />
            <Text style={styles.featureText}>
              Vibracode agent helps you build{'\n'}your idea, step by step
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Bottom Section with Card and Button */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        {/* Bottom Card */}
        <Animated.View style={[styles.bottomCard, { opacity: fadeAnim }]}>
          <Text style={styles.bottomCardText}>
            With Vibracode, you can finally build{'\n'}that idea you've been thinking about{'\n'}for
            years
          </Text>
        </Animated.View>

        {/* Continue Button - Glass */}
        <GlassContinueButton onPress={handleContinuePress} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 40,
    marginTop: 40,
    marginBottom: 32,
  },
  featureList: {
    width: '100%',
    gap: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    maxWidth: 300,
  },
  featureIcon: {
    marginTop: 2,
    opacity: 0.9,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.95,
    lineHeight: 22,
    flex: 1,
  },
  bottomCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 16,
  },
  bottomCardText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 24,
    zIndex: 10,
  },
});

export default NewOnboardingScreen5;
