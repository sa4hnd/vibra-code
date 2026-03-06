import { LinearGradient } from 'expo-linear-gradient';
import { X, Gift, Mail } from 'lucide-react-native';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Linking,
  Alert,
  useWindowDimensions,
} from 'react-native';

import {
  TwitterIcon,
  YouTubeIcon,
  TikTokIcon,
  InstagramIcon,
  RedditIcon,
  LinkedInIcon,
} from './SocialMediaIcons';
import { VibraColors, VibraSpacing, VibraBorderRadius } from '../../constants/VibraColors';

interface VibraGiftModalProps {
  visible: boolean;
  onClose: () => void;
}

export const VibraGiftModal: React.FC<VibraGiftModalProps> = ({ visible, onClose }) => {
  const { width, height } = useWindowDimensions();

  // Responsive breakpoints (matching OnboardingScreen1 pattern)
  const isTablet = width > 768;
  const isLargeTablet = width > 1024;
  const isLandscape = width > height;
  const isCompact = height < 700;

  const handleEmailPress = () => {
    const email = 'support@vibracode.com';
    const subject = 'Claiming $10 Credits - Social Media Post';
    const body =
      'Hi VibraCode team,\n\nI posted about VibraCode on social media and would like to claim my $10 worth of credits.\n\nPlease find my post details below:\n\nPlatform: \nPost URL: \n\nThank you!';

    const emailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Linking.openURL(emailUrl).catch(() => {
      Alert.alert('Error', 'Could not open email client. Please email us at support@vibracode.com');
    });
  };

  const socialPlatforms = [
    { name: 'X (Twitter)', icon: TwitterIcon, color: '#1DA1F2' },
    { name: 'YouTube', icon: YouTubeIcon, color: '#FF0000' },
    { name: 'TikTok', icon: TikTokIcon, color: '#000000' },
    { name: 'Instagram', icon: InstagramIcon, color: '#E4405F' },
    { name: 'Reddit', icon: RedditIcon, color: '#FF4500' },
    { name: 'LinkedIn', icon: LinkedInIcon, color: '#0077B5' },
  ];

  // Responsive styles (matching OnboardingScreen1 pattern)
  const responsiveStyles = {
    modal: {
      width: isLargeTablet ? width * 0.5 : isTablet ? width * 0.65 : width * 0.9,
      maxWidth: isLargeTablet ? 600 : isTablet ? 500 : 400,
      maxHeight: isLandscape ? height * 0.9 : height * 0.85,
    },
    brandTitle: {
      fontSize: isTablet ? 34 : isCompact ? 24 : 28,
      lineHeight: isTablet ? 42 : isCompact ? 30 : 34,
    },
    brandTagline: {
      fontSize: isTablet ? 18 : isCompact ? 14 : 16,
      lineHeight: isTablet ? 24 : isCompact ? 18 : 20,
    },
    subtitle: {
      fontSize: isTablet ? 18 : isCompact ? 14 : 16,
      lineHeight: isTablet ? 26 : isCompact ? 20 : 22,
    },
    sectionTitle: {
      fontSize: isTablet ? 18 : isCompact ? 14 : 16,
    },
    platformItemWidth: isLargeTablet
      ? (width * 0.5 - 80) / 6
      : isTablet
        ? (width * 0.65 - 80) / 3
        : (width * 0.9 - 60) / 3,
    platformItem: {
      padding: isTablet ? VibraSpacing.md : isCompact ? VibraSpacing.xs : VibraSpacing.sm,
    },
    platformIcon: {
      width: isTablet ? 40 : isCompact ? 28 : 32,
      height: isTablet ? 40 : isCompact ? 28 : 32,
      borderRadius: isTablet ? 20 : isCompact ? 14 : 16,
    },
    platformName: {
      fontSize: isTablet ? 12 : isCompact ? 9 : 10,
    },
    stepNumber: {
      width: isTablet ? 28 : isCompact ? 20 : 24,
      height: isTablet ? 28 : isCompact ? 20 : 24,
      borderRadius: isTablet ? 14 : isCompact ? 10 : 12,
    },
    stepNumberText: {
      fontSize: isTablet ? 14 : isCompact ? 10 : 12,
    },
    stepText: {
      fontSize: isTablet ? 16 : isCompact ? 13 : 14,
      lineHeight: isTablet ? 24 : isCompact ? 18 : 20,
    },
    giftIcon: {
      width: isTablet ? 80 : isCompact ? 52 : 64,
      height: isTablet ? 80 : isCompact ? 52 : 64,
      borderRadius: isTablet ? 24 : isCompact ? 16 : 20,
    },
    giftIconSize: isTablet ? 40 : isCompact ? 28 : 32,
    platformIconSize: isTablet ? 24 : isCompact ? 16 : 20,
    emailButtonText: {
      fontSize: isTablet ? 18 : isCompact ? 14 : 16,
    },
    termsText: {
      fontSize: isTablet ? 14 : isCompact ? 11 : 12,
    },
    content: {
      paddingHorizontal: isTablet
        ? VibraSpacing['2xl']
        : isCompact
          ? VibraSpacing.md
          : VibraSpacing.xl,
      paddingTop: isTablet ? VibraSpacing['3xl'] : isCompact ? VibraSpacing.lg : VibraSpacing['2xl'],
      paddingBottom: isTablet ? VibraSpacing['2xl'] : isCompact ? VibraSpacing.md : VibraSpacing.xl,
    },
    logoSectionMargin: isTablet ? VibraSpacing.xl : isCompact ? VibraSpacing.sm : VibraSpacing.xl,
    platformsSectionMargin: isTablet ? VibraSpacing.xl : isCompact ? VibraSpacing.md : VibraSpacing.xl,
    instructionsSectionMargin: isTablet
      ? VibraSpacing.xl
      : isCompact
        ? VibraSpacing.md
        : VibraSpacing.xl,
    closeButton: {
      width: isTablet ? 40 : 36,
      height: isTablet ? 40 : 36,
      borderRadius: isTablet ? 20 : 18,
    },
    closeIconSize: isTablet ? 24 : 20,
    mailIconSize: isTablet ? 24 : isCompact ? 18 : 20,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, responsiveStyles.modal]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, responsiveStyles.closeButton]}>
            <X size={responsiveStyles.closeIconSize} color={VibraColors.neutral.textTertiary} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={[styles.content, responsiveStyles.content]}
            showsVerticalScrollIndicator={false}>
            <View
              style={[styles.logoSection, { marginBottom: responsiveStyles.logoSectionMargin }]}>
              <View style={[styles.giftIcon, responsiveStyles.giftIcon]}>
                <Gift size={responsiveStyles.giftIconSize} color={VibraColors.accent.purple} />
              </View>
              <View style={styles.brandText}>
                <Text style={[styles.brandTitle, responsiveStyles.brandTitle]}>
                  Earn $10 Credits
                </Text>
                <Text style={[styles.brandTagline, responsiveStyles.brandTagline]}>
                  Share VibraCode & Get Rewarded
                </Text>
              </View>
            </View>

            <Text style={[styles.subtitle, responsiveStyles.subtitle]}>
              Post about VibraCode on any social platform and earn $10 worth of credits!
            </Text>

            {/* Social Platforms */}
            <View
              style={[
                styles.platformsSection,
                { marginBottom: responsiveStyles.platformsSectionMargin },
              ]}>
              <Text style={[styles.sectionTitle, responsiveStyles.sectionTitle]}>
                Share on these platforms:
              </Text>
              <View style={styles.platformsGrid}>
                {socialPlatforms.map((platform, index) => {
                  const IconComponent = platform.icon;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.platformItem,
                        responsiveStyles.platformItem,
                        { width: responsiveStyles.platformItemWidth },
                      ]}>
                      <View
                        style={[
                          styles.platformIcon,
                          responsiveStyles.platformIcon,
                          { backgroundColor: platform.color },
                        ]}>
                        <IconComponent size={responsiveStyles.platformIconSize} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.platformName, responsiveStyles.platformName]}>
                        {platform.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Instructions */}
            <View
              style={[
                styles.instructionsSection,
                { marginBottom: responsiveStyles.instructionsSectionMargin },
              ]}>
              <Text style={[styles.sectionTitle, responsiveStyles.sectionTitle]}>
                How to claim:
              </Text>
              <View style={styles.stepsList}>
                <View style={styles.step}>
                  <View style={[styles.stepNumber, responsiveStyles.stepNumber]}>
                    <Text style={[styles.stepNumberText, responsiveStyles.stepNumberText]}>1</Text>
                  </View>
                  <Text style={[styles.stepText, responsiveStyles.stepText]}>
                    Post about VibraCode on any platform
                  </Text>
                </View>
                <View style={styles.step}>
                  <View style={[styles.stepNumber, responsiveStyles.stepNumber]}>
                    <Text style={[styles.stepNumberText, responsiveStyles.stepNumberText]}>2</Text>
                  </View>
                  <Text style={[styles.stepText, responsiveStyles.stepText]}>
                    Include @VibraCode or mention us
                  </Text>
                </View>
                <View style={styles.step}>
                  <View style={[styles.stepNumber, responsiveStyles.stepNumber]}>
                    <Text style={[styles.stepNumberText, responsiveStyles.stepNumberText]}>3</Text>
                  </View>
                  <Text style={[styles.stepText, responsiveStyles.stepText]}>
                    Email us with your post details
                  </Text>
                </View>
              </View>
            </View>

            {/* Email Button */}
            <TouchableOpacity style={styles.emailButton} onPress={handleEmailPress}>
              <LinearGradient
                colors={[VibraColors.accent.purple, VibraColors.accent.blue]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emailButtonGradient}>
                <Mail size={responsiveStyles.mailIconSize} color="#FFFFFF" />
                <Text style={[styles.emailButtonText, responsiveStyles.emailButtonText]}>
                  Email Us Your Post
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.termsText, responsiveStyles.termsText]}>
              * Credits added within 24 hours. One claim per user.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: VibraSpacing.lg,
    right: VibraSpacing.lg,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  content: {
    paddingHorizontal: VibraSpacing.xl,
    paddingTop: VibraSpacing['2xl'],
    paddingBottom: VibraSpacing.xl,
  },
  logoSection: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: VibraSpacing.xl,
    gap: VibraSpacing.md,
  },
  giftIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 69, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 69, 255, 0.2)',
  },
  brandText: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 16,
    fontWeight: '400',
    color: '#CCCCCC',
    marginTop: 4,
    opacity: 0.8,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: VibraSpacing.xl,
    lineHeight: 22,
    fontWeight: '400',
    opacity: 0.9,
    paddingHorizontal: VibraSpacing.sm,
  },
  platformsSection: {
    marginBottom: VibraSpacing.xl,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: VibraSpacing.md,
    textAlign: 'center',
  },
  platformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: VibraSpacing.sm,
  },
  platformItem: {
    alignItems: 'center',
    padding: VibraSpacing.sm,
    backgroundColor: VibraColors.neutral.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  platformIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: VibraSpacing.xs,
  },
  platformName: {
    color: '#CCCCCC',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },
  instructionsSection: {
    marginBottom: VibraSpacing.xl,
  },
  stepsList: {
    gap: VibraSpacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: VibraSpacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: VibraColors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  stepText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    fontWeight: '400',
    opacity: 0.9,
  },
  emailButton: {
    borderRadius: 16,
    shadowColor: VibraColors.accent.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    overflow: 'hidden',
    marginBottom: VibraSpacing.md,
  },
  emailButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: VibraSpacing['2xl'],
    paddingVertical: VibraSpacing.md,
    gap: VibraSpacing.sm,
    minHeight: 48,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  termsText: {
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '400',
    opacity: 0.7,
    letterSpacing: 0.1,
    paddingHorizontal: VibraSpacing.sm,
  },
});

export default VibraGiftModal;
