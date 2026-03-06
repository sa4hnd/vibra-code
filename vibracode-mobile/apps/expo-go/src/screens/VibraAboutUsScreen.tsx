import {
  ChevronLeft,
  Rocket,
  Users,
  User,
  Mail,
  FileText,
  Shield,
  CreditCard,
} from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { VibraCosmicBackground } from '../components/vibra/VibraCosmicBackground';
import { VibraColors, VibraSpacing } from '../constants/VibraColors';

interface VibraAboutUsScreenProps {
  navigation: any;
}

// Claude Logo SVG Component
const ClaudeLogo = ({ size = 24, color = '#D77655' }) => (
  <Svg width={size} height={size} viewBox="0 0 512 509.64">
    <Path
      fill={color}
      d="M115.612 0h280.775C459.974 0 512 52.026 512 115.612v278.415c0 63.587-52.026 115.612-115.613 115.612H115.612C52.026 509.639 0 457.614 0 394.027V115.612C0 52.026 52.026 0 115.612 0z"
    />
    <Path
      fill="#FCF2EE"
      d="M142.27 316.619l73.655-41.326 1.238-3.589-1.238-1.996-3.589-.001-12.31-.759-42.084-1.138-36.498-1.516-35.361-1.896-8.897-1.895-8.34-10.995.859-5.484 7.482-5.03 10.717.935 23.683 1.617 35.537 2.452 25.782 1.517 38.193 3.968h6.064l.86-2.451-2.073-1.517-1.618-1.517-36.776-24.922-39.81-26.338-20.852-15.166-11.273-7.683-5.687-7.204-2.451-15.721 10.237-11.273 13.75.935 3.513.936 13.928 10.716 29.749 23.027 38.848 28.612 5.687 4.727 2.275-1.617.278-1.138-2.553-4.271-21.13-38.193-22.546-38.848-10.035-16.101-2.654-9.655c-.935-3.968-1.617-7.304-1.617-11.374l11.652-15.823 6.445-2.073 15.545 2.073 6.547 5.687 9.655 22.092 15.646 34.78 24.265 47.291 7.103 14.028 3.791 12.992 1.416 3.968 2.449-.001v-2.275l1.997-26.641 3.69-32.707 3.589-42.084 1.239-11.854 5.863-14.206 11.652-7.683 9.099 4.348 7.482 10.716-1.036 6.926-4.449 28.915-8.72 45.294-5.687 30.331h3.313l3.792-3.791 15.342-20.372 25.782-32.227 11.374-12.789 13.27-14.129 8.517-6.724 16.1-.001 11.854 17.617-5.307 18.199-16.581 21.029-13.75 17.819-19.716 26.54-12.309 21.231 1.138 1.694 2.932-.278 44.536-9.479 24.062-4.347 28.714-4.928 12.992 6.066 1.416 6.167-5.106 12.613-30.71 7.583-36.018 7.204-53.636 12.689-.657.48.758.935 24.164 2.275 10.337.556h25.301l47.114 3.514 12.309 8.139 7.381 9.959-1.238 7.583-18.957 9.655-25.579-6.066-59.702-14.205-20.474-5.106-2.83-.001v1.694l17.061 16.682 31.266 28.233 39.152 36.397 1.997 8.999-5.03 7.102-5.307-.758-34.401-25.883-13.27-11.651-30.053-25.302-1.996-.001v2.654l6.926 10.136 36.574 54.975 1.895 16.859-2.653 5.485-9.479 3.311-10.414-1.895-21.408-30.054-22.092-33.844-17.819-30.331-2.173 1.238-10.515 113.261-4.929 5.788-11.374 4.348-9.478-7.204-5.03-11.652 5.03-23.027 6.066-30.052 4.928-23.886 4.449-29.674 2.654-9.858-.177-.657-2.173.278-22.37 30.71-34.021 45.977-26.919 28.815-6.445 2.553-11.173-5.789 1.037-10.337 6.243-9.2 37.257-47.392 22.47-29.371 14.508-16.961-.101-2.451h-.859l-98.954 64.251-17.618 2.275-7.583-7.103.936-11.652 3.589-3.791 29.749-20.474-.101.102.024.101z"
    />
  </Svg>
);

export const VibraAboutUsScreen: React.FC<VibraAboutUsScreenProps> = ({ navigation }) => {
  return (
    <VibraCosmicBackground>
      {/* Header Container - matches other screens exactly */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={20} color={VibraColors.neutral.textTertiary} />
          </TouchableOpacity>
          <Text style={styles.title}>About</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <View style={styles.contentWrapper}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Hero Section - Bigger */}
          <View style={styles.heroSection}>
            <View style={styles.heroContent}>
              <Image
                source={{ uri: 'https://i.imgur.com/fPrpRh3.png' }}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.appName}>Vibra Code</Text>
              <Text style={styles.appDescription}>Building the future, one app at a time</Text>
            </View>
          </View>

          {/* Mission Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Rocket
                size={22}
                color={VibraColors.neutral.textSecondary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>Our Mission</Text>
            </View>
            <Text style={styles.sectionText}>
              We believe everyone with an idea should be able to build amazing full-stack apps
              without being a tech wizard. Just tell us what you want, and we'll build it for you.
            </Text>
          </View>

          {/* Team Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users
                size={22}
                color={VibraColors.neutral.textSecondary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>The Team</Text>
            </View>
            <Text style={styles.sectionText}>
              We're a small but mighty team of builders, dreamers, and problem-solvers who are
              passionate about democratizing app development.
            </Text>
          </View>

          {/* Founder Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={22} color={VibraColors.neutral.textSecondary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Founder</Text>
            </View>
            <Text style={styles.founderName}>Sehind Hemzani</Text>
            <Text style={styles.founderRole}>Founder & Lead Developer</Text>
            <Text style={styles.founderBio}>
              An experienced developer who has built and launched multiple successful SaaS
              companies, including NodeFlow AI. Works with leading companies to bring their
              innovative ideas to life. Passionate about making technology accessible to everyone
              and building the future of app development.
            </Text>
          </View>

          {/* Powered By Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.claudeLogoContainer}>
                <ClaudeLogo size={24} color="#D77655" />
              </View>
              <Text style={styles.sectionTitle}>Powered by Claude</Text>
            </View>
            <Text style={styles.sectionText}>
              We're powered by Claude, the best AI coder out there. It's like having a senior
              developer who never sleeps and always gets your vision.
            </Text>
          </View>

          {/* Contact Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Mail size={22} color={VibraColors.neutral.textSecondary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Get in Touch</Text>
            </View>
            <Text style={styles.sectionText}>
              Have an idea? Want to work with us? We'd love to hear from you.
            </Text>
            <View style={styles.contactEmailContainer}>
              <Text style={styles.contactEmail}>hello@vibracodeapp.com</Text>
            </View>
          </View>

          {/* Subscription Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <CreditCard
                size={22}
                color={VibraColors.neutral.textSecondary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>Subscription Plans</Text>
            </View>
            <Text style={styles.sectionText}>
              Vibra Pro unlocks unlimited app creation and premium features.
            </Text>
            <View style={styles.subscriptionList}>
              <View style={styles.subscriptionItem}>
                <Text style={styles.subscriptionPlan}>Weekly</Text>
                <Text style={styles.subscriptionPrice}>$7.99/week</Text>
              </View>
              <View style={styles.subscriptionItem}>
                <Text style={styles.subscriptionPlan}>Monthly</Text>
                <Text style={styles.subscriptionPrice}>$19.99/month</Text>
              </View>
              <View style={styles.subscriptionItem}>
                <Text style={styles.subscriptionPlan}>Yearly</Text>
                <Text style={styles.subscriptionPrice}>$99.99/year</Text>
              </View>
            </View>
            <Text style={styles.subscriptionDisclaimer}>
              Subscriptions automatically renew unless cancelled at least 24 hours before the end of
              the current period. Payment will be charged to your Apple ID account. Manage
              subscriptions in Settings {'>'} [Your Name] {'>'} Subscriptions.
            </Text>
          </View>

          {/* Legal Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileText
                size={22}
                color={VibraColors.neutral.textSecondary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>Legal</Text>
            </View>

            <TouchableOpacity
              style={styles.legalButton}
              onPress={() => Linking.openURL('https://www.vibracodeapp.com/privacy')}>
              <Shield size={20} color={VibraColors.neutral.text} />
              <Text style={styles.legalButtonText}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.legalButton}
              onPress={() => Linking.openURL('https://www.vibracodeapp.com/terms')}>
              <FileText size={20} color={VibraColors.neutral.text} />
              <Text style={styles.legalButtonText}>Terms of Use</Text>
            </TouchableOpacity>
          </View>

          {/* App Version */}
          <View style={styles.versionSection}>
            <View style={styles.versionCard}>
              <Text style={styles.versionText}>Made with ❤️ by the Vibra Code team</Text>
              <Text style={styles.versionNumber}>Designed in Europe • Version 1.0.0</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </VibraCosmicBackground>
  );
};

const styles = StyleSheet.create({
  // Content wrapper - matches other screens exactly
  contentWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },

  // Header Container - matches other screens exactly
  headerContainer: {
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: VibraColors.neutral.border,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: VibraSpacing.xl,
    paddingBottom: VibraSpacing.md,
    minHeight: 64,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VibraColors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: VibraSpacing.lg,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.button,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },

  // Full-width scroll area - matches chat screen
  scrollArea: {
    flex: 1,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: VibraSpacing.xl,
    paddingTop: VibraSpacing.lg,
    paddingBottom: VibraSpacing['6xl'],
    flexGrow: 1,
  },

  // Hero section - bigger
  heroSection: {
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
    padding: 32, // Bigger padding
  },

  // Hero content
  heroContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 64, // Bigger logo
    height: 64,
    borderRadius: 16,
    marginBottom: VibraSpacing['2xl'], // More spacing
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  appName: {
    color: VibraColors.neutral.text,
    fontSize: 24, // Bigger font
    fontWeight: '700', // Bolder
    lineHeight: 28,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    textAlign: 'center',
    marginBottom: 12, // More spacing
  },
  appDescription: {
    color: '#CCCCCC',
    fontSize: 16, // Bigger font
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.2,
    opacity: 0.9,
  },

  // Section headers with icons
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: VibraSpacing.lg,
  },
  sectionIcon: {
    marginRight: VibraSpacing.md,
  },
  claudeLogoContainer: {
    marginRight: VibraSpacing.md,
  },

  // Section titles and text
  sectionTitle: {
    color: VibraColors.neutral.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    flex: 1,
  },
  sectionText: {
    color: '#CCCCCC',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: -0.2,
    opacity: 0.85,
  },

  // Regular section styling - modern and professional
  section: {
    marginBottom: 20,
    position: 'relative',
    backgroundColor: VibraColors.surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'visible',
    padding: 24,
  },

  // Founder styles
  founderName: {
    color: VibraColors.neutral.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(255, 255, 255, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    marginBottom: 6,
    marginTop: VibraSpacing.sm,
  },
  founderRole: {
    color: VibraColors.neutral.textSecondary,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: VibraSpacing.lg,
  },
  founderBio: {
    color: '#CCCCCC',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: -0.2,
    opacity: 0.85,
  },

  // Contact email
  contactEmailContainer: {
    marginTop: VibraSpacing.lg,
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    padding: VibraSpacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
  },
  contactEmail: {
    fontSize: 16,
    color: VibraColors.neutral.text,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: -0.2,
  },

  // Version section
  versionSection: {
    alignItems: 'center',
    paddingTop: VibraSpacing['3xl'],
    paddingBottom: VibraSpacing.lg,
  },
  versionCard: {
    backgroundColor: VibraColors.surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    paddingHorizontal: VibraSpacing.xl,
    paddingVertical: VibraSpacing.lg,
    shadowColor: VibraColors.shadow.card,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    color: VibraColors.neutral.text,
    fontWeight: '500',
    marginBottom: VibraSpacing.sm,
    textAlign: 'center',
    opacity: 0.9,
  },
  versionNumber: {
    fontSize: 12,
    color: '#CCCCCC',
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.7,
  },

  // Subscription styles
  subscriptionList: {
    marginTop: VibraSpacing.lg,
    marginBottom: VibraSpacing.lg,
  },
  subscriptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: VibraSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: VibraColors.neutral.border,
  },
  subscriptionPlan: {
    fontSize: 16,
    fontWeight: '600',
    color: VibraColors.neutral.text,
    letterSpacing: -0.2,
  },
  subscriptionPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: VibraColors.accent.amber,
    letterSpacing: -0.2,
  },
  subscriptionDisclaimer: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: -0.1,
    marginTop: VibraSpacing.sm,
  },

  // Legal button styles
  legalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VibraColors.neutral.backgroundSecondary,
    padding: VibraSpacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: VibraColors.neutral.border,
    marginTop: VibraSpacing.md,
  },
  legalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: VibraColors.neutral.text,
    marginLeft: VibraSpacing.md,
    letterSpacing: -0.2,
  },
});

export default VibraAboutUsScreen;
